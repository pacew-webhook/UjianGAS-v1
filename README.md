# Ujian GAS Android

Aplikasi Android MVP yang mengikuti konsep pada gambar referensi: **Undangan Ujian → Kerjakan Ujian → Kirim Soal via Email/undangan → Nilai Otomatis → Daftar & Masuk → Pengingat**.

Backend memakai **Google Apps Script (GAS) + Google Sheets**, sehingga tidak membutuhkan server VPS untuk versi MVP.

## Struktur

- `app/` — aplikasi Android Kotlin
- `gas/Code.gs` — backend Google Apps Script
- `.github/workflows/build.yml` — build APK otomatis di GitHub Actions

## Setup Google Apps Script

1. Buat Google Sheet.
2. Buka **Extensions → Apps Script**.
3. Tempel isi `gas/Code.gs`.
4. Jalankan fungsi `setup()` sekali.
5. Deploy → New deployment → Web app.
6. Pilih:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Salin URL `/exec`.

## Hubungkan Android

Buka:

`app/src/main/java/com/example/ujian_gas/GasApi.kt`

Ganti:

`PASTE_GAS_WEB_APP_URL_HERE`

dengan URL Web App GAS.

## Build di GitHub

Upload seluruh project ke repository GitHub. Workflow akan menjalankan:

`./gradlew assembleDebug`

APK tersedia di tab **Actions → workflow build → Artifacts**.

## Catatan keamanan

Versi ini adalah MVP. Password masih disimpan sebagai teks di Google Sheet dan autentikasi masih sederhana. Untuk aplikasi produksi sebaiknya ditingkatkan dengan hashing password, token/session, pembatasan role, validasi waktu ujian, rate limiting, dan audit log.

## Fitur MVP

- Daftar akun
- Login
- Daftar ujian
- Soal pilihan ganda A-D
- Pengiriman jawaban
- Koreksi otomatis di GAS
- Nilai otomatis
- Riwayat hasil
- Undangan
- Pengingat
