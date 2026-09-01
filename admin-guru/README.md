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

Jika kamu memakai GitHub sebagai sumber script panjang, **tidak perlu paste `Code.gs`
ribuan baris secara manual ke Apps Script**.

Project `UjianGAS Updater` menjalankan `Updater.gs` untuk mengambil file terbaru dari
GitHub lalu memperbarui project Apps Script Admin Guru melalui Apps Script API.

### File yang disinkronkan

- `admin-guru/Code.gs` → file server-side `Code`
- `admin-guru/Index.html` → `Index`
- `admin-guru/JavaScript.html` → `JavaScript`
- `admin-guru/Style.html` → `Style`

### Konfigurasi Updater

Pada **project Apps Script UjianGAS Updater**, buka:

**Project Settings → Script properties**

Tambahkan:

```text
TARGET_SCRIPT_ID
```

Nilainya adalah **Script ID project Apps Script Admin Guru** yang menjadi target.

Tambahkan:

```text
GITHUB_BASE
```

Contoh format:

```text
https://raw.githubusercontent.com/USERNAME/REPOSITORY/main/admin-guru
```

Ganti `USERNAME/REPOSITORY` dengan repository GitHub milik kamu sendiri.

### Urutan pertama kali

1. Pastikan project Admin Guru sudah ada.
2. Pastikan Apps Script API dapat digunakan oleh project Updater.
3. Isi `TARGET_SCRIPT_ID` dan `GITHUB_BASE`.
4. Jalankan `testUpdater()`.
5. Jika test berhasil, jalankan `updateBackend()`.
6. Setelah update selesai, buka project Admin Guru dan cek `Code`, `Index`,
   `JavaScript`, dan `Style`.
7. Jika backend berubah, buat **deployment/version baru** sesuai kebutuhan.

### Update berikutnya

Setiap kali source di GitHub berubah:

```text
Commit GitHub
     ↓
testUpdater()
     ↓
updateBackend()
     ↓
Apps Script Admin Guru diperbarui
```

Tidak perlu copy-paste `Code.gs` yang panjang secara manual.

> `Updater.gs` adalah tool sinkronisasi, bukan backend Web App.
> Backend Web App tetap `admin-guru/Code.gs`.


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


