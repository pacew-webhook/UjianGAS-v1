const SHEET_ID = 'ISI_GOOGLE_SHEET_ID_DI_SINI';
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

function now_() {
  return new Date();
}

function id_(prefix) {
  return prefix + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
}

/* =========================
   WEB ADMIN
   ========================= */

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Ujian GAS • Admin Guru')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/* =========================
   API ANDROID
   ========================= */

/*
 * Android GasApi.kt menggunakan FormBody:
 *
 * action=login
 * email=...
 * password=...
 *
 * Jadi kita membaca e.parameter, bukan JSON body.
 */
function doPost(e) {
  try {
    const data = e && e.parameter ? e.parameter : {};
    const action = String(data.action || '').trim();

    switch (action) {

      case 'login':
        return jsonResponse_(loginStudentApi_(data));

      case 'register':
        return jsonResponse_(registerStudentApi_(data));

      case 'exams':
        return jsonResponse_(getStudentExamsApi_(data));

      case 'questions':
        return jsonResponse_(getStudentQuestionsApi_(data));

      case 'submit':
        return jsonResponse_(submitStudentExamApi_(data));

      case 'invitations':
        return jsonResponse_(getStudentInvitationsApi_(data));

      case 'results':
        return jsonResponse_(getStudentResultsApi_(data));

      case 'reminders':
        return jsonResponse_(getStudentRemindersApi_(data));

      default:
        return jsonResponse_({
          ok: false,
          message: 'Action tidak dikenal: ' + action
        });
    }

  } catch (err) {
    return jsonResponse_({
      ok: false,
      message: err && err.message
        ? err.message
        : String(err)
    });
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================
   DATABASE / SETUP
   ========================= */

function setupDatabase() {

  const schema = {

    Admin: [
      'AdminID',
      'Nama',
      'Email',
      'PasswordHash',
      'Role',
      'Status',
      'CreatedAt'
    ],

    Siswa: [
      'StudentID',
      'Nama',
      'Email',
      'PasswordHash',
      'Kelas',
      'Status',
      'CreatedAt'
    ],

    Ujian: [
      'ExamID',
      'NamaUjian',
      'Mapel',
      'DurasiMenit',
      'Tanggal',
      'JamMulai',
      'JamSelesai',
      'Status',
      'CreatedAt',
      'CreatedBy'
    ],

    Soal: [
      'QuestionID',
      'ExamID',
      'Pertanyaan',
      'PilihanA',
      'PilihanB',
      'PilihanC',
      'PilihanD',
      'JawabanBenar',
      'Bobot',
      'CreatedAt'
    ],

    Undangan: [
      'InviteID',
      'ExamID',
      'StudentID',
      'Status',
      'SentAt'
    ],

    Jawaban: [
      'AnswerID',
      'ExamID',
      'StudentID',
      'QuestionID',
      'Jawaban',
      'Waktu'
    ],

    Nilai: [
      'ResultID',
      'ExamID',
      'StudentID',
      'Benar',
      'Salah',
      'Nilai',
      'Status',
      'Waktu'
    ],

    Pengingat: [
      'ReminderID',
      'ExamID',
      'Pesan',
      'Target',
      'Waktu'
    ]
  };

  const spreadsheet = ss_();

  Object.keys(schema).forEach(function(name) {

    let sheet = spreadsheet.getSheetByName(name);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }

    /*
     * Jika sheet benar-benar kosong,
     * buat header.
     */
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schema[name]);
      return;
    }

    /*
     * Jika sheet sudah ada, pastikan
     * header yang dibutuhkan tersedia.
     */
    const lastCol = sheet.getLastColumn();

    if (lastCol < 1) {
      sheet.appendRow(schema[name]);
      return;
    }

    const currentHeaders = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(function(h) {
        return String(h || '').trim();
      });

    schema[name].forEach(function(header) {

      if (!currentHeaders.includes(header)) {

        sheet
          .getRange(1, sheet.getLastColumn() + 1)
          .setValue(header);

        currentHeaders.push(header);
      }
    });
  });

  return {
    ok: true,
    message: 'Database siap.',
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function createInitialAdmin() {

  /*
   * Kredensial admin awal TIDAK disimpan di source code.
   * Atur melalui Google Apps Script:
   * Project Settings -> Script properties
   *
   * Name:
   *   INITIAL_ADMIN_EMAIL
   *   INITIAL_ADMIN_PASSWORD
   *
   * Setelah akun berhasil dibuat, hapus kedua Script Properties tersebut.
   */
  const props = PropertiesService.getScriptProperties();

  const email = String(
    props.getProperty('INITIAL_ADMIN_EMAIL') || ''
  ).trim();

  const password =
    props.getProperty('INITIAL_ADMIN_PASSWORD') || '';

  if (!email || !password) {
    throw new Error(
      'Kredensial admin awal belum diatur. ' +
      'Buka Project Settings > Script properties, lalu isi ' +
      'INITIAL_ADMIN_EMAIL dan INITIAL_ADMIN_PASSWORD.'
    );
  }

  return createAdmin_(
    'Administrator',
    email,
    password,
    'ADMIN'
  );
}

/**
 * Hapus kredensial admin awal setelah akun berhasil dibuat.
 * Jalankan setelah createInitialAdmin() sukses.
 */
function clearInitialAdminCredentials() {

  const props = PropertiesService.getScriptProperties();

  props.deleteProperty('INITIAL_ADMIN_EMAIL');
  props.deleteProperty('INITIAL_ADMIN_PASSWORD');

  return {
    ok: true,
    message: 'Kredensial admin awal sudah dihapus dari Script Properties.'
  };
}

/* =========================
   PASSWORD
   ========================= */

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
   ADMIN
   ========================= */

function createAdmin(nama, email, password, role) {

  if (!nama || !email || !password) {
    throw new Error(
      'Nama, email, dan password wajib diisi.'
    );
  }

  return createAdmin_(
    nama,
    email,
    password,
    role || 'GURU'
  );
}

function createAdmin_(nama, email, password, role) {

  const normalized = String(email)
    .trim()
    .toLowerCase();

  const existing = rows_('Admin').find(function(a) {

    return String(a.Email || '')
      .trim()
      .toLowerCase() === normalized;

  });

  if (existing) {
    throw new Error('Email admin sudah ada.');
  }

  return append_('Admin', {

    AdminID: id_('ADM'),

    Nama: String(nama).trim(),

    Email: normalized,

    PasswordHash: hash_(password),

    Role: String(role || 'GURU')
      .toUpperCase(),

    Status: 'ACTIVE',

    CreatedAt: now_()
  });
}

/* =========================
   ADMIN SESSION
   ========================= */

function sessionStore_() {
  return PropertiesService.getScriptProperties();
}

function sessionPayload_(admin) {
  return JSON.stringify({
    AdminID: admin.AdminID,
    Nama: admin.Nama,
    Email: admin.Email,
    Role: admin.Role,
    expiresAt: Date.now() + (SESSION_SECONDS * 1000)
  });
}

function createSession_(admin) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const payload = sessionPayload_(admin);
  const key = SESSION_PREFIX + token;

  // Cache = cepat, Properties = persisten untuk pemulihan setelah refresh.
  CacheService.getScriptCache().put(key, payload, SESSION_SECONDS);
  sessionStore_().setProperty(key, payload);

  return token;
}

function requireAdmin_(token) {
  if (!token) {
    throw new Error('Sesi tidak ditemukan. Silakan login.');
  }

  const key = SESSION_PREFIX + String(token);
  let raw = CacheService.getScriptCache().get(key);

  // Jika cache hilang, pulihkan session dari Script Properties.
  if (!raw) {
    raw = sessionStore_().getProperty(key);
    if (raw) {
      try {
        const restored = JSON.parse(raw);
        if (restored.expiresAt && Date.now() >= Number(restored.expiresAt)) {
          sessionStore_().deleteProperty(key);
          throw new Error('Sesi berakhir. Silakan login kembali.');
        }
        CacheService.getScriptCache().put(key, raw, SESSION_SECONDS);
      } catch (err) {
        if (err && /Sesi berakhir/.test(String(err.message || err))) throw err;
        sessionStore_().deleteProperty(key);
        throw new Error('Sesi tidak valid. Silakan login kembali.');
      }
    }
  }

  if (!raw) {
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch (err) {
    sessionStore_().deleteProperty(key);
    CacheService.getScriptCache().remove(key);
    throw new Error('Sesi tidak valid. Silakan login kembali.');
  }

  if (session.expiresAt && Date.now() >= Number(session.expiresAt)) {
    sessionStore_().deleteProperty(key);
    CacheService.getScriptCache().remove(key);
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  // Sliding session: aktivitas yang valid memperpanjang 6 jam dari sekarang.
  session.expiresAt = Date.now() + (SESSION_SECONDS * 1000);
  const refreshed = JSON.stringify(session);
  sessionStore_().setProperty(key, refreshed);
  CacheService.getScriptCache().put(key, refreshed, SESSION_SECONDS);

  return session;
}

function loginAdmin(email, password) {

  const normalized = String(email || '')
    .trim()
    .toLowerCase();

  const admin = rows_('Admin').find(function(a) {

    return String(a.Email || '')
      .trim()
      .toLowerCase() === normalized &&

      String(a.PasswordHash || '') ===
      hash_(password || '') &&

      String(a.Status || '')
        .toUpperCase() === 'ACTIVE';

  });

  if (!admin) {
    throw new Error(
      'Email atau password salah.'
    );
  }

  return {

    token: createSession_(admin),

    admin: {
      AdminID: admin.AdminID,
      Nama: admin.Nama,
      Email: admin.Email,
      Role: admin.Role
    }
  };
}

function logoutAdmin(token) {
  if (token) {
    const key = SESSION_PREFIX + String(token);
    CacheService.getScriptCache().remove(key);
    sessionStore_().deleteProperty(key);
  }
  return true;
}

/* =========================
   SHEET HELPERS
   ========================= */

function rows_(sheetName) {

  const sheet = sh_(sheetName);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  const values = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastCol
    )
    .getValues();

  const headers = values[0];

  return values
    .slice(1)
    .filter(function(row) {

      return row.some(function(v) {
        return v !== '' && v !== null;
      });

    })
    .map(function(row, index) {

      const obj = {
        __row: index + 2
      };

      headers.forEach(function(h, i) {
        obj[h] = row[i];
      });

      return obj;
    });
}

function appendMany_(sheetName, objects) {
  if (!objects || !objects.length) return [];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sh_(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const values = objects.map(function(obj) {
      return headers.map(function(h) {
        return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
      });
    });
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, values.length, headers.length).setValues(values);
    SpreadsheetApp.flush();
    return objects;
  } finally {
    lock.releaseLock();
  }
}

function append_(sheetName, obj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sh_(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const values = headers.map(function(h) {
      return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
    });

    sheet.appendRow(values);
    SpreadsheetApp.flush();

    // Verifikasi fisik: data yang baru ditulis harus terbaca kembali dari Sheet.
    const idField = headers.find(function(h) { return /ID$/.test(String(h)); });
    if (idField && obj[idField] !== undefined) {
      const persisted = rows_(sheetName).some(function(row) {
        return String(row[idField]) === String(obj[idField]);
      });
      if (!persisted) throw new Error('Data gagal diverifikasi setelah disimpan: ' + sheetName);
    }
    return obj;
  } finally {
    lock.releaseLock();
  }
}

function updateById_(sheetName, idField, id, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const row = rows_(sheetName).find(function(x) {
      return String(x[idField]) === String(id);
    });
    if (!row) throw new Error('Data tidak ditemukan.');

    const sheet = sh_(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    headers.forEach(function(h, i) {
      if (Object.prototype.hasOwnProperty.call(data, h)) {
        sheet.getRange(row.__row, i + 1).setValue(data[h]);
      }
    });
    SpreadsheetApp.flush();

    const verified = rows_(sheetName).find(function(x) {
      return String(x[idField]) === String(id);
    });
    if (!verified) throw new Error('Data gagal diverifikasi setelah diperbarui: ' + sheetName);
    Object.keys(data).forEach(function(field) {
      if (Object.prototype.hasOwnProperty.call(data, field) && String(verified[field] == null ? '' : verified[field]) !== String(data[field] == null ? '' : data[field])) {
        throw new Error('Perubahan gagal diverifikasi pada kolom ' + field + '.');
      }
    });
    return true;
  } finally {
    lock.releaseLock();
  }
}

function deleteById_(sheetName, idField, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const row = rows_(sheetName).find(function(x) {
      return String(x[idField]) === String(id);
    });
    if (!row) throw new Error('Data tidak ditemukan.');

    sh_(sheetName).deleteRow(row.__row);
    SpreadsheetApp.flush();

    const stillExists = rows_(sheetName).some(function(x) {
      return String(x[idField]) === String(id);
    });
    if (stillExists) throw new Error('Data gagal diverifikasi setelah dihapus.');
    return true;
  } finally {
    lock.releaseLock();
  }
}

function safeNumber_(v, fallback) {

  const n = Number(v);

  return isFinite(n)
    ? n
    : fallback;
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

    activeStudents:
      students.filter(function(s) {

        return String(s.Status || '')
          .toUpperCase() === 'ACTIVE';

      }).length,

    publishedExams:
      exams.filter(function(e) {

        return String(e.Status || '')
          .toUpperCase() === 'PUBLISHED';

      }).length
  };
}

/* =========================
   ADMIN - SISWA
   ========================= */

function getStudents(token) {

  requireAdmin_(token);

  return clientSafe_(rows_('Siswa').map(function(s) {

    return {

      StudentID: s.StudentID,

      Nama: s.Nama,

      Email: s.Email,

      Kelas: s.Kelas,

      Status: s.Status,

      CreatedAt: s.CreatedAt
    };
  }));
}

function addStudent(token, data) {

  requireAdmin_(token);

  if (
    !data ||
    !String(data.Nama || '').trim()
  ) {
    throw new Error(
      'Nama siswa wajib diisi.'
    );
  }

  const email = String(data.Email || '')
    .trim()
    .toLowerCase();

  if (
    email &&
    rows_('Siswa').some(function(s) {

      return String(s.Email || '')
        .trim()
        .toLowerCase() === email;

    })
  ) {

    throw new Error(
      'Email siswa sudah terdaftar.'
    );
  }

  return clientSafe_(append_('Siswa', {

    StudentID: id_('STD'),

    Nama: String(data.Nama)
      .trim(),

    Email: email,

    PasswordHash:
      data.Password
        ? hash_(data.Password)
        : '',

    Kelas:
      String(data.Kelas || '')
        .trim(),

    Status:
      String(data.Status || 'ACTIVE')
        .toUpperCase(),

    CreatedAt: now_()
  }));
}

function updateStudent(
  token,
  id,
  data
) {

  requireAdmin_(token);

  const clean = {

    Nama:
      String(data.Nama || '')
        .trim(),

    Email:
      String(data.Email || '')
        .trim()
        .toLowerCase(),

    Kelas:
      String(data.Kelas || '')
        .trim(),

    Status:
      String(data.Status || 'ACTIVE')
        .toUpperCase()
  };

  if (!clean.Nama) {
    throw new Error(
      'Nama siswa wajib diisi.'
    );
  }

  if (data.Password) {
    clean.PasswordHash =
      hash_(data.Password);
  }

  return updateById_(
    'Siswa',
    'StudentID',
    id,
    clean
  );
}

function deleteStudent(
  token,
  id
) {

  requireAdmin_(token);

  return deleteById_(
    'Siswa',
    'StudentID',
    id
  );
}


/* =========================
   CLIENT SERIALIZATION
   =========================
   google.script.run tidak dapat mengirim objek Date langsung ke browser.
   Semua nilai yang dikirim ke Admin Guru harus berupa tipe JSON sederhana.
*/
function clientSafe_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(function(item) {
      return clientSafe_(item);
    });
  }

  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function(key) {
      out[key] = clientSafe_(value[key]);
    });
    return out;
  }

  return value;
}

function clientRows_(sheetName) {
  return clientSafe_(rows_(sheetName));
}

/* =========================
   ADMIN - UJIAN
   ========================= */

function getExams(token) {

  requireAdmin_(token);

  return clientRows_('Ujian');
}

function createExam(
  token,
  data
) {

  const admin =
    requireAdmin_(token);

  if (
    !data ||
    !String(data.NamaUjian || '')
      .trim()
  ) {
    throw new Error(
      'Nama ujian wajib diisi.'
    );
  }

  if (
    !String(data.Tanggal || '').trim() ||
    !String(data.JamMulai || '').trim() ||
    !String(data.JamSelesai || '').trim()
  ) {
    throw new Error(
      'Tanggal, jam mulai, dan jam selesai wajib diisi.'
    );
  }

  const duration =
    safeNumber_(
      data.DurasiMenit,
      0
    );

  if (duration <= 0) {
    throw new Error(
      'Durasi harus lebih dari 0 menit.'
    );
  }

  return clientSafe_(append_('Ujian', {

    ExamID: id_('EXM'),

    NamaUjian:
      String(data.NamaUjian)
        .trim(),

    Mapel:
      String(data.Mapel || '')
        .trim(),

    DurasiMenit:
      duration,

    Tanggal:
      String(data.Tanggal),

    JamMulai:
      String(data.JamMulai),

    JamSelesai:
      String(data.JamSelesai),

    Status:
      String(data.Status || 'DRAFT')
        .toUpperCase(),

    CreatedAt:
      now_(),

    CreatedBy:
      admin.Email
  }));
}

function updateExam(
  token,
  id,
  data
) {

  requireAdmin_(token);

  const duration =
    safeNumber_(
      data.DurasiMenit,
      0
    );

  if (
    !String(data.NamaUjian || '')
      .trim()
  ) {
    throw new Error(
      'Nama ujian wajib diisi.'
    );
  }

  if (duration <= 0) {
    throw new Error(
      'Durasi harus lebih dari 0 menit.'
    );
  }

  return updateById_(
    'Ujian',
    'ExamID',
    id,
    {

      NamaUjian:
        String(data.NamaUjian)
          .trim(),

      Mapel:
        String(data.Mapel || '')
          .trim(),

      DurasiMenit:
        duration,

      Tanggal:
        String(data.Tanggal || ''),

      JamMulai:
        String(data.JamMulai || ''),

      JamSelesai:
        String(data.JamSelesai || ''),

      Status:
        String(data.Status || 'DRAFT')
          .toUpperCase()
    }
  );
}

function deleteExam(
  token,
  id
) {

  requireAdmin_(token);

  return deleteById_(
    'Ujian',
    'ExamID',
    id
  );
}

/* =========================
   ADMIN - SOAL
   ========================= */

function getQuestions(
  token,
  examId
) {

  requireAdmin_(token);

  return clientRows_('Soal')
    .filter(function(q) {

      return !examId ||
        String(q.ExamID) ===
        String(examId);

    });
}

function addQuestion(
  token,
  data
) {

  requireAdmin_(token);

  if (
    !data ||
    !data.ExamID ||
    !String(data.Pertanyaan || '')
      .trim()
  ) {
    throw new Error(
      'Ujian dan pertanyaan wajib diisi.'
    );
  }

  const answer =
    String(data.JawabanBenar || '')
      .toUpperCase();

  if (
    !['A', 'B', 'C', 'D']
      .includes(answer)
  ) {
    throw new Error(
      'Jawaban benar harus A, B, C, atau D.'
    );
  }

  if (
    !rows_('Ujian').some(function(e) {

      return String(e.ExamID) ===
        String(data.ExamID);

    })
  ) {
    throw new Error(
      'Ujian tidak ditemukan.'
    );
  }

  return clientSafe_(append_('Soal', {

    QuestionID: id_('Q'),

    ExamID: data.ExamID,

    Pertanyaan:
      String(data.Pertanyaan)
        .trim(),

    PilihanA:
      String(data.PilihanA || '')
        .trim(),

    PilihanB:
      String(data.PilihanB || '')
        .trim(),

    PilihanC:
      String(data.PilihanC || '')
        .trim(),

    PilihanD:
      String(data.PilihanD || '')
        .trim(),

    JawabanBenar:
      answer,

    Bobot:
      safeNumber_(data.Bobot, 1) || 1,

    CreatedAt:
      now_()
  }));
}

function updateQuestion(
  token,
  id,
  data
) {

  requireAdmin_(token);

  const answer =
    String(data.JawabanBenar || '')
      .toUpperCase();

  if (
    !['A', 'B', 'C', 'D']
      .includes(answer)
  ) {
    throw new Error(
      'Jawaban benar harus A, B, C, atau D.'
    );
  }

  return updateById_(
    'Soal',
    'QuestionID',
    id,
    {

      ExamID:
        data.ExamID,

      Pertanyaan:
        String(data.Pertanyaan || '')
          .trim(),

      PilihanA:
        String(data.PilihanA || '')
          .trim(),

      PilihanB:
        String(data.PilihanB || '')
          .trim(),

      PilihanC:
        String(data.PilihanC || '')
          .trim(),

      PilihanD:
        String(data.PilihanD || '')
          .trim(),

      JawabanBenar:
        answer,

      Bobot:
        safeNumber_(data.Bobot, 1) || 1
    }
  );
}

function deleteQuestion(
  token,
  id
) {

  requireAdmin_(token);

  return deleteById_(
    'Soal',
    'QuestionID',
    id
  );
}

/* =========================
   ADMIN - IMPORT BANK SOAL EXCEL
   ========================= */

/* =========================
   ADMIN - IMPORT BANK SOAL EXCEL
   FIX2: parser XLSX lebih toleran + validasi header + error jelas
   ========================= */

function importQuestionsExcel(token, fileName, base64, examId, mode) {
  requireAdmin_(token);

  if (!base64) throw new Error('File Excel belum dipilih atau tidak berhasil dibaca browser.');
  if (!examId) throw new Error('Pilih ujian tujuan terlebih dahulu.');

  const examExists = rows_('Ujian').some(function(e) {
    return String(e.ExamID || '') === String(examId);
  });
  if (!examExists) throw new Error('Ujian tujuan tidak ditemukan. Silakan muat ulang halaman.');

  const name = String(fileName || 'bank-soal.xlsx').trim();
  if (!/\.xlsx$/i.test(name)) {
    throw new Error('Format file harus .xlsx. File .xls lama belum didukung.');
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(String(base64).replace(/\s/g, ''));
  } catch (err) {
    throw new Error('Isi file Excel tidak dapat dibaca: ' + String(err.message || err));
  }

  if (!bytes || !bytes.length) throw new Error('File Excel kosong.');

  const blob = Utilities.newBlob(
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name
  );

  const parsed = parseXlsxRows_(blob);
  if (!parsed.rows.length) {
    throw new Error('Tidak ditemukan baris data pada sheet "' + parsed.sheetName + '".');
  }

  const normalized = normalizeQuestionImportRows_(parsed.rows, examId);
  if (!normalized.length) throw new Error('Tidak ada soal valid yang dapat diimpor.');

  const selectedMode = String(mode || 'APPEND').toUpperCase() === 'REPLACE' ? 'REPLACE' : 'APPEND';
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = sh_('Soal');

    if (selectedMode === 'REPLACE') {
      const existing = rows_('Soal').filter(function(q) {
        return String(q.ExamID || '') === String(examId);
      });
      for (let i = existing.length - 1; i >= 0; i--) {
        sheet.deleteRow(existing[i].__row);
      }
    }

    normalized.forEach(function(q) {
      append_("Soal", q);
    });

    SpreadsheetApp.flush();

    const verify = rows_('Soal').filter(function(q) {
      return String(q.ExamID || '') === String(examId);
    });

    if (verify.length < normalized.length) {
      throw new Error(
        'Verifikasi gagal. File terbaca ' + normalized.length +
        ' soal, tetapi hanya ' + verify.length + ' soal terbaca kembali dari Sheet Soal.'
      );
    }

    return {
      ok: true,
      imported: normalized.length,
      totalForExam: verify.length,
      examId: String(examId),
      mode: selectedMode,
      fileName: name,
      sheetName: parsed.sheetName
    };
  } finally {
    lock.releaseLock();
  }
}

function parseXlsxRows_(blob) {
  let files;
  try {
    // XLSX adalah ZIP. Beberapa runtime Apps Script lebih konsisten jika
    // blob diberi MIME type application/zip sebelum Utilities.unzip().
    const zipBlob = blob.copyBlob().setContentType('application/zip');
    files = Utilities.unzip(zipBlob);
  } catch (err) {
    throw new Error('File bukan XLSX yang valid atau rusak. Silakan simpan ulang sebagai .xlsx. Detail: ' + String(err.message || err));
  }

  const map = {};
  files.forEach(function(f) {
    map[normalizeZipPath_(f.getName())] = f;
  });

  const workbookBlob = map['xl/workbook.xml'];
  if (!workbookBlob) throw new Error('File Excel tidak valid: xl/workbook.xml tidak ditemukan.');

  const ns = XmlService.getNamespace('http://schemas.openxmlformats.org/spreadsheetml/2006/main');
  const relNs = XmlService.getNamespace('http://schemas.openxmlformats.org/officeDocument/2006/relationships');

  let workbook;
  try {
    workbook = XmlService.parse(workbookBlob.getDataAsString()).getRootElement();
  } catch (err) {
    throw new Error('Workbook Excel tidak dapat dibaca: ' + String(err.message || err));
  }

  const sheetsNode = workbook.getChild('sheets', ns);
  if (!sheetsNode) throw new Error('Excel tidak memiliki sheet.');

  const relMap = {};
  const relBlob = map['xl/_rels/workbook.xml.rels'];
  if (relBlob) {
    const relRoot = XmlService.parse(relBlob.getDataAsString()).getRootElement();
    relRoot.getChildren().forEach(function(r) {
      const idAttr = r.getAttribute('Id');
      const targetAttr = r.getAttribute('Target');
      if (idAttr && targetAttr) {
        relMap[idAttr.getValue()] = targetAttr.getValue();
      }
    });
  }

  const candidates = [];
  sheetsNode.getChildren('sheet', ns).forEach(function(sheet) {
    const nameAttr = sheet.getAttribute('name');
    const ridAttr = sheet.getAttribute('id', relNs);
    if (!nameAttr || !ridAttr) return;
    const target = relMap[ridAttr.getValue()];
    if (!target) return;
    candidates.push({
      name: nameAttr.getValue(),
      path: resolveXlsxTarget_('xl/workbook.xml', target)
    });
  });

  if (!candidates.length) throw new Error('Sheet Excel tidak dapat ditemukan.');

  // Prioritas: sheet bernama Soal, lalu sheet yang pertama kali memiliki header soal.
  let selected = candidates.find(function(x) { return x.name.trim().toLowerCase() === 'soal'; }) || null;

  const shared = parseSharedStrings_(map, ns);

  function readSheet(candidate) {
    const sheetBlob = map[normalizeZipPath_(candidate.path)];
    if (!sheetBlob) return null;
    let root;
    try {
      root = XmlService.parse(sheetBlob.getDataAsString()).getRootElement();
    } catch (err) {
      throw new Error('Sheet "' + candidate.name + '" tidak dapat dibaca: ' + String(err.message || err));
    }
    const sheetData = root.getChild('sheetData', ns);
    if (!sheetData) return [];
    return sheetData.getChildren('row', ns).map(function(row) {
      const cells = {};
      row.getChildren('c', ns).forEach(function(c) {
        const refAttr = c.getAttribute('r');
        if (!refAttr) return;
        const ref = refAttr.getValue();
        const col = ref.replace(/\d+/g, '').toUpperCase();
        const typeAttr = c.getAttribute('t');
        const type = typeAttr ? typeAttr.getValue() : '';
        const v = c.getChild('v', ns);
        const inline = c.getChild('is', ns);
        let value = '';

        if (type === 's' && v) {
          const idx = Number(v.getText());
          value = shared[idx] == null ? '' : shared[idx];
        } else if (type === 'inlineStr' && inline) {
          value = xmlText_(inline, ns);
        } else if ((type === 'str' || type === 'd') && v) {
          value = v.getText();
        } else if (v) {
          value = v.getText();
        } else if (inline) {
          value = xmlText_(inline, ns);
        }
        cells[col] = value;
      });
      return cells;
    });
  }

  let rows = selected ? readSheet(selected) : null;

  if (!selected || !hasQuestionHeaderRow_(rows)) {
    for (let i = 0; i < candidates.length; i++) {
      const candidateRows = readSheet(candidates[i]);
      if (hasQuestionHeaderRow_(candidateRows)) {
        selected = candidates[i];
        rows = candidateRows;
        break;
      }
    }
  }

  if (!selected || !rows) throw new Error('Tidak ditemukan sheet Excel yang berisi header bank soal.');
  return { sheetName: selected.name, rows: rows };
}

function parseSharedStrings_(map, ns) {
  const shared = [];
  const blob = map['xl/sharedStrings.xml'];
  if (!blob) return shared;
  try {
    const root = XmlService.parse(blob.getDataAsString()).getRootElement();
    root.getChildren('si', ns).forEach(function(si) {
      shared.push(xmlText_(si, ns));
    });
  } catch (err) {
    throw new Error('sharedStrings Excel tidak dapat dibaca: ' + String(err.message || err));
  }
  return shared;
}

function normalizeZipPath_(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/');
  const out = [];
  parts.forEach(function(part) {
    if (!part || part === '.') return;
    if (part === '..') out.pop();
    else out.push(part);
  });
  return out.join('/');
}

function resolveXlsxTarget_(baseFile, target) {
  const t = String(target || '').replace(/\\/g, '/');
  if (/^https?:\/\//i.test(t)) return t;
  if (t.charAt(0) === '/') return normalizeZipPath_(t.slice(1));
  const baseParts = String(baseFile).split('/');
  baseParts.pop();
  return normalizeZipPath_(baseParts.concat(t.split('/')).join('/'));
}

function hasQuestionHeaderRow_(rows) {
  if (!rows || !rows.length) return false;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const keys = Object.keys(rows[i]);
    const values = keys.map(function(k) {
      return String(rows[i][k] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    });
    const set = {};
    values.forEach(function(v) { if (v) set[v] = true; });
    if ((set.pertanyaan || set.soal || set.question || set.questiontext) &&
        (set.pilihana || set.optiona || set.answera || set.a)) {
      return true;
    }
  }
  return false;
}

function xmlText_(element, ns) {
  const name = element.getName ? element.getName() : '';
  if (name === 't') return element.getText();
  let out = '';
  element.getChildren().forEach(function(child) {
    out += xmlText_(child, ns);
  });
  return out;
}

function normalizeQuestionImportRows_(rows, examId) {
  if (!rows.length) return [];

  // Temukan header dalam 20 baris pertama, sehingga file boleh memiliki judul/informasi di atas tabel.
  let headerIndex = -1;
  let headers = null;
  const maxHeaderScan = Math.min(rows.length, 20);

  for (let i = 0; i < maxHeaderScan; i++) {
    const candidate = rows[i];
    const keys = Object.keys(candidate);
    const normalizedValues = keys.map(function(k) {
      return String(candidate[k] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    });
    const hasQuestion = normalizedValues.some(function(v) {
      return ['pertanyaan','soal','question','questiontext'].indexOf(v) >= 0;
    });
    const hasA = normalizedValues.some(function(v) {
      return ['pilihana','a','optiona','answera'].indexOf(v) >= 0;
    });
    if (hasQuestion && hasA) {
      headerIndex = i;
      headers = candidate;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error('Header bank soal tidak ditemukan. Wajib ada: Pertanyaan, PilihanA, PilihanB, PilihanC, PilihanD, JawabanBenar.');
  }

  const headerKeys = Object.keys(headers);
  const getHeader = function(aliases) {
    const wanted = aliases.map(function(x) {
      return String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
    });
    for (let i = 0; i < headerKeys.length; i++) {
      const k = headerKeys[i];
      const normalized = String(headers[k] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (wanted.indexOf(normalized) >= 0) return k;
    }
    return null;
  };

  const columns = {
    question: getHeader(['Pertanyaan','Soal','Question','QuestionText']),
    a: getHeader(['PilihanA','A','OptionA','AnswerA']),
    b: getHeader(['PilihanB','B','OptionB','AnswerB']),
    c: getHeader(['PilihanC','C','OptionC','AnswerC']),
    d: getHeader(['PilihanD','D','OptionD','AnswerD']),
    answer: getHeader(['JawabanBenar','Kunci','Answer','CorrectAnswer']),
    weight: getHeader(['Bobot','Weight','Score'])
  };

  if (!columns.question || !columns.a || !columns.b || !columns.c || !columns.d || !columns.answer) {
    throw new Error('Kolom wajib tidak lengkap. Wajib: Pertanyaan, PilihanA, PilihanB, PilihanC, PilihanD, JawabanBenar.');
  }

  const result = [];
  rows.slice(headerIndex + 1).forEach(function(row, index) {
    const excelRow = headerIndex + index + 2;
    const question = String(row[columns.question] || '').trim();
    const a = String(row[columns.a] || '').trim();
    const b = String(row[columns.b] || '').trim();
    const c = String(row[columns.c] || '').trim();
    const d = String(row[columns.d] || '').trim();
    const answer = String(row[columns.answer] || '').trim().toUpperCase();

    if (!question && !a && !b && !c && !d && !answer) return;

    if (!question || !a || !b || !c || !d) {
      throw new Error('Baris Excel ' + excelRow + ' tidak lengkap.');
    }
    if (['A','B','C','D'].indexOf(answer) < 0) {
      throw new Error('Baris Excel ' + excelRow + ': JawabanBenar harus A, B, C, atau D.');
    }

    result.push({
      QuestionID: id_('Q'),
      ExamID: examId,
      Pertanyaan: question,
      PilihanA: a,
      PilihanB: b,
      PilihanC: c,
      PilihanD: d,
      JawabanBenar: answer,
      Bobot: safeNumber_(columns.weight ? row[columns.weight] : 1, 1) || 1,
      CreatedAt: now_()
    });
  });

  return result;
}

/* =========================
   ADMIN - UNDANGAN
   ========================= */

function getInvitations(
  token,
  examId
) {

  requireAdmin_(token);

  const students =
    Object.fromEntries(
      rows_('Siswa').map(function(s) {

        return [
          String(s.StudentID),
          s
        ];

      })
    );

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  return clientSafe_(rows_('Undangan')
    .filter(function(i) {

      return !examId ||
        String(i.ExamID) ===
        String(examId);

    })
    .map(function(i) {

      return Object.assign(
        {},
        i,
        {

          NamaSiswa:
            students[String(i.StudentID)]
              ? students[String(i.StudentID)].Nama
              : i.StudentID,

          Email:
            students[String(i.StudentID)]
              ? students[String(i.StudentID)].Email
              : '',

          NamaUjian:
            exams[String(i.ExamID)]
              ? exams[String(i.ExamID)].NamaUjian
              : i.ExamID
        }
      );
    }));
}

function sendInvitation(
  token,
  examId,
  studentIds
) {

  requireAdmin_(token);

  if (!examId) {
    throw new Error(
      'Ujian wajib dipilih.'
    );
  }

  if (
    !Array.isArray(studentIds) ||
    !studentIds.length
  ) {
    throw new Error(
      'Pilih minimal satu siswa.'
    );
  }

  const exam =
    rows_('Ujian').find(function(e) {

      return String(e.ExamID) ===
        String(examId);

    });

  if (!exam) {
    throw new Error(
      'Ujian tidak ditemukan.'
    );
  }

  const studentIdStrings =
    studentIds.map(String);

  const students =
    rows_('Siswa').filter(function(s) {

      return studentIdStrings
        .includes(String(s.StudentID));

    });

  const existing =
    rows_('Undangan');

  let added = 0;
  let emailSent = 0;

  students.forEach(function(s) {

    const already =
      existing.some(function(i) {

        return String(i.ExamID) ===
          String(examId) &&

          String(i.StudentID) ===
          String(s.StudentID);

      });

    if (already) {
      return;
    }

    append_('Undangan', {

      InviteID: id_('INV'),

      ExamID: examId,

      StudentID: s.StudentID,

      Status: 'INVITED',

      SentAt: now_()
    });

    added++;

    if (s.Email) {

      try {

        MailApp.sendEmail({

          to: s.Email,

          subject:
            'Undangan Ujian: ' +
            exam.NamaUjian,

          htmlBody:
            '<div style="font-family:Arial">' +

            '<h2>Undangan Ujian</h2>' +

            '<p>Halo ' +
            escapeHtml_(s.Nama) +
            ', Anda mendapatkan undangan ujian.</p>' +

            '<p>' +

            '<b>Ujian:</b> ' +
            escapeHtml_(exam.NamaUjian) +

            '<br>' +

            '<b>Mapel:</b> ' +
            escapeHtml_(exam.Mapel || '-') +

            '<br>' +

            '<b>Jadwal:</b> ' +
            escapeHtml_(exam.Tanggal) +
            ' ' +
            escapeHtml_(exam.JamMulai) +
            '–' +
            escapeHtml_(exam.JamSelesai) +

            '<br>' +

            '<b>Durasi:</b> ' +
            escapeHtml_(exam.DurasiMenit) +
            ' menit</p>' +

            '<p>Silakan buka aplikasi Ujian GAS sesuai jadwal.</p>' +

            '</div>'
        });

        emailSent++;

      } catch (err) {
        // Undangan tetap tersimpan.
      }
    }
  });

  return {

    success: true,

    total: added,

    emailSent: emailSent
  };
}

function deleteInvitation(
  token,
  id
) {

  requireAdmin_(token);

  return deleteById_(
    'Undangan',
    'InviteID',
    id
  );
}

/* =========================
   ADMIN - HASIL
   ========================= */

function getResults(
  token,
  examId
) {

  requireAdmin_(token);

  const students =
    Object.fromEntries(
      rows_('Siswa').map(function(s) {

        return [
          String(s.StudentID),
          s
        ];

      })
    );

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  return clientSafe_(rows_('Nilai')
    .filter(function(r) {

      return !examId ||
        String(r.ExamID) ===
        String(examId);

    })
    .map(function(r) {

      const student =
        students[String(r.StudentID)] ||
        {};

      const exam =
        exams[String(r.ExamID)] ||
        {};

      return Object.assign(
        {},
        r,
        {

          Nama:
            student.Nama ||
            r.StudentID,

          Kelas:
            student.Kelas ||
            '',

          Email:
            student.Email ||
            '',

          NamaUjian:
            exam.NamaUjian ||
            r.ExamID
        }
      );
    }));
}

/* =========================
   ADMIN - PENGINGAT
   ========================= */

function getReminders(
  token,
  examId
) {

  requireAdmin_(token);

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  return clientSafe_(rows_('Pengingat')
    .filter(function(r) {

      return !examId ||
        String(r.ExamID) ===
        String(examId);

    })
    .map(function(r) {

      return Object.assign(
        {},
        r,
        {

          NamaUjian:
            exams[String(r.ExamID)]
              ? exams[String(r.ExamID)].NamaUjian
              : r.ExamID
        }
      );
    }));
}

function addReminder(
  token,
  data
) {

  requireAdmin_(token);

  if (
    !data.ExamID ||
    !String(data.Pesan || '')
      .trim()
  ) {
    throw new Error(
      'Ujian dan pesan wajib diisi.'
    );
  }

  return clientSafe_(append_('Pengingat', {

    ReminderID: id_('REM'),

    ExamID: data.ExamID,

    Pesan:
      String(data.Pesan)
        .trim(),

    Target:
      String(data.Target || 'SEMUA')
        .trim(),

    Waktu:
      data.Waktu
        ? new Date(data.Waktu)
        : now_()
  }));
}

function deleteReminder(
  token,
  id
) {

  requireAdmin_(token);

  return deleteById_(
    'Pengingat',
    'ReminderID',
    id
  );
}

/* =========================
   ADMIN - USER ADMIN
   ========================= */

function getAdmins(token) {

  requireAdmin_(token);

  return clientSafe_(rows_('Admin').map(function(a) {

    return {

      AdminID: a.AdminID,

      Nama: a.Nama,

      Email: a.Email,

      Role: a.Role,

      Status: a.Status,

      CreatedAt: a.CreatedAt
    };
  }));
}

function addAdmin(
  token,
  data
) {

  requireAdmin_(token);

  return createAdmin_(
    data.Nama,
    data.Email,
    data.Password,
    data.Role || 'GURU'
  );
}

function updateAdmin(
  token,
  id,
  data
) {

  requireAdmin_(token);

  const clean = {

    Nama:
      String(data.Nama || '')
        .trim(),

    Email:
      String(data.Email || '')
        .trim()
        .toLowerCase(),

    Role:
      String(data.Role || 'GURU')
        .toUpperCase(),

    Status:
      String(data.Status || 'ACTIVE')
        .toUpperCase()
  };

  if (
    !clean.Nama ||
    !clean.Email
  ) {
    throw new Error(
      'Nama dan email wajib diisi.'
    );
  }

  if (data.Password) {
    clean.PasswordHash =
      hash_(data.Password);
  }

  return updateById_(
    'Admin',
    'AdminID',
    id,
    clean
  );
}

function deleteAdmin(
  token,
  id
) {

  const current =
    requireAdmin_(token);

  if (
    String(current.AdminID) ===
    String(id)
  ) {
    throw new Error(
      'Admin yang sedang login tidak boleh dihapus.'
    );
  }

  const admins =
    rows_('Admin');

  if (
    admins.filter(function(a) {

      return String(a.Status || '')
        .toUpperCase() === 'ACTIVE';

    }).length <= 1
  ) {
    throw new Error(
      'Minimal harus ada satu admin aktif.'
    );
  }

  return deleteById_(
    'Admin',
    'AdminID',
    id
  );
}

/* =========================================================
   API SISWA ANDROID
   ========================================================= */

/* =========================
   HELPER SISWA
   ========================= */

function findStudentByEmail_(email) {

  const normalized =
    String(email || '')
      .trim()
      .toLowerCase();

  return rows_('Siswa').find(function(s) {

    return String(s.Email || '')
      .trim()
      .toLowerCase() === normalized &&

      String(s.Status || '')
        .toUpperCase() === 'ACTIVE';

  }) || null;
}

function findStudentById_(studentId) {

  return rows_('Siswa').find(function(s) {

    return String(s.StudentID) ===
      String(studentId);

  }) || null;
}

function studentHasExamInvitation_(
  studentId,
  examId
) {

  return rows_('Undangan').some(function(i) {

    return String(i.StudentID) ===
      String(studentId) &&

      String(i.ExamID) ===
      String(examId) &&

      String(i.Status || '')
        .toUpperCase() !== 'CANCELLED';

  });
}

function studentAlreadySubmitted_(
  studentId,
  examId
) {

  return rows_('Nilai').some(function(r) {

    return String(r.StudentID) ===
      String(studentId) &&

      String(r.ExamID) ===
      String(examId);

  });
}
/* =========================
   LOGIN SISWA
   ========================= */

function loginStudentApi_(data) {

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const password =
    String(data.password || '');

  if (!email || !password) {

    return {

      ok: false,

      message:
        'Email dan password wajib diisi.'
    };
  }

  const student =
    rows_('Siswa').find(function(s) {

      return String(s.Email || '')
        .trim()
        .toLowerCase() === email &&

        String(s.PasswordHash || '') ===
        hash_(password) &&

        String(s.Status || '')
          .toUpperCase() === 'ACTIVE';

    });

  if (!student) {

    return {

      ok: false,

      message:
        'Email atau password salah.'
    };
  }

  return {

    ok: true,

    message:
      'Login berhasil.',

    studentId:
      student.StudentID,

    name:
      student.Nama,

    email:
      student.Email,

    kelas:
      student.Kelas || ''
  };
}

/* =========================
   REGISTER SISWA
   ========================= */

function registerStudentApi_(data) {

  const name =
    String(data.name || '')
      .trim();

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const password =
    String(data.password || '');

  if (!name) {

    return {

      ok: false,

      message:
        'Nama wajib diisi.'
    };
  }

  if (!email) {

    return {

      ok: false,

      message:
        'Email wajib diisi.'
    };
  }

  if (!password) {

    return {

      ok: false,

      message:
        'Password wajib diisi.'
    };
  }

  if (password.length < 6) {

    return {

      ok: false,

      message:
        'Password minimal 6 karakter.'
    };
  }

  const existing =
    rows_('Siswa').find(function(s) {

      return String(s.Email || '')
        .trim()
        .toLowerCase() === email;

    });

  if (existing) {

    return {

      ok: false,

      message:
        'Email sudah terdaftar.'
    };
  }

  const student =
    append_('Siswa', {

      StudentID:
        id_('STD'),

      Nama:
        name,

      Email:
        email,

      PasswordHash:
        hash_(password),

      Kelas:
        '',

      Status:
        'ACTIVE',

      CreatedAt:
        now_()
    });

  return {

    ok: true,

    message:
      'Pendaftaran berhasil.',

    studentId:
      student.StudentID,

    name:
      student.Nama,

    email:
      student.Email
  };
}

/* =========================
   DAFTAR UJIAN SISWA
   ========================= */

function getStudentExamsApi_(data) {

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const student =
    findStudentByEmail_(email);

  if (!student) {

    return {

      ok: false,

      message:
        'Siswa tidak ditemukan.',

      data: []
    };
  }

  const exams =
    rows_('Ujian');

  const invitations =
    rows_('Undangan');

  const invitedExamIds =
    invitations
      .filter(function(inv) {

        return String(inv.StudentID) ===
          String(student.StudentID) &&

          String(inv.Status || '')
            .toUpperCase() !==
            'CANCELLED';

      })
      .map(function(inv) {

        return String(inv.ExamID);

      });

  const result =
    exams
      .filter(function(exam) {

        return String(exam.Status || '')
          .toUpperCase() ===
          'PUBLISHED' &&

          invitedExamIds.includes(
            String(exam.ExamID)
          );

      })
      .map(function(exam) {

        return {

          id:
            exam.ExamID,

          title:
            exam.NamaUjian,

          subject:
            exam.Mapel || '',

          duration:
            exam.DurasiMenit,

          date:
            exam.Tanggal || '',

          startTime:
            exam.JamMulai || '',

          endTime:
            exam.JamSelesai || '',

          status:
            exam.Status
        };
      });

  return {

    ok: true,

    data:
      result
  };
}

/* =========================
   SOAL SISWA
   ========================= */

function getStudentQuestionsApi_(data) {

  const examId =
    String(data.examId || '')
      .trim();

  if (!examId) {

    return {

      ok: false,

      message:
        'ExamID wajib diisi.',

      data: []
    };
  }

  const exam =
    rows_('Ujian').find(function(e) {

      return String(e.ExamID) ===
        examId;

    });

  if (!exam) {

    return {

      ok: false,

      message:
        'Ujian tidak ditemukan.',

      data: []
    };
  }

  if (
    String(exam.Status || '')
      .toUpperCase() !==
    'PUBLISHED'
  ) {

    return {

      ok: false,

      message:
        'Ujian belum tersedia.',

      data: []
    };
  }

  const questions =
    rows_('Soal')
      .filter(function(q) {

        return String(q.ExamID) ===
          examId;

      })
      .map(function(q) {

        /*
         * SANGAT PENTING:
         * JawabanBenar tidak dikirim.
         */

        return {

          id:
            q.QuestionID,

          question:
            q.Pertanyaan,

          optionA:
            q.PilihanA,

          optionB:
            q.PilihanB,

          optionC:
            q.PilihanC,

          optionD:
            q.PilihanD
        };
      });

  return {

    ok: true,

    data:
      questions
  };
}

/* =========================
   SUBMIT UJIAN SISWA
   ========================= */

function submitStudentExamApi_(data) {

  const email = String(data.email || '').trim().toLowerCase();
  const examId = String(data.examId || '').trim();
  const answersRaw = data.answers;

  const student = findStudentByEmail_(email);
  if (!student) return { ok: false, message: 'Siswa tidak ditemukan.' };
  if (!examId) return { ok: false, message: 'ExamID wajib diisi.' };

  const exam = rows_('Ujian').find(function(e) {
    return String(e.ExamID) === examId;
  });
  if (!exam) return { ok: false, message: 'Ujian tidak ditemukan.' };
  if (String(exam.Status || '').toUpperCase() !== 'PUBLISHED') {
    return { ok: false, message: 'Ujian belum tersedia.' };
  }

  if (!studentHasExamInvitation_(student.StudentID, examId)) {
    return { ok: false, message: 'Anda tidak memiliki undangan untuk ujian ini.' };
  }

  let answers = {};
  try {
    if (typeof answersRaw === 'string') {
      answers = JSON.parse(answersRaw);
    } else if (answersRaw && typeof answersRaw === 'object') {
      answers = answersRaw;
    }
  } catch (err) {
    return { ok: false, message: 'Format jawaban tidak valid.' };
  }

  const questions = rows_('Soal').filter(function(q) {
    return String(q.ExamID) === examId;
  });
  if (!questions.length) {
    return { ok: false, message: 'Belum ada soal untuk ujian ini.' };
  }

  let benar = 0;
  let salah = 0;
  let totalBobot = 0;
  let bobotBenar = 0;
  const answerRows = [];
  const answerNow = now_();

  questions.forEach(function(q) {
    const questionId = String(q.QuestionID);
    const answer = String(answers[questionId] || '').trim().toUpperCase();
    const correct = String(q.JawabanBenar || '').trim().toUpperCase();
    const bobot = safeNumber_(q.Bobot, 1) || 1;

    totalBobot += bobot;
    if (answer && answer === correct) {
      benar++;
      bobotBenar += bobot;
    } else {
      salah++;
    }

    answerRows.push({
      AnswerID: id_('ANS'),
      ExamID: examId,
      StudentID: student.StudentID,
      QuestionID: questionId,
      Jawaban: answer,
      Waktu: answerNow
    });
  });

  const nilai = totalBobot > 0
    ? Math.round((bobotBenar / totalBobot) * 10000) / 100
    : 0;

  /*
   * Final write dibuat dalam SATU lock dan tanpa verifikasi baca ulang.
   * Sebelumnya setiap helper melakukan flush + read-back sehingga submit
   * dapat terlambat walaupun data akhirnya berhasil tersimpan.
   */
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Cek ulang setelah memperoleh lock untuk mencegah submit ganda.
    if (studentAlreadySubmitted_(student.StudentID, examId)) {
      return {
        ok: false,
        message: 'Ujian ini sudah pernah dikumpulkan.'
      };
    }

    appendManyUnlocked_('Jawaban', answerRows);

    const resultObj = {
      ResultID: id_('RES'),
      ExamID: examId,
      StudentID: student.StudentID,
      Benar: benar,
      Salah: salah,
      Nilai: nilai,
      Status: 'SELESAI',
      Waktu: now_()
    };
    appendUnlocked_('Nilai', resultObj);

    const invitation = rows_('Undangan').find(function(i) {
      return String(i.ExamID) === examId &&
        String(i.StudentID) === String(student.StudentID) &&
        String(i.Status || '').toUpperCase() !== 'CANCELLED';
    });

    if (invitation) {
      updateByIdUnlocked_('Undangan', 'InviteID', invitation.InviteID, {
        Status: 'COMPLETED'
      });
    }

    // Satu flush untuk seluruh proses final submit.
    SpreadsheetApp.flush();

    return {
      ok: true,
      message: 'Jawaban berhasil dikirim.',
      result: {
        id: resultObj.ResultID,
        benar: benar,
        salah: salah,
        nilai: nilai,
        status: resultObj.Status
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function appendManyUnlocked_(sheetName, objects) {
  if (!objects || !objects.length) return;
  const sheet = sh_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = objects.map(function(obj) {
    return headers.map(function(h) {
      return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
    });
  });
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, headers.length).setValues(values);
}

function appendUnlocked_(sheetName, obj) {
  const sheet = sh_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = headers.map(function(h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
}

function updateByIdUnlocked_(sheetName, idField, id, data) {
  const sheet = sh_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Data tidak ditemukan.');

  const headers = values[0];
  const idCol = headers.indexOf(idField);
  if (idCol < 0) throw new Error('Kolom ID tidak ditemukan: ' + idField);

  let rowNumber = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      rowNumber = r + 1;
      break;
    }
  }
  if (rowNumber < 0) throw new Error('Data tidak ditemukan.');

  const updatedRow = values[rowNumber - 1].slice();
  Object.keys(data).forEach(function(field) {
    const col = headers.indexOf(field);
    if (col >= 0) updatedRow[col] = data[field];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updatedRow]);
}

/* =========================
   UNDANGAN SISWA
   ========================= */

function getStudentInvitationsApi_(data) {

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const student =
    findStudentByEmail_(email);

  if (!student) {

    return {

      ok: false,

      message:
        'Siswa tidak ditemukan.',

      data: []
    };
  }

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  const result =
    rows_('Undangan')
      .filter(function(inv) {

        return String(inv.StudentID) ===
          String(student.StudentID) &&

          String(inv.Status || '')
            .toUpperCase() !==
            'CANCELLED';

      })
      .map(function(inv) {

        const exam =
          exams[String(inv.ExamID)] ||
          {};

        return {

          id:
            inv.InviteID,

          examId:
            inv.ExamID,

          title:
            exam.NamaUjian ||
            inv.ExamID,

          status:
            inv.Status,

          date:
            exam.Tanggal || '',

          startTime:
            exam.JamMulai || '',

          endTime:
            exam.JamSelesai || '',

          text:
            (exam.NamaUjian ||
              inv.ExamID) +

            ' • ' +

            (exam.Tanggal ||
              '') +

            ' ' +

            (exam.JamMulai ||
              '') +

            ' • Status: ' +

            String(
              inv.Status || ''
            )
        };
      });

  return {

    ok: true,

    data:
      result
  };
}

/* =========================
   HASIL SISWA
   ========================= */

function getStudentResultsApi_(data) {

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const student =
    findStudentByEmail_(email);

  if (!student) {

    return {

      ok: false,

      message:
        'Siswa tidak ditemukan.',

      data: []
    };
  }

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  const result =
    rows_('Nilai')
      .filter(function(r) {

        return String(r.StudentID) ===
          String(student.StudentID);

      })
      .map(function(r) {

        const exam =
          exams[String(r.ExamID)] ||
          {};

        return {

          id:
            r.ResultID,

          examId:
            r.ExamID,

          title:
            exam.NamaUjian ||
            r.ExamID,

          benar:
            r.Benar,

          salah:
            r.Salah,

          nilai:
            r.Nilai,

          status:
            r.Status,

          waktu:
            r.Waktu,

          text:
            (exam.NamaUjian ||
              r.ExamID) +

            ' • Nilai: ' +

            String(r.Nilai) +

            ' • Benar: ' +

            String(r.Benar) +

            ' • Salah: ' +

            String(r.Salah)
        };
      });

  return {

    ok: true,

    data:
      result
  };
}

/* =========================
   PENGINGAT SISWA
   ========================= */

function getStudentRemindersApi_(data) {

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  const student =
    findStudentByEmail_(email);

  if (!student) {

    return {

      ok: false,

      message:
        'Siswa tidak ditemukan.',

      data: []
    };
  }

  const exams =
    Object.fromEntries(
      rows_('Ujian').map(function(e) {

        return [
          String(e.ExamID),
          e
        ];

      })
    );

  const reminders =
    rows_('Pengingat');

  const result =
    reminders
      .filter(function(r) {

        const target =
          String(
            r.Target || 'SEMUA'
          ).trim();

        return (

          target.toUpperCase() ===
          'SEMUA'

        ) ||

        target ===
          String(student.StudentID)

        ||

        target.toLowerCase() ===
          email

        ||

        target ===
          String(student.Kelas || '');
      })
      .map(function(r) {

        const exam =
          exams[String(r.ExamID)] ||
          {};

        return {

          id:
            r.ReminderID,

          examId:
            r.ExamID,

          title:
            exam.NamaUjian ||
            r.ExamID,

          message:
            r.Pesan,

          waktu:
            r.Waktu,

          text:
            (exam.NamaUjian ||
              r.ExamID) +

            ' • ' +

            String(
              r.Pesan || ''
            )
        };
      });

  return {

    ok: true,

    data:
      result
  };
}

/* =========================
   HTML ESCAPE
   ========================= */

function escapeHtml_(value) {

  return String(
    value == null
      ? ''
      : value
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}
