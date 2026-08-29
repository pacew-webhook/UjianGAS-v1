# Ujian GAS Admin Guru PRO

## Fitur
- Login Admin/Guru dengan password SHA-256
- Session berbasis CacheService (6 jam)
- Dashboard statistik
- Tambah siswa
- Buat ujian
- Tambah / Edit / Hapus soal
- Kirim undangan ke banyak siswa
- Email undangan melalui Gmail
- Lihat nilai siswa
- UI modern dan mobile-friendly

## Instalasi
1. Upload `UjianGAS_Database_Template.xlsx` ke Google Drive dan buka sebagai Google Sheets.
2. Salin Spreadsheet ID dari URL.
3. Buka Google Apps Script → New Project.
4. Buat file: `Code.gs`, `Index.html`, `Style.html`, `JavaScript.html`.
5. Salin isi file masing-masing.
6. Ganti `PASTE_SPREADSHEET_ID_HERE` pada Code.gs.
7. Jalankan `setupDatabase()` sekali.
8. Edit kredensial pada `createInitialAdmin()` lalu jalankan sekali untuk membuat admin.
9. Setelah admin berhasil dibuat, hapus atau nonaktifkan fungsi `createInitialAdmin()` agar password contoh tidak tersisa di kode.
10. Deploy → New deployment → Web app.

## Keamanan penting
Template ini lebih aman daripada versi sebelumnya karena:
- Password admin di-hash SHA-256.
- Fungsi data memerlukan token session.
- Password tidak dikirim kembali ke browser.
- Token memiliki masa berlaku.

Namun untuk sistem produksi/sekolah, sebaiknya gunakan autentikasi Google Workspace atau Identity Provider jika tersedia. Jangan membagikan Spreadsheet ID atau akses editor kepada siswa.

## Integrasi dengan aplikasi siswa
Admin panel ini menggunakan sheet yang kompatibel dengan struktur UjianGAS. Backend aplikasi siswa sebaiknya menggunakan endpoint/fungsi API yang sama dan tidak pernah mengirim `JawabanBenar` sebelum ujian selesai.
