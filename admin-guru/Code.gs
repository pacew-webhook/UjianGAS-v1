const SHEET_ID = '1sPB55UO_TbxQctmnHQ4FoRcPNNBuseOf';
const SESSION_PREFIX = 'UGAS_ADMIN_SESSION_';
const SESSION_SECONDS = 21600; // 6 jam

function ss_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet tidak ditemukan: ' + name);
  return s;
}

function now_() { return new Date(); }

function id_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Ujian GAS • Admin Guru')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =========================
   DATABASE / SETUP
   ========================= */

function setupDatabase() {
  const schema = {
    Admin: ['AdminID','Nama','Email','PasswordHash','Role','Status','CreatedAt'],
    Siswa: ['StudentID','Nama','Email','PasswordHash','Kelas','Status','CreatedAt'],
    Ujian: ['ExamID','NamaUjian','Mapel','DurasiMenit','Tanggal','JamMulai','JamSelesai','Status','CreatedAt'],
    Soal: ['QuestionID','ExamID','Pertanyaan','PilihanA','PilihanB','PilihanC','PilihanD','JawabanBenar','Bobot','CreatedAt'],
    Undangan: ['InviteID','ExamID','StudentID','Status','SentAt'],
    Jawaban: ['AnswerID','ExamID','StudentID','QuestionID','Jawaban','Waktu'],
    Nilai: ['ResultID','ExamID','StudentID','Benar','Salah','Nilai','Status','Waktu'],
    Pengingat: ['ReminderID','ExamID','Pesan','Target','Waktu']
  };

  const spreadsheet = ss_();
  Object.keys(schema).forEach(function(name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(schema[name]);
  });
  return { ok: true, message: 'Database siap', spreadsheetUrl: spreadsheet.getUrl() };
}

function createInitialAdmin() {
  // GANTI email/password sebelum menjalankan fungsi ini.
  const email = 'admin@example.com';
  const password = 'admin123';
  return createAdmin_('Administrator', email, password, 'ADMIN');
}

function createAdmin(nama, email, password, role) {
  if (!nama || !email || !password) throw new Error('Nama, email, dan password wajib diisi.');
  return createAdmin_(nama, email, password, role || 'GURU');
}

function createAdmin_(nama, email, password, role) {
  const normalized = String(email).trim().toLowerCase();
  const existing = rows_('Admin').find(function(a) {
    return String(a.Email).trim().toLowerCase() === normalized;
  });
  if (existing) throw new Error('Email admin sudah ada.');

  return append_('Admin', {
    AdminID: id_('ADM'), Nama: String(nama).trim(), Email: normalized,
    PasswordHash: hash_(password), Role: String(role || 'GURU').toUpperCase(),
    Status: 'ACTIVE', CreatedAt: now_()
  });
}

function hash_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

/* =========================
   SESSION / AUTH
   ========================= */

function createSession_(admin) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    SESSION_PREFIX + token,
    JSON.stringify({
      AdminID: admin.AdminID,
      Nama: admin.Nama,
      Email: admin.Email,
      Role: admin.Role
    }),
    SESSION_SECONDS
  );
  return token;
}

function requireAdmin_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login.');
  const raw = CacheService.getScriptCache().get(SESSION_PREFIX + token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}

function loginAdmin(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const admin = rows_('Admin').find(function(a) {
    return String(a.Email).trim().toLowerCase() === normalized &&
      String(a.PasswordHash) === hash_(password || '') &&
      String(a.Status).toUpperCase() === 'ACTIVE';
  });
  if (!admin) throw new Error('Email atau password salah.');
  return {
    token: createSession_(admin),
    admin: { AdminID: admin.AdminID, Nama: admin.Nama, Email: admin.Email, Role: admin.Role }
  };
}

function logoutAdmin(token) {
  if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + token);
  return true;
}

/* =========================
   SHEET HELPERS
   ========================= */

function rows_(sheetName) {
  const sheet = sh_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.some(function(v) { return v !== '' && v !== null; });
  }).map(function(row, index) {
    const obj = { __row: index + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function append_(sheetName, obj) {
  const sheet = sh_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function(h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  }));
  return obj;
}

function updateById_(sheetName, idField, id, data) {
  const row = rows_(sheetName).find(function(x) { return String(x[idField]) === String(id); });
  if (!row) throw new Error('Data tidak ditemukan.');
  const sheet = sh_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (Object.prototype.hasOwnProperty.call(data, h)) {
      sheet.getRange(row.__row, i + 1).setValue(data[h]);
    }
  });
  return true;
}

function deleteById_(sheetName, idField, id) {
  const row = rows_(sheetName).find(function(x) { return String(x[idField]) === String(id); });
  if (!row) throw new Error('Data tidak ditemukan.');
  sh_(sheetName).deleteRow(row.__row);
  return true;
}

function safeNumber_(v, fallback) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

/* =========================
   DASHBOARD
   ========================= */

function getDashboard(token) {
  requireAdmin_(token);
  const students = rows_('Siswa');
  const exams = rows_('Ujian');
  const questions = rows_('Soal');
  const invitations = rows_('Undangan');
  const results = rows_('Nilai');

  return {
    students: students.length,
    exams: exams.length,
    questions: questions.length,
    invitations: invitations.length,
    results: results.length,
    activeStudents: students.filter(function(s) { return String(s.Status).toUpperCase() === 'ACTIVE'; }).length,
    publishedExams: exams.filter(function(e) { return String(e.Status).toUpperCase() === 'PUBLISHED'; }).length
  };
}

/* =========================
   SISWA
   ========================= */

function getStudents(token) {
  requireAdmin_(token);
  return rows_('Siswa').map(function(s) {
    return {
      StudentID: s.StudentID, Nama: s.Nama, Email: s.Email, Kelas: s.Kelas,
      Status: s.Status, CreatedAt: s.CreatedAt
    };
  });
}

function addStudent(token, data) {
  requireAdmin_(token);
  if (!data || !String(data.Nama || '').trim()) throw new Error('Nama siswa wajib diisi.');
  const email = String(data.Email || '').trim().toLowerCase();
  if (email && rows_('Siswa').some(function(s) { return String(s.Email).toLowerCase() === email; })) {
    throw new Error('Email siswa sudah terdaftar.');
  }

  return append_('Siswa', {
    StudentID: id_('STD'), Nama: String(data.Nama).trim(), Email: email,
    PasswordHash: data.Password ? hash_(data.Password) : '',
    Kelas: String(data.Kelas || '').trim(), Status: data.Status || 'ACTIVE', CreatedAt: now_()
  });
}

function updateStudent(token, id, data) {
  requireAdmin_(token);
  const clean = {
    Nama: String(data.Nama || '').trim(), Email: String(data.Email || '').trim().toLowerCase(),
    Kelas: String(data.Kelas || '').trim(), Status: String(data.Status || 'ACTIVE').toUpperCase()
  };
  if (!clean.Nama) throw new Error('Nama siswa wajib diisi.');
  if (data.Password) clean.PasswordHash = hash_(data.Password);
  return updateById_('Siswa', 'StudentID', id, clean);
}

function deleteStudent(token, id) {
  requireAdmin_(token);
  return deleteById_('Siswa', 'StudentID', id);
}

/* =========================
   UJIAN
   ========================= */

function getExams(token) {
  requireAdmin_(token);
  return rows_('Ujian');
}

function createExam(token, data) {
  const admin = requireAdmin_(token);
  if (!data || !String(data.NamaUjian || '').trim()) throw new Error('Nama ujian wajib diisi.');
  if (!String(data.Tanggal || '').trim() || !String(data.JamMulai || '').trim() || !String(data.JamSelesai || '').trim()) {
    throw new Error('Tanggal, jam mulai, dan jam selesai wajib diisi.');
  }

  const duration = safeNumber_(data.DurasiMenit, 0);
  if (duration <= 0) throw new Error('Durasi harus lebih dari 0 menit.');

  return append_('Ujian', {
    ExamID: id_('EXM'), NamaUjian: String(data.NamaUjian).trim(), Mapel: String(data.Mapel || '').trim(),
    DurasiMenit: duration, Tanggal: String(data.Tanggal), JamMulai: String(data.JamMulai),
    JamSelesai: String(data.JamSelesai), Status: String(data.Status || 'DRAFT').toUpperCase(), CreatedAt: now_(),
    CreatedBy: admin.Email
  });
}

function updateExam(token, id, data) {
  requireAdmin_(token);
  const duration = safeNumber_(data.DurasiMenit, 0);
  if (!String(data.NamaUjian || '').trim()) throw new Error('Nama ujian wajib diisi.');
  if (duration <= 0) throw new Error('Durasi harus lebih dari 0 menit.');
  return updateById_('Ujian', 'ExamID', id, {
    NamaUjian: String(data.NamaUjian).trim(), Mapel: String(data.Mapel || '').trim(),
    DurasiMenit: duration, Tanggal: String(data.Tanggal || ''), JamMulai: String(data.JamMulai || ''),
    JamSelesai: String(data.JamSelesai || ''), Status: String(data.Status || 'DRAFT').toUpperCase()
  });
}

function deleteExam(token, id) {
  requireAdmin_(token);
  return deleteById_('Ujian', 'ExamID', id);
}

/* =========================
   SOAL
   ========================= */

function getQuestions(token, examId) {
  requireAdmin_(token);
  return rows_('Soal').filter(function(q) {
    return !examId || String(q.ExamID) === String(examId);
  });
}

function addQuestion(token, data) {
  requireAdmin_(token);
  if (!data || !data.ExamID || !String(data.Pertanyaan || '').trim()) throw new Error('Ujian dan pertanyaan wajib diisi.');
  if (!['A','B','C','D'].includes(String(data.JawabanBenar || '').toUpperCase())) throw new Error('Jawaban benar harus A, B, C, atau D.');
  if (!rows_('Ujian').some(function(e) { return String(e.ExamID) === String(data.ExamID); })) throw new Error('Ujian tidak ditemukan.');

  return append_('Soal', {
    QuestionID: id_('Q'), ExamID: data.ExamID, Pertanyaan: String(data.Pertanyaan).trim(),
    PilihanA: String(data.PilihanA || '').trim(), PilihanB: String(data.PilihanB || '').trim(),
    PilihanC: String(data.PilihanC || '').trim(), PilihanD: String(data.PilihanD || '').trim(),
    JawabanBenar: String(data.JawabanBenar).toUpperCase(), Bobot: safeNumber_(data.Bobot, 1) || 1, CreatedAt: now_()
  });
}

function updateQuestion(token, id, data) {
  requireAdmin_(token);
  const answer = String(data.JawabanBenar || '').toUpperCase();
  if (!['A','B','C','D'].includes(answer)) throw new Error('Jawaban benar harus A, B, C, atau D.');
  return updateById_('Soal', 'QuestionID', id, {
    ExamID: data.ExamID, Pertanyaan: String(data.Pertanyaan || '').trim(),
    PilihanA: String(data.PilihanA || '').trim(), PilihanB: String(data.PilihanB || '').trim(),
    PilihanC: String(data.PilihanC || '').trim(), PilihanD: String(data.PilihanD || '').trim(),
    JawabanBenar: answer, Bobot: safeNumber_(data.Bobot, 1) || 1
  });
}

function deleteQuestion(token, id) {
  requireAdmin_(token);
  return deleteById_('Soal', 'QuestionID', id);
}

/* =========================
   UNDANGAN
   ========================= */

function getInvitations(token, examId) {
  requireAdmin_(token);
  const students = Object.fromEntries(rows_('Siswa').map(function(s) { return [s.StudentID, s]; }));
  const exams = Object.fromEntries(rows_('Ujian').map(function(e) { return [e.ExamID, e]; }));
  return rows_('Undangan').filter(function(i) {
    return !examId || String(i.ExamID) === String(examId);
  }).map(function(i) {
    return Object.assign({}, i, {
      NamaSiswa: students[i.StudentID] ? students[i.StudentID].Nama : i.StudentID,
      Email: students[i.StudentID] ? students[i.StudentID].Email : '',
      NamaUjian: exams[i.ExamID] ? exams[i.ExamID].NamaUjian : i.ExamID
    });
  });
}

function sendInvitation(token, examId, studentIds) {
  requireAdmin_(token);
  if (!examId) throw new Error('Ujian wajib dipilih.');
  if (!Array.isArray(studentIds) || !studentIds.length) throw new Error('Pilih minimal satu siswa.');

  const exam = rows_('Ujian').find(function(e) { return String(e.ExamID) === String(examId); });
  if (!exam) throw new Error('Ujian tidak ditemukan.');

  const students = rows_('Siswa').filter(function(s) { return studentIds.map(String).includes(String(s.StudentID)); });
  const existing = rows_('Undangan');
  let added = 0, emailSent = 0;

  students.forEach(function(s) {
    const already = existing.some(function(i) {
      return String(i.ExamID) === String(examId) && String(i.StudentID) === String(s.StudentID);
    });
    if (already) return;

    append_('Undangan', {
      InviteID: id_('INV'), ExamID: examId, StudentID: s.StudentID,
      Status: 'INVITED', SentAt: now_()
    });
    added++;

    if (s.Email) {
      try {
        MailApp.sendEmail({
          to: s.Email,
          subject: 'Undangan Ujian: ' + exam.NamaUjian,
          htmlBody: '<div style="font-family:Arial">' +
            '<h2>Undangan Ujian</h2>' +
            '<p>Halo ' + escapeHtml_(s.Nama) + ', Anda mendapatkan undangan ujian.</p>' +
            '<p><b>Ujian:</b> ' + escapeHtml_(exam.NamaUjian) + '<br>' +
            '<b>Mapel:</b> ' + escapeHtml_(exam.Mapel || '-') + '<br>' +
            '<b>Jadwal:</b> ' + escapeHtml_(exam.Tanggal) + ' ' + escapeHtml_(exam.JamMulai) + '–' + escapeHtml_(exam.JamSelesai) + '<br>' +
            '<b>Durasi:</b> ' + escapeHtml_(exam.DurasiMenit) + ' menit</p>' +
            '<p>Silakan buka aplikasi Ujian GAS sesuai jadwal.</p></div>'
        });
        emailSent++;
      } catch (err) {
        // Undangan tetap tersimpan walaupun email gagal.
      }
    }
  });

  return { success: true, total: added, emailSent: emailSent };
}

function deleteInvitation(token, id) {
  requireAdmin_(token);
  return deleteById_('Undangan', 'InviteID', id);
}

/* =========================
   HASIL
   ========================= */

function getResults(token, examId) {
  requireAdmin_(token);
  const students = Object.fromEntries(rows_('Siswa').map(function(s) { return [s.StudentID, s]; }));
  const exams = Object.fromEntries(rows_('Ujian').map(function(e) { return [e.ExamID, e]; }));
  return rows_('Nilai').filter(function(r) {
    return !examId || String(r.ExamID) === String(examId);
  }).map(function(r) {
    const student = students[r.StudentID] || {};
    const exam = exams[r.ExamID] || {};
    return Object.assign({}, r, {
      Nama: student.Nama || r.StudentID,
      Kelas: student.Kelas || '',
      Email: student.Email || '',
      NamaUjian: exam.NamaUjian || r.ExamID
    });
  });
}

/* =========================
   PENGINGAT
   ========================= */

function getReminders(token, examId) {
  requireAdmin_(token);
  const exams = Object.fromEntries(rows_('Ujian').map(function(e) { return [e.ExamID, e]; }));
  return rows_('Pengingat').filter(function(r) {
    return !examId || String(r.ExamID) === String(examId);
  }).map(function(r) {
    return Object.assign({}, r, { NamaUjian: exams[r.ExamID] ? exams[r.ExamID].NamaUjian : r.ExamID });
  });
}

function addReminder(token, data) {
  requireAdmin_(token);
  if (!data.ExamID || !String(data.Pesan || '').trim()) throw new Error('Ujian dan pesan wajib diisi.');
  return append_('Pengingat', {
    ReminderID: id_('REM'), ExamID: data.ExamID, Pesan: String(data.Pesan).trim(),
    Target: String(data.Target || 'SEMUA').trim(), Waktu: data.Waktu ? new Date(data.Waktu) : now_()
  });
}

function deleteReminder(token, id) {
  requireAdmin_(token);
  return deleteById_('Pengingat', 'ReminderID', id);
}

/* =========================
   ADMIN USERS
   ========================= */

function getAdmins(token) {
  requireAdmin_(token);
  return rows_('Admin').map(function(a) {
    return { AdminID:a.AdminID, Nama:a.Nama, Email:a.Email, Role:a.Role, Status:a.Status, CreatedAt:a.CreatedAt };
  });
}

function addAdmin(token, data) {
  requireAdmin_(token);
  return createAdmin_(data.Nama, data.Email, data.Password, data.Role || 'GURU');
}

function updateAdmin(token, id, data) {
  requireAdmin_(token);
  const clean = {
    Nama: String(data.Nama || '').trim(), Email: String(data.Email || '').trim().toLowerCase(),
    Role: String(data.Role || 'GURU').toUpperCase(), Status: String(data.Status || 'ACTIVE').toUpperCase()
  };
  if (!clean.Nama || !clean.Email) throw new Error('Nama dan email wajib diisi.');
  if (data.Password) clean.PasswordHash = hash_(data.Password);
  return updateById_('Admin', 'AdminID', id, clean);
}

function deleteAdmin(token, id) {
  const current = requireAdmin_(token);
  if (String(current.AdminID) === String(id)) throw new Error('Admin yang sedang login tidak boleh dihapus.');
  const admins = rows_('Admin');
  if (admins.filter(function(a) { return String(a.Status).toUpperCase() === 'ACTIVE'; }).length <= 1) {
    throw new Error('Minimal harus ada satu admin aktif.');
  }
  return deleteById_('Admin', 'AdminID', id);
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
