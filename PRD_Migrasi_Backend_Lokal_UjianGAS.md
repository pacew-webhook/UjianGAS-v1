# PRD: Migrasi Backend UjianGAS dari Google Apps Script + Sheets ke Server Lokal

**Dokumen:** Product Requirements Document (PRD)
**Project:** UjianGAS (Ujian Android + Admin Guru)
**Status:** Draft
**Terkait:** `README.md`, `PRD_UjianGAS_AntiCheat_Exam_Proctoring.md`

---

## 1. Latar Belakang

Backend UjianGAS saat ini berjalan di atas **Google Apps Script (GAS)** dengan **Google Sheets** sebagai database (`admin-guru/Code.gs`). Arsitektur ini bekerja baik untuk skala kecil, tetapi memiliki batas keras dari Google yang tidak bisa dinaikkan:

| Batasan | Nilai | Dampak |
|---|---|---|
| Eksekusi simultan per akun | ~30 | Request tambahan antre/gagal saat siswa mengakses bersamaan |
| Kunci tulis global (`LockService`) | Serial, satu proses tulis pada satu waktu | Submit jawaban/nilai bisa timeout saat banyak siswa submit bersamaan |
| Google Sheets sebagai DB | Tidak didesain untuk write concurrent tinggi | Performa menurun drastis dengan ratusan write/detik |
| Ketergantungan internet | Wajib online ke server Google | Rentan gagal jika koneksi sekolah tidak stabil |

Dengan target pemakaian **500–700 siswa** dalam satu sesi ujian, arsitektur ini berisiko tinggi gagal (error "Could not obtain lock", "too many scripts running simultaneously", request timeout).

## 2. Tujuan

1. Memindahkan backend dari GAS + Sheets ke **server lokal** (berjalan di laptop/PC guru, dalam jaringan lokal sekolah), tanpa ketergantungan internet saat ujian berlangsung.
2. Mempertahankan seluruh **kontrak API** yang sudah dipakai Android (`GasApi.kt`) agar perubahan di sisi Android minimal.
3. Mempertahankan seluruh **fitur anti-cheat & proctoring** yang sudah ada (lihat `PRD_UjianGAS_AntiCheat_Exam_Proctoring.md`) tanpa regresi fungsional.
4. Menghilangkan bottleneck concurrency (eksekusi simultan, lock global) sehingga sanggup menangani 500–700 siswa aktif bersamaan.
5. Menyediakan jalur migrasi data yang aman dari Google Sheets ke database baru.

## 3. Ruang Lingkup

### 3.1 Termasuk dalam scope
- Backend baru pengganti `admin-guru/Code.gs` (bahasa/stack ditentukan di §6).
- Database baru pengganti Google Sheets, dengan skema yang setara (lihat §5).
- Skrip migrasi data satu-arah dari Google Sheets (existing) ke database baru.
- Penyesuaian `GasApi.kt` di Android: hanya perubahan base URL & format request/response bila diperlukan.
- Penyesuaian dashboard Admin Guru (`Index.html`, `Style.html`, `JavaScript.html`) agar memanggil API backend baru.
- Rencana deployment di jaringan lokal (server di laptop, akses via IP LAN).
- Rencana kapasitas jaringan (access point) sebagai syarat non-fungsional pendukung — **bukan bagian dari kode**, tapi wajib direncanakan bersamaan.

### 3.2 Tidak termasuk dalam scope
- Perubahan logika bisnis anti-cheat itu sendiri (deteksi split-screen, FLAG_SECURE, dll) — ini murni migrasi backend, bukan penambahan fitur.
- Hosting cloud publik (server tetap berjalan lokal, bukan disewa online) — dapat menjadi fase terpisah di masa depan jika dibutuhkan akses dari luar sekolah.
- Fitur proctoring lanjutan yang memang belum ada di MVP saat ini (Device Binding, Network Monitoring, Location Verification, Camera/Face/AI Proctoring — sesuai bagian 20 PRD Anti-Cheat).

## 4. Target Kapasitas (Non-Functional Requirements)

| Aspek | Target |
|---|---|
| Jumlah siswa aktif bersamaan | 500–700 device |
| Waktu respons API (p95) | < 500 ms untuk endpoint baca (`exams`, `questions`, `results`) |
| Waktu respons API submit (p95) | < 1.5 detik |
| Ketersediaan selama ujian | Tidak ada downtime akibat lock/quota; toleransi hanya untuk kegagalan hardware/jaringan |
| Concurrency database | Mendukung write concurrent per baris (bukan lock seluruh tabel/file) |
| Mode operasi | Harus berjalan tanpa koneksi internet (LAN-only) |
| Jaringan pendukung (di luar scope kode) | Minimal 3 access point kelas enterprise dipisah per ruangan (~150–200 device/AP), atau kombinasi LAN kabel + WiFi terbatas |

## 5. Pemetaan Skema Data (Sheets → Database)

Skema tabel mengikuti struktur `setupDatabase()` di `Code.gs` saat ini, dipindah apa adanya ke tabel relasional:

| Sheet saat ini | Tabel baru | Catatan migrasi |
|---|---|---|
| `Admin` | `admin` | Kolom sama: AdminID, Nama, Email, PasswordHash, Salt, Role, Status, CreatedAt |
| `Siswa` | `siswa` | Kolom sama: StudentID, Nama, Email, PasswordHash, Salt, Kelas, Status, CreatedAt |
| `Ujian` | `ujian` | Termasuk seluruh kolom konfigurasi Anti-Cheat (AntiCheatOn, MaxViolations, SupervisorPinHash, dll) |
| `Soal` | `soal` | FK ke `ujian.ExamID` |
| `Undangan` | `undangan` | FK ke `ujian` & `siswa`; kolom `MulaiPada` tetap dipakai untuk deadline personal |
| `Jawaban` | `jawaban` | FK ke `ujian`, `siswa`, `soal` |
| `Nilai` | `nilai` | FK ke `ujian`, `siswa` |
| `Pengingat` | `pengingat` | FK ke `ujian` |
| `ExamSessions` | `exam_sessions` | Anti-cheat: status sesi, ViolationCount, LastHeartbeat |
| `Violations` | `violations` | Anti-cheat: log pelanggaran per sesi |
| `AuditLogs` | `audit_logs` | Log aktivitas admin |

**Password & PIN:** skema hashing bersalt (`generateSalt_`, `hashPassword_`) dan hash PIN Pengawas dipertahankan persis — algoritma cukup dipindah ke bahasa backend baru, tidak perlu re-desain.

## 6. Pilihan Teknologi (Rekomendasi)

| Komponen | Rekomendasi | Alasan |
|---|---|---|
| Runtime backend | Node.js + Express | Non-blocking I/O, cocok untuk banyak koneksi ringan bersamaan; mudah menjaga struktur endpoint mirip `Code.gs` |
| Database | PostgreSQL (atau MySQL) | Mendukung write concurrent per baris, bukan lock seluruh file seperti SQLite; lebih tangguh untuk 500–700 siswa |
| Alternatif ringan | SQLite | Cukup untuk uji coba/skala lebih kecil, tapi mengunci seluruh file saat menulis — tidak direkomendasikan untuk beban submit serentak di akhir ujian |
| Dashboard Admin | Tetap HTML/JS statis (seperti sekarang), memanggil REST API baru | Minim perubahan visual, hanya ganti sumber data |
| Autentikasi sesi admin | JWT atau session token sederhana, menggantikan `CacheService` GAS | Tidak lagi tergantung layanan Google |

## 7. Kontrak API yang Harus Dipertahankan

Endpoint berikut (dari `doPost` di `Code.gs`) harus tersedia dengan nama & parameter yang setara, agar `GasApi.kt` minim berubah:

**Endpoint siswa/Android:**
- `login`, `register`
- `exams`, `questions`, `submit`
- `invitations`, `results`, `reminders`

**Endpoint anti-cheat & proctoring:**
- `violation`, `violation_batch`
- `heartbeat`, `unlock`, `session_status`

**Ketentuan:**
- Format request tetap `form-encoded` (`action=...`) seperti sekarang, ATAU dimigrasi ke JSON body — dipilih di awal fase implementasi dan diterapkan konsisten di `GasApi.kt` maupun backend.
- Format response tetap objek `{ ok: boolean, message?, data? }` agar parsing di Android tidak berubah signifikan.
- Validasi yang sudah ada di GAS wajib dipindah utuh: validasi waktu ujian di server (`isExamWithinWindow_`), validasi undangan sebelum kirim soal, pengacakan soal per siswa dengan seed deterministik (`seededShuffle_`), deadline personal per siswa (`computePersonalDeadline_`), serta pencegahan mengerjakan ulang ujian yang sudah dikumpulkan.

## 8. Rencana Migrasi Data

1. Ekspor seluruh sheet (`Admin`, `Siswa`, `Ujian`, `Soal`, `Undangan`, `Jawaban`, `Nilai`, `Pengingat`, `ExamSessions`, `Violations`, `AuditLogs`) ke CSV.
2. Jalankan skrip import (satu kali) yang membaca CSV dan mengisi tabel baru sesuai pemetaan di §5.
3. Verifikasi jumlah baris & spot-check data (terutama akun Admin/Siswa dan hasil Nilai) antara sumber (Sheets) dan tujuan (database baru).
4. Sheets lama tetap disimpan sebagai arsip/cadangan, tidak dihapus.

## 9. Tahapan Implementasi

| Fase | Deliverable |
|---|---|
| 1. Setup & skema DB | Database baru + tabel sesuai §5, skrip migrasi CSV |
| 2. Backend inti | Endpoint `login`, `register`, `exams`, `questions`, `submit` berjalan setara dengan `Code.gs` |
| 3. Backend anti-cheat | Endpoint `violation`, `violation_batch`, `heartbeat`, `unlock`, `session_status` |
| 4. Integrasi Android | Update `GasApi.kt` ke base URL server lokal, uji alur login → daftar ujian → soal → submit |
| 5. Integrasi Dashboard Admin | `Index.html`/`JavaScript.html` memanggil API backend baru |
| 6. Load testing | Simulasi 500–700 request bersamaan ke endpoint `questions` & `submit` (mis. dengan k6) |
| 7. Uji jaringan lokal | Uji koneksi nyata dengan jumlah access point sesuai §4 di lokasi ujian sebenarnya |
| 8. Uji coba terbatas | Simulasi ujian dengan 1 kelas (30–50 siswa) sebelum skala penuh |
| 9. Go-live | Ujian skala penuh (500–700 siswa) dengan laptop cadangan siap sedia |

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Laptop server mati/hang saat ujian (single point of failure) | Siapkan laptop cadangan dengan database ter-sinkron/backup berkala; sediakan UPS |
| Access point tidak cukup untuk device sebenarnya | Load test jaringan dengan jumlah device mendekati riil sebelum hari-H (lihat percakapan sebelumnya soal kapasitas AP) |
| Perbedaan perilaku antara GAS dan backend baru pada validasi waktu/undangan | Uji regresi manual untuk seluruh alur kritis sebelum go-live |
| Kehilangan data saat migrasi CSV | Jangan hapus Sheets lama; verifikasi jumlah baris sebelum go-live |
| Tim tidak familiar dengan stack baru (Node.js/PostgreSQL) | Dokumentasi setup step-by-step + skrip otomatis untuk instalasi dependency |

## 11. Kriteria Sukses (Acceptance Criteria)

- [ ] Seluruh endpoint API berjalan identik secara fungsional dengan `Code.gs` (login, ambil soal, submit, anti-cheat, dll).
- [ ] Uji beban menunjukkan tidak ada error terkait lock/quota pada 500–700 request bersamaan ke endpoint `submit`.
- [ ] Ujian dapat berjalan sepenuhnya tanpa koneksi internet (LAN-only).
- [ ] Data hasil migrasi dari Sheets ke database baru terverifikasi lengkap (tidak ada baris hilang).
- [ ] Uji coba dengan minimal 1 kelas nyata berhasil tanpa isu sebelum go-live skala penuh.
- [ ] Rencana jaringan (jumlah access point) sudah diuji dengan jumlah device mendekati target riil.

## 12. Hal yang Perlu Diputuskan (Open Questions)

- Format komunikasi Android ↔ backend: tetap form-encoded atau pindah ke JSON?
- Database: PostgreSQL/MySQL (direkomendasikan) atau SQLite (jika skala dipangkas atau hanya untuk uji coba)?
- Strategi backup: manual (copy file database) atau otomatis (cron job lokal)?
- Apakah dashboard Admin Guru tetap dibuka sebagai halaman web statis di laptop server, atau perlu diakses dari device admin lain di jaringan yang sama?
