/**
 * UJIAN GAS - FULL BACKEND
 * Google Apps Script + Google Sheets
 *
 * Arsitektur:
 * Android -> HTTPS Web App -> Google Apps Script -> Google Sheets
 *
 * Fitur:
 * - Register/login siswa
 * - Login admin/guru
 * - Admin membuat ujian
 * - Admin membuat soal pilihan ganda
 * - Admin mengundang siswa
 * - Undangan email via GmailApp
 * - Siswa melihat undangan
 * - Siswa melihat ujian yang aktif
 * - Timer berbasis waktu server
 * - Server memvalidasi periode ujian
 * - Submit jawaban
 * - Nilai otomatis
 * - Riwayat hasil
 * - Dashboard admin
 *
 * SETUP:
 * 1. Buat project Apps Script standalone.
 * 2. Paste seluruh file ini.
 * 3. Jalankan setup() satu kali.
 * 4. Jalankan createDemoAdmin() satu kali.
 * 5. Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 *
 * CATATAN PRODUKSI:
 * Password MVP disimpan sebagai hash SHA-256, bukan plaintext.
 * Untuk produksi skala besar, sebaiknya gunakan database/auth khusus.
 */

const PROP_SHEET_ID = "UJIAN_GAS_SHEET_ID";
const ADMIN_EMAIL = "admin@example.com"; // opsional: email admin demo

const SHEETS = {
  Users: ["id","name","email","passwordHash","role","active","createdAt"],
  Exams: ["id","title","description","durationMinutes","startAt","endAt","status","createdBy","createdAt"],
  Questions: ["id","examId","question","optionA","optionB","optionC","optionD","answer","points","createdAt"],
  Invitations: ["id","email","examId","status","sentAt","createdAt"],
  Results: ["id","email","examId","score","correct","total","answersJson","startedAt","submittedAt"],
  Reminders: ["id","email","examId","text","remindAt","createdAt"]
};

/* =========================
   DATABASE
   ========================= */

function ss() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_SHEET_ID);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      props.deleteProperty(PROP_SHEET_ID);
    }
  }

  const spreadsheet = SpreadsheetApp.create("Ujian GAS Database");
  props.setProperty(PROP_SHEET_ID, spreadsheet.getId());
  return spreadsheet;
}

function sheet(name) {
  const spreadsheet = ss();
  let sh = spreadsheet.getSheetByName(name);
  if (!sh) sh = spreadsheet.insertSheet(name);
  return sh;
}

function setup() {
  const spreadsheet = ss();

  Object.keys(SHEETS).forEach(function(name) {
    let sh = spreadsheet.getSheetByName(name);
    if (!sh) sh = spreadsheet.insertSheet(name);

    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
    }
  });

  const defaultSheet = spreadsheet.getSheetByName("Sheet1");
  if (
    defaultSheet &&
    spreadsheet.getSheets().length > 1 &&
    defaultSheet.getLastRow() === 0
  ) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  Logger.log("DATABASE: " + spreadsheet.getUrl());
  return {
    ok: true,
    message: "Database siap",
    databaseUrl: spreadsheet.getUrl(),
    databaseId: spreadsheet.getId()
  };
}

/**
 * Membuat akun guru/admin demo.
 * Jalankan sekali lalu ganti password/email sesuai kebutuhan.
 */
function createDemoAdmin() {
  const email = ADMIN_EMAIL;
  const password = "Admin123!";
  const users = rows("Users");

  if (users.some(function(u) {
    return String(u.email).toLowerCase() === email.toLowerCase();
  })) {
    return {ok:false, message:"Admin sudah ada: " + email};
  }

  sheet("Users").appendRow([
    id("U"),
    "Administrator",
    email,
    hashPassword(password),
    "admin",
    true,
    new Date()
  ]);

  return {
    ok:true,
    message:"Admin dibuat",
    email:email,
    password:password
  };
}

function rows(name) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  return values.slice(1).map(function(row) {
    const obj = {};
    SHEETS[name].forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
}

function append(name, obj) {
  const row = SHEETS[name].map(function(header) {
    return obj[header] !== undefined ? obj[header] : "";
  });
  sheet(name).appendRow(row);
}

function id(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function bool(v) {
  return v === true || String(v).toLowerCase() === "true";
}

function parseDate(v) {
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new Error("Format tanggal tidak valid: " + v);
  return d;
}

/* =========================
   WEB API
   ========================= */

function doGet(e) {
  return handle(e);
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  try {
    const p = e.parameter || {};
    const action = p.action || "ping";
    const result = router(action, p);
    return json(result);
  } catch (err) {
    return json({
      ok:false,
      message:String(err && err.message ? err.message : err)
    });
  }
}

function router(action, p) {
  switch (action) {
    case "ping": return {ok:true, message:"Ujian GAS API aktif", time:new Date()};
    case "register": return register(p);
    case "login": return login(p);

    case "exams": return exams(p);
    case "questions": return questions(p);
    case "submit": return submit(p);

    case "invitations": return invitations(p);
    case "results": return results(p);
    case "reminders": return reminders(p);

    case "admin_dashboard": return adminDashboard(p);
    case "admin_create_exam": return adminCreateExam(p);
    case "admin_create_question": return adminCreateQuestion(p);
    case "admin_invite": return adminInvite(p);
    case "admin_users": return adminUsers(p);
    case "admin_results": return adminResults(p);

    default:
      return {ok:false, message:"Action tidak dikenal: " + action};
  }
}

/* =========================
   AUTH
   ========================= */

function register(p) {
  if (!p.name || !p.email || !p.password) {
    return {ok:false,message:"Nama, email, password wajib diisi"};
  }

  const email = String(p.email).trim().toLowerCase();
  const users = rows("Users");

  if (users.some(function(u) {
    return String(u.email).toLowerCase() === email;
  })) {
    return {ok:false,message:"Email sudah terdaftar"};
  }

  append("Users", {
    id:id("U"),
    name:String(p.name).trim(),
    email:email,
    passwordHash:hashPassword(p.password),
    role:"student",
    active:true,
    createdAt:new Date()
  });

  return {ok:true,message:"Pendaftaran berhasil"};
}

function login(p) {
  if (!p.email || !p.password) {
    return {ok:false,message:"Email dan password wajib diisi"};
  }

  const email = String(p.email).trim().toLowerCase();

  const user = rows("Users").find(function(u) {
    return String(u.email).toLowerCase() === email &&
      String(u.passwordHash) === hashPassword(p.password) &&
      bool(u.active);
  });

  if (!user) {
    return {ok:false,message:"Email/password salah atau akun nonaktif"};
  }

  return {
    ok:true,
    userId:user.id,
    name:user.name,
    email:user.email,
    role:user.role
  };
}

/* =========================
   STUDENT
   ========================= */

function exams(p) {
  const now = new Date();
  const all = rows("Exams");

  const invited = p.email ? rows("Invitations").filter(function(i) {
    return String(i.email).toLowerCase() === String(p.email).toLowerCase();
  }) : [];

  const invitedIds = {};
  invited.forEach(function(i) { invitedIds[i.examId] = true; });

  const data = all
    .filter(function(e) {
      const start = parseDate(e.startAt);
      const end = parseDate(e.endAt);
      const status = String(e.status || "published").toLowerCase();

      if (String(p.role || "").toLowerCase() === "admin") return true;

      return status === "published" &&
        invitedIds[e.id] &&
        now >= start &&
        now <= end;
    })
    .map(function(e) {
      const start = parseDate(e.startAt);
      const end = parseDate(e.endAt);

      return {
        id:e.id,
        title:e.title,
        description:e.description,
        durationMinutes:Number(e.durationMinutes),
        startAt:start.toISOString(),
        endAt:end.toISOString(),
        status:e.status
      };
    });

  return {ok:true,serverTime:now.toISOString(),data:data};
}

function questions(p) {
  if (!p.examId) return {ok:false,message:"examId wajib"};

  const data = rows("Questions")
    .filter(function(q) {
      return String(q.examId) === String(p.examId);
    })
    .map(function(q) {
      return {
        id:q.id,
        examId:q.examId,
        question:q.question,
        optionA:q.optionA,
        optionB:q.optionB,
        optionC:q.optionC,
        optionD:q.optionD,
        points:Number(q.points || 1)
      };
    });

  return {ok:true,data:data};
}

function submit(p) {
  if (!p.email || !p.examId || !p.answers) {
    return {ok:false,message:"email, examId dan answers wajib"};
  }

  const email = String(p.email).trim().toLowerCase();
  const exam = rows("Exams").find(function(e) {
    return String(e.id) === String(p.examId);
  });

  if (!exam) return {ok:false,message:"Ujian tidak ditemukan"};

  const now = new Date();
  const start = parseDate(exam.startAt);
  const end = parseDate(exam.endAt);

  if (now < start) {
    return {ok:false,message:"Ujian belum dimulai"};
  }

  if (now > end) {
    return {ok:false,message:"Waktu ujian sudah berakhir"};
  }

  const invitation = rows("Invitations").find(function(i) {
    return String(i.examId) === String(p.examId) &&
      String(i.email).toLowerCase() === email;
  });

  if (!invitation) {
    return {ok:false,message:"Anda tidak diundang ke ujian ini"};
  }

  const previous = rows("Results").find(function(r) {
    return String(r.examId) === String(p.examId) &&
      String(r.email).toLowerCase() === email;
  });

  if (previous) {
    return {
      ok:false,
      message:"Ujian sudah pernah dikirim",
      score:Number(previous.score)
    };
  }

  let answerMap;
  try {
    answerMap = JSON.parse(p.answers);
  } catch (err) {
    return {ok:false,message:"Format answers tidak valid"};
  }

  const qs = rows("Questions").filter(function(q) {
    return String(q.examId) === String(p.examId);
  });

  let correct = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  qs.forEach(function(q) {
    const points = Number(q.points || 1);
    totalPoints += points;

    const given = String(answerMap[q.id] || "").toUpperCase();
    const right = String(q.answer || "").toUpperCase();

    if (given && given === right) {
      correct++;
      earnedPoints += points;
    }
  });

  const score = totalPoints > 0
    ? Math.round((earnedPoints / totalPoints) * 10000) / 100
    : 0;

  append("Results", {
    id:id("R"),
    email:email,
    examId:p.examId,
    score:score,
    correct:correct,
    total:qs.length,
    answersJson:JSON.stringify(answerMap),
    startedAt:p.startedAt ? parseDate(p.startedAt) : now,
    submittedAt:now
  });

  return {
    ok:true,
    score:score,
    correct:correct,
    total:qs.length,
    message:"Ujian berhasil dikirim dan dinilai otomatis"
  };
}

function invitations(p) {
  if (!p.email) return {ok:false,message:"email wajib"};

  const email = String(p.email).trim().toLowerCase();
  const examMap = {};
  rows("Exams").forEach(function(e) { examMap[e.id] = e; });

  const data = rows("Invitations")
    .filter(function(i) {
      return String(i.email).toLowerCase() === email;
    })
    .map(function(i) {
      const e = examMap[i.examId] || {};
      return {
        id:i.id,
        examId:i.examId,
        title:e.title || i.examId,
        status:i.status,
        text:"Undangan: " + (e.title || i.examId) + " • " + i.status
      };
    });

  return {ok:true,data:data};
}

function results(p) {
  if (!p.email) return {ok:false,message:"email wajib"};

  const email = String(p.email).trim().toLowerCase();
  const examMap = {};
  rows("Exams").forEach(function(e) { examMap[e.id] = e; });

  const data = rows("Results")
    .filter(function(r) {
      return String(r.email).toLowerCase() === email;
    })
    .map(function(r) {
      return {
        id:r.id,
        examId:r.examId,
        title:(examMap[r.examId] || {}).title || r.examId,
        score:Number(r.score),
        correct:Number(r.correct),
        total:Number(r.total),
        submittedAt:String(r.submittedAt),
        text:(examMap[r.examId] || {}).title +
          " — Nilai " + r.score +
          " (" + r.correct + "/" + r.total + ")"
      };
    });

  return {ok:true,data:data};
}

function reminders(p) {
  if (!p.email) return {ok:false,message:"email wajib"};

  const email = String(p.email).trim().toLowerCase();

  const data = rows("Reminders")
    .filter(function(r) {
      return String(r.email).toLowerCase() === email;
    })
    .map(function(r) {
      return {
        id:r.id,
        text:r.text,
        remindAt:String(r.remindAt)
      };
    });

  return {ok:true,data:data};
}

/* =========================
   ADMIN
   ========================= */

function requireAdmin(p) {
  if (!p.email) throw new Error("Email admin wajib");

  const email = String(p.email).trim().toLowerCase();

  const user = rows("Users").find(function(u) {
    return String(u.email).toLowerCase() === email &&
      String(u.role).toLowerCase() === "admin" &&
      bool(u.active);
  });

  if (!user) throw new Error("Akses admin ditolak");
  return user;
}

function adminDashboard(p) {
  requireAdmin(p);

  const exams = rows("Exams");
  const questions = rows("Questions");
  const invitations = rows("Invitations");
  const results = rows("Results");
  const users = rows("Users");

  return {
    ok:true,
    stats:{
      users:users.filter(function(u){return u.role === "student";}).length,
      exams:exams.length,
      questions:questions.length,
      invitations:invitations.length,
      results:results.length
    }
  };
}

function adminCreateExam(p) {
  const admin = requireAdmin(p);

  if (!p.title || !p.durationMinutes || !p.startAt || !p.endAt) {
    return {
      ok:false,
      message:"title, durationMinutes, startAt dan endAt wajib"
    };
  }

  const start = parseDate(p.startAt);
  const end = parseDate(p.endAt);

  if (end <= start) {
    return {ok:false,message:"endAt harus setelah startAt"};
  }

  const examId = id("EX");

  append("Exams", {
    id:examId,
    title:String(p.title).trim(),
    description:String(p.description || "").trim(),
    durationMinutes:Number(p.durationMinutes),
    startAt:start,
    endAt:end,
    status:String(p.status || "published"),
    createdBy:admin.email,
    createdAt:new Date()
  });

  return {
    ok:true,
    message:"Ujian berhasil dibuat",
    examId:examId
  };
}

function adminCreateQuestion(p) {
  requireAdmin(p);

  if (
    !p.examId ||
    !p.question ||
    !p.optionA ||
    !p.optionB ||
    !p.optionC ||
    !p.optionD ||
    !p.answer
  ) {
    return {ok:false,message:"Semua field soal wajib diisi"};
  }

  const answer = String(p.answer).toUpperCase();

  if (["A","B","C","D"].indexOf(answer) === -1) {
    return {ok:false,message:"answer harus A, B, C atau D"};
  }

  const exam = rows("Exams").find(function(e) {
    return String(e.id) === String(p.examId);
  });

  if (!exam) return {ok:false,message:"Ujian tidak ditemukan"};

  const qid = id("Q");

  append("Questions", {
    id:qid,
    examId:p.examId,
    question:String(p.question),
    optionA:String(p.optionA),
    optionB:String(p.optionB),
    optionC:String(p.optionC),
    optionD:String(p.optionD),
    answer:answer,
    points:Number(p.points || 1),
    createdAt:new Date()
  });

  return {
    ok:true,
    message:"Soal berhasil dibuat",
    questionId:qid
  };
}

function adminInvite(p) {
  const admin = requireAdmin({email: p.adminEmail || p.email});

  if (!(p.studentEmail || p.email) || !p.examId) {
    return {ok:false,message:"studentEmail dan examId wajib"};
  }

  const email = String(p.studentEmail || p.email).trim().toLowerCase();

  const exam = rows("Exams").find(function(e) {
    return String(e.id) === String(p.examId);
  });

  if (!exam) return {ok:false,message:"Ujian tidak ditemukan"};

  const existing = rows("Invitations").find(function(i) {
    return String(i.examId) === String(p.examId) &&
      String(i.email).toLowerCase() === email;
  });

  if (existing) {
    return {ok:false,message:"Siswa sudah diundang"};
  }

  const invitationId = id("I");

  append("Invitations", {
    id:invitationId,
    email:email,
    examId:p.examId,
    status:"invited",
    sentAt:new Date(),
    createdAt:new Date()
  });

  let emailStatus = "undangan disimpan";

  try {
    GmailApp.sendEmail(
      email,
      "Undangan Ujian: " + exam.title,
      "Anda diundang mengikuti ujian \"" +
      exam.title +
      "\".\n\nPeriode: " +
      exam.startAt +
      " sampai " +
      exam.endAt +
      "\nDurasi: " +
      exam.durationMinutes +
      " menit.\n\nSilakan buka aplikasi Ujian GAS."
    );

    emailStatus = "undangan disimpan dan email terkirim";
  } catch (err) {
    emailStatus = "undangan disimpan, email gagal: " + err.message;
  }

  return {
    ok:true,
    message:emailStatus,
    invitationId:invitationId
  };
}

function adminUsers(p) {
  requireAdmin(p);

  const data = rows("Users").map(function(u) {
    return {
      id:u.id,
      name:u.name,
      email:u.email,
      role:u.role,
      active:bool(u.active),
      createdAt:String(u.createdAt)
    };
  });

  return {ok:true,data:data};
}

function adminResults(p) {
  requireAdmin(p);

  const examMap = {};
  rows("Exams").forEach(function(e) { examMap[e.id] = e; });

  const data = rows("Results").map(function(r) {
    return {
      id:r.id,
      email:r.email,
      examId:r.examId,
      title:(examMap[r.examId] || {}).title || r.examId,
      score:Number(r.score),
      correct:Number(r.correct),
      total:Number(r.total),
      submittedAt:String(r.submittedAt)
    };
  });

  return {ok:true,data:data};
}
