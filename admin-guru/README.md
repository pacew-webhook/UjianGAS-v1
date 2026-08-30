# Ujian GAS — Admin Guru Lengkap

Versi ini memperbaiki masalah tampilan admin pada ZIP sebelumnya. `Index.html` sekarang benar-benar meng-include `Style.html` dan `JavaScript.html`, dan seluruh menu admin berada di satu dashboard yang responsif untuk HP maupun desktop.

## Isi
- `Code.gs` — backend Apps Script + session login + CRUD
- `Index.html` — struktur dashboard
- `Style.html` — CSS lengkap
- `JavaScript.html` — JavaScript frontend lengkap
- `UjianGAS_Database_Template.xlsx` — template spreadsheet dari proyek asli

## Fitur
- Login admin/guru dengan password SHA-256
- Session admin sampai 6 jam
- Dashboard statistik
- CRUD siswa
- CRUD ujian
- CRUD soal pilihan ganda
- Undangan siswa + email
- Riwayat undangan
- Hasil/nilai ujian
- Pengingat
- CRUD akun admin
- UI mobile-friendly

## Cara pasang
1. Buat/buka Google Sheets yang akan menjadi database.
2. Pastikan sheet berikut ada: `Admin`, `Siswa`, `Ujian`, `Soal`, `Undangan`, `Jawaban`, `Nilai`, `Pengingat`.
3. Jika memakai template XLSX, upload lalu buka sebagai Google Sheets.
4. Buka Apps Script dan buat 4 file persis bernama `Code.gs`, `Index.html`, `Style.html`, `JavaScript.html`.
5. Paste isi masing-masing file dari paket ini.
6. Di `Code.gs`, ganti nilai `SHEET_ID` dengan ID Google Sheets kamu.
7. Jalankan `setupDatabase()` satu kali dari editor Apps Script.
8. Edit `createInitialAdmin()` terlebih dahulu. Ganti email dan password contoh, lalu jalankan satu kali.
9. Setelah admin berhasil dibuat, hapus/nonaktifkan `createInitialAdmin()` agar kredensial contoh tidak tersisa di kode.
10. Deploy → New deployment → Web app.
11. Execute as: **Me**.
12. Who has access: sesuai kebutuhan sekolah (misalnya pengguna yang memiliki akses).
13. Buka URL Web App hasil deployment.

## Penting setelah perubahan kode
Jika sebelumnya sudah pernah deploy, jangan hanya menekan Save. Buat versi deployment baru:
**Deploy → Manage deployments → Edit → New version → Deploy**.

Jika browser masih menampilkan `<?!= include('Style'); ?>`, berarti URL yang dibuka masih menjalankan deployment/versi lama. Gunakan URL deployment terbaru.

## Catatan integrasi aplikasi siswa
Folder `gas/` pada ZIP asli memakai struktur database yang berbeda (`Users`, `Exams`, `Questions`, dst.), sedangkan admin panel ini mempertahankan struktur database admin asli (`Admin`, `Siswa`, `Ujian`, `Soal`, dst.). Jadi jika admin panel ini akan dipakai bersama aplikasi Android dari ZIP asli, backend siswa perlu diselaraskan ke struktur sheet yang sama sebelum dipakai produksi.


## Import Bank Soal Excel
Admin Guru sekarang menyediakan Import Excel `.xlsx` pada menu Bank Soal. Kolom wajib: `Pertanyaan`, `PilihanA`, `PilihanB`, `PilihanC`, `PilihanD`, `JawabanBenar`; `Bobot` opsional. Sistem membaca sheet `Soal` jika tersedia, lalu menyimpan soal ke spreadsheet backend.
