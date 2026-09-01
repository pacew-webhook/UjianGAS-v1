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
```

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
   `Admin`, `Siswa`, `Ujian`, `Soal`, `Undangan`, `Jawaban`, `Nilai`, `Pengingat`.
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

> Jangan memakai `gas/Code.gs` sebagai backend. File tersebut berasal dari skema lama dan sengaja tidak lagi disertakan dalam source final.

## Hubungkan Android

Buka:

`app/src/main/java/com/example/ujian_gas/GasApi.kt`

Isi:

`PASTE_GAS_WEB_APP_URL_HERE`

dengan URL Web App milik kamu, misalnya URL deployment GAS sendiri.

Android dan Admin Guru sekarang harus menunjuk ke **deployment GAS yang sama**.

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

Versi ini mempertahankan behavior aplikasi yang ada. Password siswa/admin pada database dan mekanisme session mengikuti implementasi backend saat ini. Untuk produksi dengan kebutuhan keamanan tinggi, pertimbangkan hashing yang konsisten, token/session yang lebih ketat, validasi waktu ujian di server, rate limiting, dan audit log.

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
