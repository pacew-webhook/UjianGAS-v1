function getRequiredScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || !String(value).trim()) {
    throw new Error(
      'Script Property ' + name + ' belum diatur. ' +
      'Buka Project Settings > Script properties.'
    );
  }
  return String(value).trim();
}

function getSheetId_() {
  return getRequiredScriptProperty_('SHEET_ID');
}
const SESSION_PREFIX = 'UGAS_ADMIN_SESSION_';
const SESSION_SECONDS = 21600; // 6 jam

function ss_() {
  return SpreadsheetApp.openById(getSheetId_());
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

      /* ===== Anti-Cheat & Exam Proctoring ===== */

      case 'violation':
        return jsonResponse_(reportViolationApi_(data));

      case 'violation_batch':
        return jsonResponse_(reportViolationBatchApi_(data));

      case 'heartbeat':
        return jsonResponse_(heartbeatApi_(data));

      case 'unlock':
        return jsonResponse_(unlockSessionWithPinApi_(data));

      case 'session_status':
        return jsonResponse_(getSessionStatusApi_(data));

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
      'Salt',
      'Role',
      'Status',
      'CreatedAt'
    ],

    Siswa: [
      'StudentID',
      'Nama',
      'Email',
      'PasswordHash',
      'Salt',
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
      'CreatedBy',
      // Konfigurasi Anti-Cheat & Exam Proctoring (PRD UjianGAS Anti-Cheat).
      'AntiCheatOn',
      'ExamLockOn',
      'PreventScreenshot',
      'PreventScreenRecording',
      'PreventCopyPaste',
      'DetectBackground',
      'DetectSplitScreen',
      'MaxViolations',
      'ActionAfterLimit',
      'RequireSupervisorPin',
      'SupervisorPinHash',
      'SupervisorPinSalt'
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
      'SentAt',
      'MulaiPada'
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
    ],

    /* =========================
       ANTI-CHEAT & EXAM PROCTORING
       (PRD_UjianGAS_AntiCheat_Exam_Proctoring.md)
       ========================= */

    ExamSessions: [
      'SessionID',
      'ExamID',
      'StudentID',
      'InviteID',
      'StartTime',
      'ExpectedEndTime',
      'ActualEndTime',
      'Status',
      'ViolationCount',
      'LastHeartbeat',
      'DeviceInfo',
      'AppVersion',
      'CreatedAt'
    ],

    Violations: [
      'ViolationID',
      'StudentID',
      'ExamID',
      'SessionID',
      'Type',
      'Severity',
      'Timestamp',
      'Description',
      'Device',
      'AppVersion',
      'Status',
      'CreatedAt'
    ],

    AuditLogs: [
      'AuditID',
      'ActorID',
      'ActorRole',
      'Action',
      'TargetID',
      'ExamID',
      'Timestamp',
      'Description'
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

  const normalized = email.toLowerCase();
  const existing = rows_('Admin').find(function(a) {
    return String(a.Email || '').trim().toLowerCase() === normalized;
  });

  if (existing) {
    const sheet = sh_('Admin');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowNumber = existing.__row;

    function setAdminField_(fieldName, value) {
      const colIndex = headers.indexOf(fieldName);
      if (colIndex >= 0) {
        sheet.getRange(rowNumber, colIndex + 1).setValue(value);
      }
    }

    const resetSalt = generateSalt_();
    setAdminField_('PasswordHash', hashPassword_(password, resetSalt));
    setAdminField_('Salt', resetSalt);
    setAdminField_('Status', 'ACTIVE');
    setAdminField_('Role', 'ADMIN');
    SpreadsheetApp.flush();

    return {
      ok: true,
      created: false,
      updated: true,
      message: 'Admin sudah ada. Password berhasil di-reset dan akun diaktifkan.',
      AdminID: existing.AdminID,
      Email: normalized
    };
  }

  return createAdmin_(
    'Administrator',
    normalized,
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

/*
 * generateSalt_ / hashPassword_
 * ------------------------------
 * Password baru (admin & siswa) dihash dengan salt unik per akun,
 * bukan lagi SHA-256 polos, supaya tidak rawan rainbow-table attack.
 *
 * Akun LAMA yang belum punya kolom Salt terisi tetap bisa login:
 * verifyPassword_() otomatis jatuh ke pengecekan hash_() lama (tanpa
 * salt) untuk akun tersebut, lalu diam-diam meng-upgrade akun itu ke
 * skema bersalt begitu login berhasil (lihat migratePasswordIfNeeded_
 * yang dipanggil dari loginAdmin dan loginStudentApi_).
 */
function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');
}

function hashPassword_(password, salt) {
  return hash_(String(salt || '') + ':' + String(password || ''));
}

/**
 * Mengecek password terhadap satu baris akun (Admin atau Siswa).
 * account harus punya field PasswordHash, dan boleh punya Salt (opsional).
 */
function verifyPassword_(account, password) {
  const salt = String(account.Salt || '');

  if (salt) {
    return String(account.PasswordHash || '') === hashPassword_(password, salt);
  }

  // Akun lama tanpa salt: cocokkan dengan skema lama.
  return String(account.PasswordHash || '') === hash_(password || '');
}

/**
 * Jika akun berhasil login memakai skema lama (tanpa salt), migrasikan
 * diam-diam ke PasswordHash bersalt supaya makin lama makin sedikit
 * akun yang masih pakai skema lemah.
 */
function migratePasswordIfNeeded_(sheetName, idField, account, password) {
  if (String(account.Salt || '')) return;

  try {
    const newSalt = generateSalt_();
    updateByIdUnlocked_(sheetName, idField, account[idField], {
      PasswordHash: hashPassword_(password, newSalt),
      Salt: newSalt
    });
  } catch (err) {
    // Migrasi gagal tidak boleh menggagalkan login yang sudah valid.
  }
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

  const salt = generateSalt_();

  return append_('Admin', {

    AdminID: id_('ADM'),

    Nama: String(nama).trim(),

    Email: normalized,

    PasswordHash: hashPassword_(password, salt),

    Salt: salt,

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

      String(a.Status || '')
        .toUpperCase() === 'ACTIVE' &&

      verifyPassword_(a, password || '');

  });

  if (!admin) {
    throw new Error(
      'Email atau password salah.'
    );
  }

  migratePasswordIfNeeded_('Admin', 'AdminID', admin, password || '');

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

    const startRow = sheet.getLastRow() + 1;

    // Cegah Google Sheets otomatis mengonversi string yang berbentuk
    // tanggal/jam (mis. "2026-09-01") menjadi tipe Date. Kalau dibiarkan,
    // pembacaan ulang di verifikasi (rows_) akan menghasilkan objek Date
    // yang tidak lagi sama secara string dengan data aslinya.
    headers.forEach(function(h, i) {
      // Jangan paksa format Plain Text untuk string KOSONG (placeholder
      // untuk kolom yang nanti diisi Date, mis. MulaiPada). Kalau '@'
      // dipasang di sini, kolom itu akan terkunci sebagai teks selamanya,
      // sehingga saat updateById_ menulis Date sungguhan ke sana nanti,
      // Sheets menyimpannya sebagai teks (bukan serial tanggal) dan
      // verifikasi pada updateById_ gagal (lihat komentar di updateById_).
      if (typeof values[i] === 'string' && values[i] !== '') {
        sheet.getRange(startRow, i + 1).setNumberFormat('@');
      }
    });

    sheet.getRange(startRow, 1, 1, headers.length).setValues([values]);
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
        const cell = sheet.getRange(row.__row, i + 1);
        // Sama seperti di append_: paksa format Plain Text untuk nilai
        // string NON-KOSONG supaya Sheets tidak mengonversinya jadi Date
        // secara diam-diam. String kosong tidak perlu (dan tidak boleh)
        // dipaksa '@', karena kolom itu (mis. MulaiPada) sering diisi
        // string kosong dulu lalu Date sungguhan belakangan — kalau '@'
        // terlanjur terpasang dari update sebelumnya, sel itu perlu
        // dikembalikan ke format umum di sini supaya Date tersimpan
        // sebagai serial tanggal, bukan teks (penyebab error
        // "Perubahan gagal diverifikasi pada kolom ...").
        if (typeof data[h] === 'string' && data[h] !== '') {
          cell.setNumberFormat('@');
        } else if (data[h] instanceof Date) {
          cell.setNumberFormat('General');
        }
        cell.setValue(data[h]);
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

/*
 * Validasi jendela waktu ujian (Tanggal + JamMulai/JamSelesai).
 * Sebelumnya validasi ini hanya dilakukan di Android (client), sehingga
 * seseorang yang memanggil endpoint langsung bisa mengambil/mengirim
 * jawaban di luar jam ujian. Sekarang dicek juga di server.
 */
function parseExamDateTime_(tanggal, jam) {
  const dateParts = String(tanggal || '').trim().split('-');
  const timeParts = String(jam || '').trim().split(':');

  if (dateParts.length < 3 || timeParts.length < 2) return null;

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);

  if ([year, month, day, hour, minute].some(function(n) { return isNaN(n); })) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0);
}

function getExamWindow_(exam) {
  const start = parseExamDateTime_(exam.Tanggal, exam.JamMulai);
  const end = parseExamDateTime_(exam.Tanggal, exam.JamSelesai);

  if (!start || !end) return null;

  return { start: start, end: end };
}

/**
 * allowGraceSeconds: toleransi tambahan di akhir jendela waktu
 * (dipakai saat submit, supaya jawaban yang dikirim tepat saat waktu
 * habis tidak ditolak hanya karena keterlambatan jaringan).
 */
function isExamWithinWindow_(exam, allowGraceSeconds) {
  const window = getExamWindow_(exam);

  // Data Tanggal/Jam tidak lengkap/tidak valid -> jangan blokir,
  // supaya data ujian lama yang belum rapi tidak tiba-tiba terkunci.
  if (!window) return true;

  const grace = safeNumber_(allowGraceSeconds, 0) * 1000;
  const t = now_().getTime();

  return t >= window.start.getTime() && t <= (window.end.getTime() + grace);
}

/*
 * Pengacakan soal deterministik per siswa+ujian.
 * Dua siswa dengan seed berbeda akan mendapat urutan berbeda, tapi
 * siswa yang sama yang memuat ulang soal ujian yang sama akan selalu
 * mendapat urutan yang persis sama (penting kalau koneksi terputus
 * di tengah ujian dan soal dimuat ulang).
 */
function stringToSeed_(str) {
  let h = 0;
  const s = String(str);

  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }

  return h >>> 0;
}

function mulberry32_(seed) {
  let a = seed >>> 0;

  return function() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle_(array, seedString) {
  const arr = array.slice();
  const rand = mulberry32_(stringToSeed_(seedString));

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr;
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

  return clientRows_('Ujian').map(sanitizeExamForClient_);
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

  const antiCheat = buildAntiCheatFields_(data, null);

  return clientSafe_(sanitizeExamForClient_(append_('Ujian', Object.assign({

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
  }, antiCheat))));
}

/* =========================
   ANTI-CHEAT CONFIG HELPERS (per exam)
   ========================= */

/**
 * Konversi checkbox/boolean dari form Admin Guru menjadi 'ON'/'OFF'.
 * Checkbox HTML yang tidak dicentang tidak mengirim field sama sekali,
 * jadi field yang benar-benar hilang dianggap OFF, BUKAN memakai default.
 */
function onOff_(value, defaultOn) {
  if (value === undefined) return defaultOn ? 'ON' : 'OFF';
  const v = String(value).trim().toUpperCase();
  if (v === 'ON' || v === 'TRUE' || v === '1' || v === 'YES') return 'ON';
  if (v === 'OFF' || v === 'FALSE' || v === '0' || v === 'NO' || v === '') return 'OFF';
  return defaultOn ? 'ON' : 'OFF';
}

/**
 * existing: baris Ujian yang sudah ada (untuk update, supaya PIN yang tidak
 * diubah tetap dipertahankan), atau null untuk ujian baru.
 */
function buildAntiCheatFields_(data, existing) {
  const hasPinField = data.SupervisorPin !== undefined;
  const newPin = String(data.SupervisorPin || '').trim();

  let pinHash = existing ? String(existing.SupervisorPinHash || '') : '';
  let pinSalt = existing ? String(existing.SupervisorPinSalt || '') : '';

  if (hasPinField && newPin) {
    if (newPin.length < 4) {
      throw new Error('PIN Pengawas minimal 4 digit.');
    }
    pinSalt = generateSalt_();
    pinHash = hashPassword_(newPin, pinSalt);
  }

  const maxViolations = safeNumber_(data.MaxViolations, 3);

  return {
    AntiCheatOn: onOff_(data.AntiCheatOn, true),
    ExamLockOn: onOff_(data.ExamLockOn, true),
    PreventScreenshot: onOff_(data.PreventScreenshot, true),
    PreventScreenRecording: onOff_(data.PreventScreenRecording, true),
    PreventCopyPaste: onOff_(data.PreventCopyPaste, true),
    DetectBackground: onOff_(data.DetectBackground, true),
    DetectSplitScreen: onOff_(data.DetectSplitScreen, true),
    MaxViolations: maxViolations > 0 ? maxViolations : 3,
    ActionAfterLimit: String(data.ActionAfterLimit || 'LOCK').trim().toUpperCase() === 'TERMINATE' ? 'TERMINATE' : 'LOCK',
    RequireSupervisorPin: onOff_(data.RequireSupervisorPin, true),
    SupervisorPinHash: pinHash,
    SupervisorPinSalt: pinSalt
  };
}

/**
 * Data Ujian yang dikirim ke Admin Guru TIDAK BOLEH menyertakan hash/salt
 * PIN Pengawas. Diganti dengan flag SupervisorPinSet supaya UI tahu
 * apakah PIN sudah pernah diisi tanpa membocorkan nilainya.
 */
function sanitizeExamForClient_(exam) {
  const out = Object.assign({}, exam);
  out.SupervisorPinSet = !!String(out.SupervisorPinHash || '');
  delete out.SupervisorPinHash;
  delete out.SupervisorPinSalt;
  return out;
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

  const existing = rows_('Ujian').find(function(e) {
    return String(e.ExamID) === String(id);
  });
  if (!existing) {
    throw new Error('Ujian tidak ditemukan.');
  }

  const antiCheat = buildAntiCheatFields_(data, existing);

  return updateById_(
    'Ujian',
    'ExamID',
    id,
    Object.assign({

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
    }, antiCheat)
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

/* =========================
   ADMIN - MONITORING ANTI-CHEAT
   ========================= */

/**
 * Dashboard Pengawasan (bagian 11 PRD): daftar siswa per ujian beserta
 * status sesi dan jumlah pelanggaran.
 */
function getExamMonitoring(token, examId) {

  requireAdmin_(token);

  if (!examId) {
    throw new Error('Ujian wajib dipilih.');
  }

  const students = Object.fromEntries(
    rows_('Siswa').map(function(s) { return [String(s.StudentID), s]; })
  );

  const invitations = rows_('Undangan').filter(function(i) {
    return String(i.ExamID) === String(examId) &&
      String(i.Status || '').toUpperCase() !== 'CANCELLED';
  });

  const sessions = rows_('ExamSessions').filter(function(s) {
    return String(s.ExamID) === String(examId);
  });

  const sessionByStudent = {};
  sessions.forEach(function(s) {
    // Ambil sesi terakhir per siswa.
    sessionByStudent[String(s.StudentID)] = s;
  });

  const rowsOut = invitations.map(function(inv) {
    const student = students[String(inv.StudentID)] || {};
    const session = sessionByStudent[String(inv.StudentID)] || null;

    return {
      StudentID: inv.StudentID,
      Nama: student.Nama || inv.StudentID,
      Email: student.Email || '',
      Kelas: student.Kelas || '',
      InviteStatus: inv.Status || '',
      SessionID: session ? session.SessionID : '',
      SessionStatus: session ? session.Status : 'NOT_STARTED',
      ViolationCount: session ? safeNumber_(session.ViolationCount, 0) : 0,
      LastHeartbeat: session ? session.LastHeartbeat : '',
      StartTime: session ? session.StartTime : ''
    };
  });

  const summary = {
    total: rowsOut.length,
    active: rowsOut.filter(function(r) { return ['ACTIVE', 'WARNING'].indexOf(r.SessionStatus) >= 0; }).length,
    locked: rowsOut.filter(function(r) { return r.SessionStatus === 'LOCKED'; }).length,
    completed: rowsOut.filter(function(r) { return ['SUBMITTED', 'FORCE_SUBMITTED'].indexOf(r.SessionStatus) >= 0; }).length,
    terminated: rowsOut.filter(function(r) { return r.SessionStatus === 'TERMINATED'; }).length,
    violations: rowsOut.reduce(function(sum, r) { return sum + (r.ViolationCount || 0); }, 0)
  };

  return clientSafe_({ summary: summary, students: rowsOut });
}

function getSessionViolations(token, sessionId) {

  requireAdmin_(token);

  if (!sessionId) throw new Error('SessionID wajib diisi.');

  return clientSafe_(rows_('Violations')
    .filter(function(v) { return String(v.SessionID) === String(sessionId); })
    .sort(function(a, b) { return new Date(a.Timestamp) - new Date(b.Timestamp); }));
}

function lockSession(token, sessionId) {

  const admin = requireAdmin_(token);

  const session = findSession_(sessionId);
  if (!session) throw new Error('Sesi ujian tidak ditemukan.');

  updateById_('ExamSessions', 'SessionID', sessionId, { Status: 'LOCKED' });
  auditLog_(admin.AdminID, admin.Role, 'LOCK_STUDENT', sessionId, session.ExamID, 'Sesi dikunci manual oleh ' + admin.Nama + '.');

  return { ok: true };
}

function unlockSession(token, sessionId) {

  const admin = requireAdmin_(token);

  const session = findSession_(sessionId);
  if (!session) throw new Error('Sesi ujian tidak ditemukan.');

  if (String(session.Status).toUpperCase() === 'TERMINATED') {
    throw new Error('Sesi sudah dihentikan dan tidak dapat dibuka kembali.');
  }

  updateById_('ExamSessions', 'SessionID', sessionId, { Status: 'ACTIVE' });
  auditLog_(admin.AdminID, admin.Role, 'UNLOCK_STUDENT', sessionId, session.ExamID, 'Sesi dibuka manual oleh ' + admin.Nama + '.');

  return { ok: true };
}

/**
 * Force Submit (bagian 13 PRD). Karena jawaban siswa hanya tersimpan di
 * server saat submit final, Force Submit oleh Guru menutup sesi ujian
 * dan mencatat hasil TIDAK SELESAI (nilai dari jawaban yang sempat
 * dikirim tetap tersimpan terpisah jika submit sempat terjadi sebelumnya).
 */
function forceSubmitSession(token, sessionId) {

  const admin = requireAdmin_(token);

  const session = findSession_(sessionId);
  if (!session) throw new Error('Sesi ujian tidak ditemukan.');

  const closed = ['SUBMITTED', 'FORCE_SUBMITTED', 'TERMINATED'];
  if (closed.indexOf(String(session.Status).toUpperCase()) >= 0) {
    throw new Error('Sesi ini sudah berakhir.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!studentAlreadySubmitted_(session.StudentID, session.ExamID)) {
      appendUnlocked_('Nilai', {
        ResultID: id_('RES'),
        ExamID: session.ExamID,
        StudentID: session.StudentID,
        Benar: 0,
        Salah: 0,
        Nilai: 0,
        Status: 'FORCE_SUBMITTED',
        Waktu: now_()
      });

      const invitation = rows_('Undangan').find(function(i) {
        return String(i.ExamID) === String(session.ExamID) &&
          String(i.StudentID) === String(session.StudentID) &&
          String(i.Status || '').toUpperCase() !== 'CANCELLED';
      });
      if (invitation) {
        updateByIdUnlocked_('Undangan', 'InviteID', invitation.InviteID, { Status: 'COMPLETED' });
      }
    }

    updateByIdUnlocked_('ExamSessions', 'SessionID', sessionId, {
      Status: 'FORCE_SUBMITTED',
      ActualEndTime: now_()
    });

    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  auditLog_(admin.AdminID, admin.Role, 'FORCE_SUBMIT', sessionId, session.ExamID, 'Ujian diakhiri paksa oleh ' + admin.Nama + '.');

  return { ok: true };
}

function getAuditLogs(token, examId) {

  requireAdmin_(token);

  return clientSafe_(rows_('AuditLogs')
    .filter(function(a) { return !examId || String(a.ExamID) === String(examId); })
    .sort(function(a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); }));
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

function findInvitation_(studentId, examId) {

  return rows_('Undangan').find(function(i) {

    return String(i.StudentID) === String(studentId) &&
      String(i.ExamID) === String(examId) &&
      String(i.Status || '').toUpperCase() !== 'CANCELLED';

  }) || null;
}

/**
 * Catat waktu mulai pengerjaan siswa untuk satu ujian, HANYA sekali
 * (percobaan pertama kali soal diminta). Panggilan berikutnya akan
 * mengembalikan MulaiPada yang sudah tersimpan, bukan menimpanya —
 * ini yang membuat "tutup lalu buka lagi aplikasi" tidak bisa dipakai
 * untuk mereset waktu pengerjaan.
 */
function getOrStartAttempt_(invitation, exam) {

  if (invitation.MulaiPada) {
    const existing = new Date(invitation.MulaiPada);
    if (!isNaN(existing.getTime())) return existing;
  }

  const startedAt = now_();

  updateById_('Undangan', 'InviteID', invitation.InviteID, {
    MulaiPada: startedAt,
    Status: 'STARTED'
  });

  return startedAt;
}

/**
 * Batas waktu pribadi siswa untuk ujian ini: mulai + durasi, tapi
 * tidak boleh melewati jam selesai keseluruhan ujian (kalau ada).
 */
function computePersonalDeadline_(startedAt, exam) {

  const durationMinutes = safeNumber_(exam.DurasiMenit, 0);
  const byDuration = new Date(startedAt.getTime() + durationMinutes * 60000);

  const window = getExamWindow_(exam);
  if (window && window.end.getTime() < byDuration.getTime()) {
    return window.end;
  }

  return byDuration;
}

/* =========================
   EXAM SESSION (Anti-Cheat)
   ========================= */

function findSession_(sessionId) {
  return rows_('ExamSessions').find(function(s) {
    return String(s.SessionID) === String(sessionId);
  }) || null;
}

function findActiveSessionFor_(studentId, examId) {
  const sessions = rows_('ExamSessions').filter(function(s) {
    return String(s.StudentID) === String(studentId) &&
      String(s.ExamID) === String(examId);
  });
  // Ambil sesi paling akhir yang dibuat (baris terbawah).
  return sessions.length ? sessions[sessions.length - 1] : null;
}

/**
 * Membuat ExamSession baru untuk percobaan siswa ini kalau belum ada,
 * atau mengembalikan sesi yang sudah aktif (belum SUBMITTED/TERMINATED)
 * supaya tutup-buka aplikasi tidak membuat sesi ganda.
 */
function ensureExamSession_(student, exam, invitation, deadline) {
  const existing = findActiveSessionFor_(student.StudentID, exam.ExamID);

  const closedStates = ['SUBMITTED', 'FORCE_SUBMITTED', 'TERMINATED', 'EXPIRED'];

  if (existing && closedStates.indexOf(String(existing.Status || '').toUpperCase()) < 0) {
    return existing;
  }

  const session = {
    SessionID: id_('SES'),
    ExamID: exam.ExamID,
    StudentID: student.StudentID,
    InviteID: invitation.InviteID,
    StartTime: now_(),
    ExpectedEndTime: deadline,
    ActualEndTime: '',
    Status: 'ACTIVE',
    ViolationCount: 0,
    LastHeartbeat: now_(),
    DeviceInfo: '',
    AppVersion: '',
    CreatedAt: now_()
  };

  return append_('ExamSessions', session);
}

function examAntiCheatConfig_(exam) {
  return {
    antiCheatOn: String(exam.AntiCheatOn || 'ON').toUpperCase() !== 'OFF',
    examLockOn: String(exam.ExamLockOn || 'ON').toUpperCase() !== 'OFF',
    preventScreenshot: String(exam.PreventScreenshot || 'ON').toUpperCase() !== 'OFF',
    preventScreenRecording: String(exam.PreventScreenRecording || 'ON').toUpperCase() !== 'OFF',
    preventCopyPaste: String(exam.PreventCopyPaste || 'ON').toUpperCase() !== 'OFF',
    detectBackground: String(exam.DetectBackground || 'ON').toUpperCase() !== 'OFF',
    detectSplitScreen: String(exam.DetectSplitScreen || 'ON').toUpperCase() !== 'OFF',
    maxViolations: safeNumber_(exam.MaxViolations, 3) || 3,
    actionAfterLimit: String(exam.ActionAfterLimit || 'LOCK').toUpperCase() === 'TERMINATE' ? 'TERMINATE' : 'LOCK',
    requireSupervisorPin: String(exam.RequireSupervisorPin || 'ON').toUpperCase() !== 'OFF'
  };
}

function auditLog_(actorId, actorRole, action, targetId, examId, description) {
  try {
    append_('AuditLogs', {
      AuditID: id_('A'),
      ActorID: actorId || '',
      ActorRole: actorRole || '',
      Action: action || '',
      TargetID: targetId || '',
      ExamID: examId || '',
      Timestamp: now_(),
      Description: description || ''
    });
  } catch (err) {
    // Audit log tidak boleh menggagalkan aksi utama.
  }
}

/**
 * Rules Engine sederhana (bagian 19 PRD):
 * 0 pelanggaran -> ACTIVE, 1..(max-1) -> WARNING, >= max -> policy Guru.
 */
function nextStatusAfterViolation_(currentStatus, violationCount, exam) {
  const closed = ['SUBMITTED', 'FORCE_SUBMITTED', 'TERMINATED', 'EXPIRED'];
  if (closed.indexOf(String(currentStatus || '').toUpperCase()) >= 0) {
    return String(currentStatus).toUpperCase();
  }

  const max = safeNumber_(exam.MaxViolations, 3) || 3;

  if (violationCount >= max) {
    const action = String(exam.ActionAfterLimit || 'LOCK').toUpperCase();
    return action === 'TERMINATE' ? 'TERMINATED' : 'LOCKED';
  }

  if (violationCount > 0) return 'WARNING';
  return 'ACTIVE';
}

/* =========================
   API SISWA — VIOLATION / HEARTBEAT / UNLOCK
   ========================= */

function reportViolationApi_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const examId = String(data.examId || '').trim();
  const sessionId = String(data.sessionId || '').trim();
  const type = String(data.type || '').trim().toUpperCase();
  const severity = String(data.severity || 'WARNING').trim().toUpperCase();
  const description = String(data.description || '').trim();
  const device = String(data.device || '').trim();
  const appVersion = String(data.appVersion || '').trim();

  const student = findStudentByEmail_(email);
  if (!student) return { ok: false, message: 'Siswa tidak ditemukan.' };
  if (!examId || !sessionId || !type) {
    return { ok: false, message: 'examId, sessionId, dan type wajib diisi.' };
  }

  const exam = rows_('Ujian').find(function(e) { return String(e.ExamID) === examId; });
  if (!exam) return { ok: false, message: 'Ujian tidak ditemukan.' };

  const session = findSession_(sessionId);
  if (!session || String(session.StudentID) !== String(student.StudentID) ||
      String(session.ExamID) !== examId) {
    return { ok: false, message: 'Sesi ujian tidak valid.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    append_('Violations', {
      ViolationID: id_('V'),
      StudentID: student.StudentID,
      ExamID: examId,
      SessionID: sessionId,
      Type: type,
      Severity: severity,
      Timestamp: now_(),
      Description: description,
      Device: device,
      AppVersion: appVersion,
      Status: 'RECORDED',
      CreatedAt: now_()
    });

    const freshSession = findSession_(sessionId);
    const newCount = safeNumber_(freshSession.ViolationCount, 0) + 1;
    const newStatus = nextStatusAfterViolation_(freshSession.Status, newCount, exam);

    updateByIdUnlocked_('ExamSessions', 'SessionID', sessionId, {
      ViolationCount: newCount,
      Status: newStatus,
      LastHeartbeat: now_()
    });
    SpreadsheetApp.flush();

    return {
      ok: true,
      violationCount: newCount,
      maxViolations: safeNumber_(exam.MaxViolations, 3) || 3,
      status: newStatus,
      requireSupervisorPin: String(exam.RequireSupervisorPin || 'ON').toUpperCase() !== 'OFF'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Batch untuk offline queue: array JSON berisi objek violation yang sama
 * seperti action 'violation'. Dipakai saat koneksi kembali setelah sempat
 * terputus supaya event yang tersimpan lokal tidak hilang.
 */
function reportViolationBatchApi_(data) {
  let items = [];
  try {
    items = JSON.parse(String(data.items || '[]'));
  } catch (err) {
    return { ok: false, message: 'Format batch tidak valid.' };
  }

  if (!Array.isArray(items) || !items.length) {
    return { ok: false, message: 'Tidak ada data pelanggaran pada batch ini.' };
  }

  let lastResult = null;
  let processed = 0;

  items.forEach(function(item) {
    const result = reportViolationApi_({
      email: data.email,
      examId: item.examId,
      sessionId: item.sessionId,
      type: item.type,
      severity: item.severity,
      description: item.description,
      device: item.device,
      appVersion: item.appVersion
    });
    if (result.ok) {
      processed++;
      lastResult = result;
    }
  });

  return Object.assign({ ok: processed > 0, processed: processed, total: items.length }, lastResult || {});
}

function heartbeatApi_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const examId = String(data.examId || '').trim();
  const sessionId = String(data.sessionId || '').trim();
  const remainingSeconds = safeNumber_(data.remainingSeconds, -1);
  const appState = String(data.appState || '').trim();

  const student = findStudentByEmail_(email);
  if (!student) return { ok: false, message: 'Siswa tidak ditemukan.' };

  const session = findSession_(sessionId);
  if (!session || String(session.StudentID) !== String(student.StudentID) ||
      String(session.ExamID) !== examId) {
    return { ok: false, message: 'Sesi ujian tidak valid.' };
  }

  updateByIdUnlocked_('ExamSessions', 'SessionID', sessionId, {
    LastHeartbeat: now_()
  });
  SpreadsheetApp.flush();

  // Heartbeat HANYA sinkronisasi status; tidak dipakai sebagai satu-satunya
  // bukti kecurangan (lihat bagian 15 PRD).
  return {
    ok: true,
    status: session.Status,
    violationCount: safeNumber_(session.ViolationCount, 0)
  };
}

function getSessionStatusApi_(data) {
  const sessionId = String(data.sessionId || '').trim();
  const session = findSession_(sessionId);
  if (!session) return { ok: false, message: 'Sesi ujian tidak ditemukan.' };
  return { ok: true, status: session.Status, violationCount: safeNumber_(session.ViolationCount, 0) };
}

/**
 * Siswa memasukkan PIN Pengawas pada dialog "UJIAN DIKUNCI" di Android.
 * PIN diverifikasi terhadap hash tersimpan pada Ujian (bukan plaintext).
 */
function unlockSessionWithPinApi_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const examId = String(data.examId || '').trim();
  const sessionId = String(data.sessionId || '').trim();
  const pin = String(data.pin || '').trim();

  const student = findStudentByEmail_(email);
  if (!student) return { ok: false, message: 'Siswa tidak ditemukan.' };

  const exam = rows_('Ujian').find(function(e) { return String(e.ExamID) === examId; });
  if (!exam) return { ok: false, message: 'Ujian tidak ditemukan.' };

  const session = findSession_(sessionId);
  if (!session || String(session.StudentID) !== String(student.StudentID) ||
      String(session.ExamID) !== examId) {
    return { ok: false, message: 'Sesi ujian tidak valid.' };
  }

  if (String(session.Status).toUpperCase() === 'TERMINATED') {
    return { ok: false, message: 'Ujian sudah dihentikan dan tidak dapat dibuka kembali.' };
  }

  if (String(session.Status).toUpperCase() !== 'LOCKED') {
    return { ok: true, status: session.Status, message: 'Sesi tidak dalam status terkunci.' };
  }

  const pinHash = String(exam.SupervisorPinHash || '');
  const pinSalt = String(exam.SupervisorPinSalt || '');

  if (!pinHash) {
    return { ok: false, message: 'PIN Pengawas belum diatur oleh Guru untuk ujian ini.' };
  }

  if (!pin || hashPassword_(pin, pinSalt) !== pinHash) {
    auditLog_(student.StudentID, 'STUDENT', 'UNLOCK_ATTEMPT_FAILED', session.SessionID, examId, 'PIN Pengawas salah.');
    return { ok: false, message: 'PIN Pengawas salah.' };
  }

  updateByIdUnlocked_('ExamSessions', 'SessionID', sessionId, { Status: 'ACTIVE' });
  SpreadsheetApp.flush();

  auditLog_(student.StudentID, 'SUPERVISOR', 'UNLOCK_STUDENT', session.SessionID, examId, 'Sesi dibuka kembali dengan PIN Pengawas.');

  return { ok: true, status: 'ACTIVE', message: 'Ujian dibuka kembali.' };
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

        String(s.Status || '')
          .toUpperCase() === 'ACTIVE' &&

        verifyPassword_(s, password);

    });

  if (!student) {

    return {

      ok: false,

      message:
        'Email atau password salah.'
    };
  }

  migratePasswordIfNeeded_('Siswa', 'StudentID', student, password);

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

  const registerSalt = generateSalt_();

  const student =
    append_('Siswa', {

      StudentID:
        id_('STD'),

      Nama:
        name,

      Email:
        email,

      PasswordHash:
        hashPassword_(password, registerSalt),

      Salt:
        registerSalt,

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

  const myResults =
    Object.fromEntries(
      rows_('Nilai')
        .filter(function(r) {

          return String(r.StudentID) ===
            String(student.StudentID);

        })
        .map(function(r) {

          return [String(r.ExamID), r];

        })
    );

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

        const myResult = myResults[String(exam.ExamID)] || null;

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
            exam.Status,

          completed:
            !!myResult,

          nilai:
            myResult ? myResult.Nilai : null
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

  const email =
    String(data.email || '')
      .trim()
      .toLowerCase();

  if (!examId) {

    return {

      ok: false,

      message:
        'ExamID wajib diisi.',

      data: []
    };
  }

  if (!email) {

    return {

      ok: false,

      message:
        'Email wajib diisi.',

      data: []
    };
  }

  const student = findStudentByEmail_(email);

  if (!student) {

    return {

      ok: false,

      message:
        'Siswa tidak ditemukan.',

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

  const invitation = findInvitation_(student.StudentID, examId);

  if (!invitation) {

    return {

      ok: false,

      message:
        'Anda tidak memiliki undangan untuk ujian ini.',

      data: []
    };
  }

  if (studentAlreadySubmitted_(student.StudentID, examId)) {

    return {

      ok: false,

      message:
        'Ujian ini sudah pernah Anda kerjakan dan dikumpulkan. Lihat nilainya di menu Hasil & Nilai.',

      data: []
    };
  }

  if (!isExamWithinWindow_(exam, 0)) {

    return {

      ok: false,

      message:
        'Ujian hanya dapat diakses pada jadwal yang ditentukan.',

      data: []
    };
  }

  // Catat waktu mulai (hanya sekali) dan hitung batas waktu pribadi
  // siswa ini untuk ujian ini. Membuka ulang aplikasi TIDAK mereset
  // waktu mulai, karena disimpan di server sejak percobaan pertama.
  const startedAt = getOrStartAttempt_(invitation, exam);
  const deadline = computePersonalDeadline_(startedAt, exam);
  const remainingSeconds =
    Math.floor((deadline.getTime() - now_().getTime()) / 1000);

  if (remainingSeconds <= 0) {

    return {

      ok: false,

      message:
        'Waktu pengerjaan Anda untuk ujian ini sudah habis.',

      data: []
    };
  }

  // Anti-Cheat: buat/ambil ExamSession untuk percobaan ini. Kalau sesi
  // sebelumnya sudah dikunci/diterminasi oleh sistem/Guru, siswa tidak
  // otomatis mendapat sesi baru yang bersih.
  const session = ensureExamSession_(student, exam, invitation, deadline);
  const sessionStatusUpper = String(session.Status || '').toUpperCase();

  if (sessionStatusUpper === 'TERMINATED') {
    return {
      ok: false,
      message: 'Ujian Anda telah dihentikan oleh sistem/pengawas. Jawaban terakhir telah disimpan.',
      data: [],
      sessionId: session.SessionID,
      sessionStatus: sessionStatusUpper
    };
  }

  const questions =
    // Diacak dengan seed StudentID+ExamID: urutan berbeda antar siswa,
    // tapi tetap konsisten jika siswa yang sama memuat ulang soal ini.
    seededShuffle_(
      rows_('Soal')
        .filter(function(q) {

          return String(q.ExamID) ===
            examId;

        }),
      student.StudentID + ':' + examId
    )
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
      questions,

    remainingSeconds:
      remainingSeconds,

    deadline:
      deadline,

    // Anti-Cheat & Exam Proctoring: session + config dikirim bersama soal
    // supaya Android dapat langsung mengaktifkan Exam Lock/monitoring.
    sessionId:
      session.SessionID,

    sessionStatus:
      sessionStatusUpper,

    violationCount:
      safeNumber_(session.ViolationCount, 0),

    antiCheat:
      examAntiCheatConfig_(exam)
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

  if (!isExamWithinWindow_(exam, 120)) {
    return { ok: false, message: 'Waktu ujian sudah berakhir atau belum dimulai.' };
  }

  const invitation = findInvitation_(student.StudentID, examId);
  if (!invitation) {
    return { ok: false, message: 'Anda tidak memiliki undangan untuk ujian ini.' };
  }

  // Anti-Cheat: sesi yang sedang terkunci wajib dibuka dengan PIN Pengawas
  // dulu sebelum jawaban dapat dikirim.
  const antiCheatSession = findActiveSessionFor_(student.StudentID, examId);
  if (antiCheatSession) {
    const st = String(antiCheatSession.Status || '').toUpperCase();
    if (st === 'LOCKED') {
      return { ok: false, message: 'Ujian sedang terkunci. Masukkan PIN Pengawas untuk melanjutkan.' };
    }
    if (st === 'TERMINATED') {
      return { ok: false, message: 'Ujian ini telah dihentikan oleh sistem/pengawas.' };
    }
  }

  // Kalau siswa ini sudah punya waktu mulai tercatat (dari saat ambil
  // soal), submit tidak boleh melewati batas waktu pribadinya + sedikit
  // toleransi jaringan. Kalau belum ada MulaiPada (kasus tidak normal),
  // biarkan lolos ke pengecekan jendela ujian di atas saja.
  if (invitation.MulaiPada) {
    const startedAt = new Date(invitation.MulaiPada);
    if (!isNaN(startedAt.getTime())) {
      const personalDeadline = computePersonalDeadline_(startedAt, exam);
      const graceMs = 60 * 1000;
      if (now_().getTime() > personalDeadline.getTime() + graceMs) {
        return { ok: false, message: 'Waktu pengerjaan Anda untuk ujian ini sudah habis.' };
      }
    }
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

    // Tutup ExamSession terkait (Anti-Cheat) supaya dashboard monitoring
    // Guru menampilkan status akhir yang benar.
    const session = findActiveSessionFor_(student.StudentID, examId);
    if (session && ['SUBMITTED', 'FORCE_SUBMITTED', 'TERMINATED'].indexOf(String(session.Status || '').toUpperCase()) < 0) {
      updateByIdUnlocked_('ExamSessions', 'SessionID', session.SessionID, {
        Status: 'SUBMITTED',
        ActualEndTime: now_()
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
    if (col >= 0) {
      updatedRow[col] = data[field];
      if (typeof data[field] === 'string' && data[field] !== '') {
        sheet.getRange(rowNumber, col + 1).setNumberFormat('@');
      } else if (data[field] instanceof Date) {
        sheet.getRange(rowNumber, col + 1).setNumberFormat('General');
      }
    }
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
