/**
 * UjianGAS Updater
 *
 * Tool developer untuk menyinkronkan source Admin Guru dari GitHub
 * ke project Google Apps Script Admin Guru.
 *
 * ARSITEKTUR:
 *   GitHub -> project "UjianGAS Updater" -> Apps Script API -> Admin Guru
 *
 * FILE YANG DIKELOLA:
 *   admin-guru/Code.gs           -> Code
 *   admin-guru/Index.html        -> Index
 *   admin-guru/JavaScript.html   -> JavaScript
 *   admin-guru/Style.html        -> Style
 *
 * KONFIGURASI:
 *   TARGET_SCRIPT_ID disimpan di Project Settings > Script properties.
 *
 *   GitHub source sudah ditetapkan ke:
 *   https://github.com/pacew-webhook/UjianGAS-v1/tree/main/admin-guru
 *
 *   Raw source yang digunakan updater:
 *   https://raw.githubusercontent.com/pacew-webhook/UjianGAS-v1/main/admin-guru
 *
 * CATATAN:
 * - Tidak ada ID project/developer lama yang ditanam di source.
 * - Updater tidak mengubah Script Properties milik project target.
 * - Updater hanya mengganti file yang tercantum di FILE_MAP.
 * - File lain pada project target dipertahankan.
 * - SHEET_ID bukan konfigurasi Updater; SHEET_ID dibaca oleh Code.gs target.
 */

const GITHUB_BASE =
  'https://raw.githubusercontent.com/pacew-webhook/UjianGAS-v1/main/admin-guru';

const TARGET_BACKEND_NAME = 'Code';

const FILE_MAP = [
  { github: 'Code.gs', target: 'Code', type: 'SERVER_JS' },
  { github: 'Index.html', target: 'Index', type: 'HTML' },
  { github: 'JavaScript.html', target: 'JavaScript', type: 'HTML' },
  { github: 'Style.html', target: 'Style', type: 'HTML' }
];

/**
 * Membaca konfigurasi Updater dari Script Properties.
 * Hanya TARGET_SCRIPT_ID yang perlu diisi manual.
 */
function updaterConfig_() {
  const props = PropertiesService.getScriptProperties();

  const targetScriptId = String(
    props.getProperty('TARGET_SCRIPT_ID') || ''
  ).trim();

  if (!targetScriptId) {
    throw new Error(
      'TARGET_SCRIPT_ID belum diatur. ' +
      'Buka Project Settings > Script properties pada project Updater.'
    );
  }

  return {
    targetScriptId: targetScriptId,
    githubBase: GITHUB_BASE
  };
}

/**
 * Entry point utama.
 * Sinkronisasi source GitHub ke project Admin Guru.
 */
function updateBackend() {
  const cfg = updaterConfig_();

  Logger.log('========================================');
  Logger.log('UJIAN GAS UPDATER');
  Logger.log('========================================');
  Logger.log('Target Script ID: ' + cfg.targetScriptId);
  Logger.log('GitHub Base: ' + cfg.githubBase);

  // 1. Baca isi project target agar file yang tidak dikelola tetap dipertahankan.
  const current = getProjectContent_(cfg.targetScriptId);
  const currentFiles = current.files || [];

  Logger.log(
    'File target sebelum update: ' + currentFiles.length
  );

  // 2. Download semua file yang dikelola dari GitHub.
  const downloaded = FILE_MAP.map(function (mapping) {
    const source = fetchGitHub_(cfg.githubBase, mapping.github);

    Logger.log(
      'GitHub OK: ' +
      mapping.github +
      ' (' +
      source.split(/\r?\n/).length +
      ' baris)'
    );

    return {
      name: mapping.target,
      type: mapping.type,
      source: source
    };
  });

  // 3. Ganti file yang sudah ada.
  const downloadedByName = {};
  downloaded.forEach(function (file) {
    downloadedByName[file.name] = file;
  });

  const merged = currentFiles.map(function (file) {
    if (downloadedByName[file.name]) {
      return {
        name: file.name,
        type: downloadedByName[file.name].type,
        source: downloadedByName[file.name].source
      };
    }

    // Pertahankan file lain apa adanya.
    return file;
  });

  // 4. Tambahkan file yang belum ada di target.
  const existingNames = {};
  merged.forEach(function (file) {
    existingNames[file.name] = true;
  });

  downloaded.forEach(function (file) {
    if (!existingNames[file.name]) {
      merged.push(file);
      Logger.log('Menambahkan file: ' + file.name);
    }
  });

  // 5. Kirim seluruh isi project target kembali.
  updateProjectContent_(cfg.targetScriptId, merged);

  // 6. Verifikasi isi file yang dikelola.
  const verify = getProjectContent_(cfg.targetScriptId);
  const verifyFiles = verify.files || [];
  const verifyByName = {};

  verifyFiles.forEach(function (file) {
    verifyByName[file.name] = file;
  });

  downloaded.forEach(function (expected) {
    const actual = verifyByName[expected.name];

    if (!actual) {
      throw new Error(
        'Verifikasi gagal: file tidak ditemukan di target: ' +
        expected.name
      );
    }

    if (actual.source !== expected.source) {
      throw new Error(
        'Verifikasi gagal: isi file berbeda untuk ' +
        expected.name
      );
    }

    Logger.log('VERIFIKASI OK: ' + expected.name);
  });

  Logger.log('========================================');
  Logger.log('UPDATE BERHASIL');
  Logger.log('Total file target: ' + verifyFiles.length);
  Logger.log('========================================');

  return {
    ok: true,
    message: 'Update Admin Guru berhasil.',
    files: downloaded.map(function (file) {
      return file.name;
    }),
    totalTargetFiles: verifyFiles.length
  };
}

/**
 * Alias agar nama fungsi lama yang mungkin sudah dipakai
 * tetap dapat digunakan.
 */
function updateAdminGuru() {
  return updateBackend();
}

/**
 * Tes konfigurasi, koneksi target, dan akses GitHub.
 * TIDAK mengubah project Admin Guru.
 */
function testUpdater() {
  const cfg = updaterConfig_();

  Logger.log('=== TEST UPDATER ===');
  Logger.log('Target Script ID: ' + cfg.targetScriptId);
  Logger.log('GitHub Base: ' + cfg.githubBase);

  const current = getProjectContent_(cfg.targetScriptId);

  Logger.log(
    'Target Admin Guru dapat diakses. File: ' +
    ((current.files || []).length)
  );

  FILE_MAP.forEach(function (mapping) {
    const source = fetchGitHub_(cfg.githubBase, mapping.github);

    Logger.log(
      'GitHub OK: ' +
      mapping.github +
      ' (' +
      source.split(/\r?\n/).length +
      ' baris)'
    );
  });

  Logger.log('=== TEST BERHASIL. TIDAK ADA PERUBAHAN ===');

  return {
    ok: true,
    message: 'Koneksi Updater, GitHub, dan target berhasil diuji.',
    targetFiles: (current.files || []).length
  };
}

/**
 * Alias kompatibilitas dengan nama fungsi test versi sebelumnya.
 */
function testUpdaterV2() {
  return testUpdater();
}

/**
 * Mengambil isi project Apps Script target melalui Apps Script API.
 */
function getProjectContent_(targetScriptId) {
  const url =
    'https://script.googleapis.com/v1/projects/' +
    encodeURIComponent(targetScriptId) +
    '/content';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error(
      'GET project Admin Guru gagal (' +
      code +
      '): ' +
      body.slice(0, 1000)
    );
  }

  return JSON.parse(body);
}

/**
 * Menulis isi project Apps Script target melalui Apps Script API.
 */
function updateProjectContent_(targetScriptId, files) {
  const url =
    'https://script.googleapis.com/v1/projects/' +
    encodeURIComponent(targetScriptId) +
    '/content';

  const response = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      files: files
    }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error(
      'PUT project Admin Guru gagal (' +
      code +
      '): ' +
      body.slice(0, 1000)
    );
  }

  return JSON.parse(body);
}

/**
 * Mengambil satu file dari raw GitHub.
 */
function fetchGitHub_(githubBase, filename) {
  const url =
    githubBase.replace(/\/+$/, '') +
    '/' +
    encodeURIComponent(filename);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Accept: 'text/plain'
    }
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error(
      'GitHub gagal mengambil ' +
      filename +
      ' (' +
      code +
      '): ' +
      body.slice(0, 1000)
    );
  }

  if (!body || !body.trim()) {
    throw new Error(
      'GitHub mengembalikan file kosong: ' + filename
    );
  }

  return body;
}
