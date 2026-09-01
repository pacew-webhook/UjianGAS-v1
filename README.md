# Ujian GAS Android + Admin Guru

Project ini adalah aplikasi ujian Android yang terhubung ke **satu backend Google Apps Script (GAS)** dan **satu Google Sheets database**.

## Arsitektur final

```text
Android APK
   |
   | POST: login / register / exams / questions / submit / ...
   v
Google Apps Script Web App
   |
   | admin-guru/Code.gs
   v
Google Sheets
   |
   +-- Admin
   +-- Siswa
   +-- Ujian
   +-- Soal
   +-- Undangan
   +-- Jawaban
   +-- Nilai
   +-- Pengingat
   +-- ExamSessions   (Anti-Cheat)
   +-- Violations     (Anti-Cheat)
   +-- AuditLogs       (Anti-Cheat)
```

### Fitur Anti-Cheat & Exam Proctoring

Lihat `PRD_UjianGAS_AntiCheat_Exam_Proctoring.md` untuk spesifikasi lengkap.
Implementasi saat ini mencakup:

- **Android:** Exam Full Screen, FLAG_SECURE (cegah screenshot & screen
  recording), Lock Task/kiosk best-effort, deteksi app background &
  split-screen/multi-window, proteksi copy/paste pada soal, dialog
  Peringatan/Kunci/Terminasi, PIN Pengawas, heartbeat berkala, dan antrian
  pelanggaran offline (`ViolationQueue`) yang otomatis dikirim ulang saat
  koneksi pulih.
- **Backend:** sheet `ExamSessions`, `Violations`, `AuditLogs`; action baru
  `violation`, `violation_batch`, `heartbeat`, `unlock`; validasi sesi & PIN
  Pengawas (hash+salt, bukan plaintext) di server.
- **Admin Guru:** menu **Monitoring** (status per siswa, jumlah pelanggaran,
  unlock/lock/force submit, audit log) dan pengaturan Anti-Cheat per ujian
  di form Buat/Edit Ujian (aktif/nonaktif tiap proteksi, batas pelanggaran,
  aksi setelah batas, PIN Pengawas).

**Setelah menarik pembaruan ini, jalankan ulang fungsi `setupDatabase()`**
di Apps Script Editor supaya sheet `ExamSessions`, `Violations`, `AuditLogs`,
dan kolom Anti-Cheat baru pada sheet `Ujian` otomatis dibuat (fungsi ini aman
dijalankan berulang kali; tidak menghapus data yang sudah ada).

Fitur proctoring lanjutan yang **belum** termasuk (sesuai bagian 20 PRD —
memang bukan MVP): Device Binding, Network Monitoring, Location
Verification, Camera/Face/AI Proctoring.

### Sumber backend resmi

**`admin-guru/Code.gs` adalah satu-satunya backend GAS untuk project ini.**

File lama `gas/Code.gs` yang menggunakan skema `Users / Exams / Questions` tidak lagi digunakan, karena tidak kompatibel dengan database Admin Guru.

`admin-guru/Updater.gs` adalah tool developer opsional untuk menyinkronkan source dari GitHub ke project Apps Script. **Updater bukan backend aplikasi.**

## Struktur project

- `app/` — aplikasi Android Kotlin
- `admin-guru/Code.gs` — backend GAS + Web App Admin + API Android
- `admin-guru/Index.html` — dashboard Admin Guru
- `admin-guru/Style.html` — CSS dashboard
- `admin-guru/JavaScript.html` — JavaScript dashboard
- `admin-guru/Updater.gs` — updater opsional, bukan backend
- `admin-guru/UjianGAS_Database_Template.xlsx` — template database
- `.github/workflows/build.yml` — build APK

## Setup backend GAS

1. Buat Google Sheets baru untuk database aplikasi.
2. Pastikan sheet berikut tersedia:
   `Admin`, `Siswa`, `Ujian`, `Soal`, `Undangan`, `Jawaban`, `Nilai`, `Pengingat`,
   `ExamSessions`, `Violations`, `AuditLogs` (tiga terakhir untuk Anti-Cheat;
   jalankan `setupDatabase()` untuk membuatnya otomatis).
3. Buka **Extensions → Apps Script**.
4. Buat file server-side bernama **`Code.gs`**.
5. Paste isi `admin-guru/Code.gs`.
6. Jika memakai dashboard Admin Guru, buat juga:
   - `Index.html`
   - `Style.html`
   - `JavaScript.html`
7. Di `Code.gs`, ubah:
   `SHEET_ID = 'ISI_GOOGLE_SHEET_ID_DI_SINI'`
   menjadi ID Google Sheets milik kamu.
8. Jalankan `setupDatabase()` satu kali.
9. Buat admin awal dengan konfigurasi yang kamu inginkan, lalu jalankan `createInitialAdmin()` satu kali. Setelah selesai, ubah/nonaktifkan kredensial contoh di source.
10. Deploy → **New deployment → Web app**.
11. **Execute as:** Me.
12. Atur akses sesuai kebutuhan. Untuk aplikasi siswa yang harus bisa login tanpa akun Google, gunakan pengaturan akses yang mengizinkan pengguna aplikasi mengakses Web App.
13. Salin URL deployment yang berakhiran `/exec`.

> **Update dari versi lama?** Cukup paste ulang `Code.gs` terbaru lalu jalankan `setupDatabase()` sekali lagi — aman diulang, hanya menambahkan kolom baru (`Salt`) ke sheet `Admin`/`Siswa` tanpa menghapus data. Tidak perlu jalankan `createInitialAdmin()` lagi; akun lama otomatis ter-upgrade ke skema password bersalt saat login berikutnya. Lalu deploy ulang sebagai versi baru (jangan bikin deployment baru, edit deployment aktif → New version).

> Jangan memakai `gas/Code.gs` sebagai backend. File tersebut berasal dari skema lama dan sengaja tidak lagi disertakan dalam source final.

## Hubungkan Android

Buka:

`app/src/main/java/com/example/ujian_gas/GasApi.kt`

Isi:

`PASTE_GAS_WEB_APP_URL_HERE`

dengan URL Web App milik kamu, misalnya URL deployment GAS sendiri.

Android dan Admin Guru sekarang harus menunjuk ke **deployment GAS yang sama**.

> Sejak revisi keamanan terbaru, endpoint `questions` juga membutuhkan parameter `email` (email siswa yang sedang login) selain `examId` — dipakai server untuk memvalidasi undangan ujian dan mengacak urutan soal per siswa. `MainActivity.kt` sudah mengirim ini secara otomatis; kalau ada client lain yang memanggil endpoint ini, pastikan ikut mengirim `email`.

## Build Android

Untuk build lokal:

```bash
./gradlew assembleDebug
```

Di Windows:

```bat
gradlew.bat assembleDebug
```

APK debug akan berada di:

`app/build/outputs/apk/debug/app-debug.apk`

GitHub Actions juga dapat digunakan melalui workflow `build.yml`.

## Catatan keamanan

Status per revisi terbaru:

- ✅ **Hashing password bersalt** — password admin/siswa baru dihash dengan salt unik per akun (`generateSalt_`, `hashPassword_`). Akun lama tanpa salt tetap bisa login (fallback ke skema lama) dan otomatis ter-upgrade begitu login berhasil (`migratePasswordIfNeeded_`).
- ✅ **Validasi waktu ujian di server** — `getStudentQuestionsApi_` dan `submitStudentExamApi_` sekarang mengecek `Tanggal`/`JamMulai`/`JamSelesai` ujian terhadap waktu server (`isExamWithinWindow_`), bukan hanya divalidasi di Android. Submit diberi toleransi 120 detik untuk keterlambatan jaringan.
- ✅ **Validasi undangan saat ambil soal** — `getStudentQuestionsApi_` sekarang juga mengecek siswa memang diundang ke ujian tersebut (sebelumnya hanya dicek saat submit).
- ✅ **Pengacakan soal per siswa** — urutan soal diacak per siswa dengan seed deterministik `StudentID:ExamID` (`seededShuffle_`), supaya tidak mudah saling contek dari urutan, tapi tetap konsisten kalau soal dimuat ulang.
- ✅ **Waktu mulai per siswa dilacak di server** — `MulaiPada` dicatat sekali di baris `Undangan` saat siswa pertama kali membuka soal (`getOrStartAttempt_`). Batas waktu pribadi = `MulaiPada + DurasiMenit`, dibatasi juga oleh `JamSelesai` ujian (`computePersonalDeadline_`). Menutup lalu membuka ulang aplikasi **tidak lagi mereset waktu pengerjaan** — timer di Android disinkronkan dari `remainingSeconds` yang dikirim server, bukan dihitung ulang dari nol di HP.
- ⚠️ Masih jadi rekomendasi untuk produksi dengan kebutuhan keamanan tinggi: rate limiting/lock akun setelah percobaan login gagal berulang, auto-save jawaban per soal (saat ini jawaban baru terkirim sekaligus di akhir), token/session yang lebih ketat, dan audit log aktivitas admin.

## Riwayat revisi

- **Revisi keamanan & anti-contek:**
  - Tambah kolom `Salt` di sheet `Admin` dan `Siswa`, kolom `MulaiPada` di sheet `Undangan` (otomatis dibuat ulang oleh `setupDatabase()`).
  - Tambah fungsi `generateSalt_`, `hashPassword_`, `verifyPassword_`, `migratePasswordIfNeeded_` di `Code.gs`.
  - Tambah fungsi `parseExamDateTime_`, `getExamWindow_`, `isExamWithinWindow_` di `Code.gs` untuk validasi jam ujian di server.
  - Tambah fungsi `stringToSeed_`, `mulberry32_`, `seededShuffle_` di `Code.gs` untuk pengacakan soal per siswa.
  - Tambah fungsi `findInvitation_`, `getOrStartAttempt_`, `computePersonalDeadline_` di `Code.gs` untuk melacak waktu mulai & batas waktu pribadi per siswa. Status undangan baru: `STARTED` (siswa sudah mulai mengerjakan, belum submit).
  - `getStudentQuestionsApi_` kini mewajibkan parameter `email`, memvalidasi undangan, mencatat/menghitung waktu, dan mengembalikan soal dalam urutan teracak per siswa beserta `remainingSeconds`.
  - `submitStudentExamApi_` menolak submit yang melewati batas waktu pribadi siswa (dengan toleransi jaringan 60 detik).
  - `MainActivity.kt`: pemanggilan endpoint `questions` diperbarui untuk menyertakan `email`; timer ujian kini disinkronkan dari `remainingSeconds` milik server pada setiap pemuatan soal, bukan dihitung ulang dari durasi lokal.

- **Revisi konfirmasi kirim jawaban:**
  - `MainActivity.kt`: tombol "Kirim Jawaban" (yang menggantikan "Berikutnya" di soal terakhir) tidak lagi langsung mengirim — muncul dialog konfirmasi (`confirmSubmitExam`) yang menyebutkan jumlah soal yang belum dijawab sebelum benar-benar submit. Mencegah submit tidak sengaja karena siswa mengira masih menekan tombol "Berikutnya".

- **Revisi cegah kerjakan-ulang ujian yang sudah dikumpulkan (terbaru):**
  - `getStudentExamsApi_` sekarang menyertakan `completed` dan `nilai` per ujian (dicek dari sheet `Nilai`), sehingga daftar ujian di Android bisa membedakan ujian yang belum dan sudah dikumpulkan.
  - `getStudentQuestionsApi_` menolak lebih awal (sebelum soal dikirim) kalau ujian itu sudah pernah dikumpulkan siswa tersebut — sebelumnya penolakan baru terjadi saat submit, jadi siswa bisa terlanjur membuka & menjawab ulang soal yang sia-sia.
  - `MainActivity.kt`: ujian yang sudah selesai ditampilkan dengan ikon ✅, subjudul nilai, dan tidak lagi membuka layar pengerjaan soal — tap-nya mengarah ke menu Hasil & Nilai.


## Import Bank Soal

Admin Guru menyediakan import Excel `.xlsx` pada menu Bank Soal. Ikuti petunjuk di `admin-guru/README.md`.

## Prinsip konsistensi project

Jangan membuat backend GAS kedua untuk aplikasi Android.

Jika ada perubahan API:
1. ubah `admin-guru/Code.gs`;
2. pastikan `GasApi.kt` tetap memakai endpoint yang sama;
3. uji login → daftar ujian → soal → submit;
4. baru deploy versi GAS baru.


## Alur sinkronisasi GAS dari GitHub

Repository ini adalah sumber kode. Script panjang `Code.gs` tidak perlu dipaste manual
ke editor Apps Script setiap kali ada perubahan.

Project Apps Script Admin Guru menggunakan `Updater.gs` untuk mengambil:
- `admin-guru/Code.gs`
- `admin-guru/Index.html`
- `admin-guru/JavaScript.html`
- `admin-guru/Style.html`

Konfigurasi yang bersifat rahasia/lokal disimpan di **Script Properties**, bukan di GitHub:
- `SHEET_ID` = ID spreadsheet database Admin Guru
- `INITIAL_ADMIN_EMAIL` = email admin awal (hanya saat membuat/reset admin awal)
- `INITIAL_ADMIN_PASSWORD` = password admin awal (hanya saat membuat/reset admin awal)
- `TARGET_SCRIPT_ID` = Script ID project Apps Script target untuk Updater
- `GITHUB_BASE` = URL folder raw GitHub `admin-guru/`

Dengan pola ini, update dari GitHub tidak menghapus Script Properties.


## Sinkronisasi source GitHub ke Apps Script

Jika `Code.gs` terlalu panjang untuk dipaste manual, gunakan project **UjianGAS Updater**.
Konfigurasikan `TARGET_SCRIPT_ID` dan `GITHUB_BASE` di Script Properties Updater, lalu jalankan
`testUpdater()` dan `updateBackend()`. Backend Web App tetap `admin-guru/Code.gs`.
