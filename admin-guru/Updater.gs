/**
 * UjianGAS Updater
 *
 * Sinkronisasi file Admin Guru dari GitHub ke project Apps Script target.
 *
 * Alur:
 * GitHub -> Updater V2 -> Apps Script API -> Admin Guru
 *
 * File yang disinkronkan:
 * - admin-guru/Code.gs -> target backend "Code" 
 * - admin-guru/Index.html -> target "Index"
 * - admin-guru/JavaScript.html -> target "JavaScript"
 * - admin-guru/Style.html -> target "Style"
 *
 * PENTING:
 * 1) Isi Script Properties TARGET_SCRIPT_ID dan GITHUB_BASE satu kali.
 * 2) Jangan mengganti URL Web App. Updater hanya memperbarui isi project.
 * 3) Script Properties tetap tersimpan di project dan tidak ikut ditimpa oleh GitHub.
 */

function updaterConfig_() {
  const props = PropertiesService.getScriptProperties();
  const targetScriptId = String(
    props.getProperty('TARGET_SCRIPT_ID') || ''
  ).trim();
  const githubBase = String(
    props.getProperty('GITHUB_BASE') || ''
  ).trim();

  if (!targetScriptId) {
    throw new Error(
      'Script Property TARGET_SCRIPT_ID belum diatur.'
    );
  }
  if (!githubBase) {
    throw new Error(
      'Script Property GITHUB_BASE belum diatur.'
    );
  }

  return {
    targetScriptId: targetScriptId,
    githubBase: githubBase.replace(/\/$/, '')
  };
}

// Nama file server-side pada project Admin Guru.
// Source resmi di repository menggunakan Code.gs.
// Apps Script API menggunakan nama file tanpa ekstensi: "Code".
const TARGET_BACKEND_NAME = 'Code';

const FILE_MAP = [
  { github: 'Code.gs', target: TARGET_BACKEND_NAME, type: 'SERVER_JS' },
  { github: 'Index.html', target: 'Index', type: 'HTML' },
  { github: 'JavaScript.html', target: 'JavaScript', type: 'HTML' },
  { github: 'Style.html', target: 'Style', type: 'HTML' }
];

function updateBackend() {
  validateConfig_();

  Logger.log('================================');
  Logger.log('UJIAN GAS UPDATER V2');
  Logger.log('================================');
  const cfg = updaterConfig_();
  Logger.log('Target Script ID: ' + cfg.targetScriptId);

  // 1. Ambil isi project target terlebih dahulu agar file lain tidak terhapus.
  const current = getProjectContent_();
  const files = current.files || [];
  Logger.log('File Admin Guru sebelum update: ' + files.length);

  // 2. Download source dari GitHub.
  const downloaded = FILE_MAP.map(function (m) {
    const content = fetchGitHub_(m.github);
    Logger.log('GitHub ' + m.github + ': ' + content.split(/\r?\n/).length + ' baris');
    return {
      name: m.target,
      type: m.type,
      source: content
    };
  });

  // 3. Ganti hanya file yang kita kelola. File lain dipertahankan.
  const replaceByName = {};
  downloaded.forEach(function (f) {
    replaceByName[f.name] = f;
  });

  const merged = files.map(function (f) {
    if (replaceByName[f.name]) {
      return {
        name: f.name,
        type: replaceByName[f.name].type,
        source: replaceByName[f.name].source
      };
    }
    return f;
  });

  // 4. Jika file belum ada di target, tambahkan.
  const existingNames = {};
  merged.forEach(function (f) { existingNames[f.name] = true; });
  downloaded.forEach(function (f) {
    if (!existingNames[f.name]) {
      merged.push({
        name: f.name,
        type: f.type,
        source: f.source
      });
      Logger.log('Menambahkan file baru: ' + f.name);
    }
  });

  // 5. Kirim seluruh project content kembali supaya file lain aman.
  const result = updateProjectContent_(merged);
  const resultFiles = result.files || [];

  // 6. Verifikasi: baca ulang project target dan cocokkan hash sederhana/isi.
  const verify = getProjectContent_();
  const verifyMap = {};
  (verify.files || []).forEach(function (f) { verifyMap[f.name] = f; });

  downloaded.forEach(function (expected) {
    const actual = verifyMap[expected.name];
    if (!actual) {
      throw new Error('Verifikasi gagal: file target tidak ditemukan: ' + expected.name);
    }
    if (actual.source !== expected.source) {
      throw new Error('Verifikasi gagal: isi berbeda untuk file ' + expected.name);
    }
    Logger.log('VERIFIKASI OK: ' + expected.name);
  });

  Logger.log('================================');
  Logger.log('UPDATE SEMUA FILE BERHASIL');
  Logger.log('Total file target setelah update: ' + resultFiles.length);
  Logger.log('================================');

  return {
    ok: true,
    message: 'Update semua file Admin Guru berhasil.',
    files: downloaded.map(function (f) { return f.name; }),
    totalTargetFiles: resultFiles.length
  };
}

function getProjectContent_() {
  const url =
    'https://script.googleapis.com/v1/projects/' +
    encodeURIComponent(updaterConfig_().targetScriptId) +
    '/content';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code !== 200) {
    throw new Error('GET Admin Guru gagal (' + code + '): ' + body);
  }

  return JSON.parse(body);
}

function updateProjectContent_(files) {
  const url =
    'https://script.googleapis.com/v1/projects/' +
    encodeURIComponent(updaterConfig_().targetScriptId) +
    '/content';

  const response = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ files: files }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code !== 200) {
    throw new Error('PUT Admin Guru gagal (' + code + '): ' + body);
  }

  return JSON.parse(body);
}

function fetchGitHub_(filename) {
  const url = updaterConfig_().githubBase + '/' + encodeURIComponent(filename);
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Accept': 'text/plain'
    }
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code !== 200) {
    throw new Error('GitHub gagal mengambil ' + filename + ' (' + code + '): ' + body.slice(0, 500));
  }

  if (!body || !body.trim()) {
    throw new Error('GitHub mengembalikan file kosong: ' + filename);
  }

  return body;
}

function validateConfig_() {
  const cfg = updaterConfig_();
  if (!cfg.targetScriptId) {
    throw new Error('TARGET_SCRIPT_ID belum diatur.');
  }
}

/** Tes koneksi tanpa mengubah project target. */
function testUpdaterV2() {
  validateConfig_();
  const current = getProjectContent_();
  Logger.log('Koneksi Admin Guru OK. File: ' + ((current.files || []).length));

  FILE_MAP.forEach(function (m) {
    const content = fetchGitHub_(m.github);
    Logger.log('GitHub OK: ' + m.github + ' (' + content.split(/\r?\n/).length + ' baris)');
  });

  Logger.log('TEST OK - belum ada perubahan pada Admin Guru.');
}

/**
/**
 * Alias utama untuk menjalankan sinkronisasi seluruh file Admin Guru.
 * Menggunakan updateBackend() yang ada di file ini.
 */
function updateAdminGuru() {
  return updateBackend();
}
