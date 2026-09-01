# Ujian GAS — Admin Guru

`admin-guru/Code.gs` adalah **backend GAS resmi** untuk Admin Guru sekaligus API yang dipakai aplikasi Android.

## File

- `Code.gs` — **backend utama**: `doGet()`, `doPost()`, database, API Android, dan fungsi Admin Guru.
- `Index.html` — struktur dashboard.
- `Style.html` — CSS dashboard.
- `JavaScript.html` — JavaScript dashboard.
- `Updater.gs` — tool developer opsional untuk sinkronisasi source dari GitHub.
- `UjianGAS_Database_Template.xlsx` — template spreadsheet.

> **Penting:** `Updater.gs` bukan backend Web App. Jangan mengganti `Code.gs` dengan `Updater.gs`.

## Database

Backend menggunakan satu Google Sheets dengan sheet:

`Admin`, `Siswa`, `Ujian`, `Soal`, `Undangan`, `Jawaban`, `Nilai`, `Pengingat`.

Aplikasi Android juga memakai database dan backend ini. Skema lama `Users / Exams / Questions` tidak digunakan lagi.

## Cara pasang

1. Buat atau buka Google Sheets untuk database.
2. Jika menggunakan template XLSX, upload lalu buka/konversi menjadi Google Sheets.
3. Buka **Extensions → Apps Script**.
4. Buat file server-side **`Code.gs`** dan paste isi `admin-guru/Code.gs`.
5. Buat tiga file HTML:
   - `Index.html`
   - `Style.html`
   - `JavaScript.html`
6. Di `Code.gs`, ubah:

```javascript
const SHEET_ID = 'ISI_GOOGLE_SHEET_ID_DI_SINI';
```

menjadi ID Google Sheets milik kamu.
7. Jalankan `setupDatabase()` satu kali.
8. Isi placeholder email/password di `createInitialAdmin()` dengan akun admin milik kamu sendiri, jalankan satu kali, lalu jangan commit kredensial asli ke GitHub.
9. Deploy → **New deployment → Web app**.
10. Pilih **Execute as: Me**.
11. Atur akses sesuai kebutuhan pengguna aplikasi.
12. Simpan URL deployment `/exec`.

## Hubungkan Android

Di:

`app/src/main/java/com/example/ujian_gas/GasApi.kt`

ubah:

```text
PASTE_GAS_WEB_APP_URL_HERE
```

menjadi URL deployment `/exec` dari **backend `Code.gs` yang sama**.

Jangan menggunakan URL deployment lama dari developer/project lain.

## Setelah mengubah backend

Jika Web App sebelumnya sudah pernah di-deploy, buat versi deployment baru:

**Deploy → Manage deployments → Edit → New version → Deploy**

Pastikan Android menggunakan URL deployment yang benar.

## Updater GitHub (opsional)

`Updater.gs` hanya diperlukan jika kamu memang ingin mengelola source melalui GitHub dan melakukan sinkronisasi ke Apps Script.

Sebelum digunakan, ubah placeholder:

```javascript
const TARGET_SCRIPT_ID = 'ISI_SCRIPT_ID_ADMIN_GURU_DI_SINI';

const GITHUB_BASE =
  'https://raw.githubusercontent.com/USERNAME/REPOSITORY/main/admin-guru/';
```

ke project dan repository milik kamu.

Updater tidak membutuhkan dan tidak boleh menggunakan ID project developer lama.

## Import Bank Soal Excel

Menu Bank Soal mendukung import `.xlsx`.

Kolom wajib:
- `Pertanyaan`
- `PilihanA`
- `PilihanB`
- `PilihanC`
- `PilihanD`
- `JawabanBenar`

`Bobot` bersifat opsional.

## Ringkasan arsitektur

```text
Android
   |
   +----> GAS Web App (admin-guru/Code.gs)
                    |
                    +----> Google Sheets
                    |       Admin
                    |       Siswa
                    |       Ujian
                    |       Soal
                    |       Undangan
                    |       Jawaban
                    |       Nilai
                    |       Pengingat
                    |
                    +----> Dashboard Admin Guru
```

Dengan struktur ini tidak ada lagi dua backend GAS yang berbeda di source utama.


## Konfigurasi sekali di Apps Script

Untuk backend `Code.gs`, simpan `SHEET_ID` di Project Settings > Script properties.
Jangan menaruh Spreadsheet ID di source GitHub.

Untuk updater, simpan:
- `TARGET_SCRIPT_ID`
- `GITHUB_BASE`

`Updater.gs` mengambil source terbaru dari GitHub sehingga `Code.gs` yang panjang tidak
perlu dipaste manual setiap kali ada revisi.

Untuk admin awal, simpan sementara:
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

Lalu jalankan `createInitialAdmin()`. Jika akun sudah ada, fungsi akan mengaktifkan akun
dan mereset password. Setelah login berhasil, jalankan `clearInitialAdminCredentials()`.
