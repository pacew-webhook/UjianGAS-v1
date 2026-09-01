# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# UjianGAS — Anti-Cheat & Exam Proctoring

**Versi:** 1.0  
**Tanggal:** 1 September 2026  
**Platform:** Android + Google Apps Script + Google Sheets  
**Project:** UjianGAS  
**Status:** Draft untuk Implementasi

---

## 1. Ringkasan Produk

UjianGAS saat ini telah memiliki fitur utama sistem ujian online:

- Login siswa
- Login Admin/Guru
- Pembuatan ujian
- Pembuatan soal
- Bank soal
- Undangan siswa
- Timer ujian
- Pengacakan soal
- Submit jawaban
- Penilaian otomatis
- Riwayat hasil ujian
- Dashboard Admin/Guru

Fitur yang akan ditambahkan adalah **Anti-Cheat & Exam Proctoring**.

Tujuan utama fitur ini adalah membatasi kemungkinan siswa melakukan kecurangan selama ujian dengan cara:

- meninggalkan aplikasi ujian,
- menggunakan split screen,
- berpindah aplikasi,
- menggunakan screenshot/screen recording,
- melakukan copy/paste,
- keluar dari mode ujian,
- dan melakukan aktivitas lain yang dianggap sebagai pelanggaran.

Sistem juga harus mencatat seluruh kejadian pelanggaran sehingga Guru/Admin dapat melakukan pengawasan.

---

## 2. Tujuan

### 2.1 Tujuan Utama

Membuat UjianGAS menjadi sistem ujian Android yang memiliki **Exam Lock + Anti-Cheat + Monitoring**.

### 2.2 Tujuan Bisnis

Sistem diharapkan:

1. Mengurangi kemungkinan siswa melakukan kecurangan.
2. Memberikan informasi pelanggaran kepada Guru/Admin.
3. Menyediakan riwayat aktivitas ujian.
4. Memungkinkan Guru menentukan tingkat keamanan ujian.
5. Memungkinkan Guru membuka kembali ujian siswa dengan PIN Pengawas.
6. Menyediakan dasar audit apabila terjadi masalah selama ujian.

---

## 3. Scope

### 3.1 Android Siswa

- Exam Full Screen
- Exam Lock
- Lock Task/Kiosk Mode
- Deteksi aplikasi masuk background
- Deteksi split screen
- Deteksi multi-window
- Proteksi screenshot
- Proteksi screen recording
- Proteksi copy/paste
- Sistem pelanggaran
- Peringatan pelanggaran
- Penguncian ujian
- PIN Pengawas
- Sinkronisasi pelanggaran ke server
- Recovery ketika koneksi kembali
- Status ujian

### 3.2 Backend

- API pencatatan pelanggaran
- Database Google Sheets
- Konfigurasi anti-cheat per ujian
- Validasi event
- Audit log
- Status siswa

### 3.3 Admin/Guru

- Konfigurasi Anti-Cheat
- Dashboard pengawasan
- Daftar siswa
- Jumlah pelanggaran
- Detail pelanggaran
- Unlock siswa
- Lock siswa
- Force submit
- Audit log

---

## 4. Aktor

### 4.1 Siswa

Siswa menggunakan aplikasi untuk mengerjakan ujian.

**Hak:**
- Memulai ujian
- Menjawab soal
- Melihat timer
- Mengirim jawaban
- Melanjutkan ujian jika tidak dikunci

**Tidak memiliki hak:**
- Mengubah konfigurasi Anti-Cheat
- Menghapus pelanggaran
- Membuka ujian yang terkunci tanpa mekanisme pengawas

### 4.2 Guru

Guru bertanggung jawab terhadap ujian.

**Hak:**
- Membuat ujian
- Mengatur Anti-Cheat
- Melihat pelanggaran
- Membuka siswa yang terkunci
- Mengunci siswa
- Force submit
- Melihat audit log

### 4.3 Admin

Admin memiliki seluruh hak Guru dan hak administrasi sistem.

### 4.4 Pengawas

Role tambahan bila diperlukan.

**Hak:**
- Melihat siswa
- Melihat pelanggaran
- Unlock menggunakan PIN
- Mengunci ujian siswa
- Melihat status ujian

---

## 5. Arsitektur

```text
┌──────────────────────────────┐
│        Android Student       │
│                              │
│ Login                        │
│ Exam                         │
│ Timer                        │
│ Questions                    │
│ Anti-Cheat Engine            │
│ Exam Lock                    │
└──────────────┬───────────────┘
               │ HTTPS
               ↓
┌──────────────────────────────┐
│     Google Apps Script       │
│                              │
│ Authentication               │
│ Exam API                     │
│ Answer API                   │
│ Violation API                │
│ Monitoring API               │
│ Audit API                    │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│       Google Sheets          │
│                              │
│ Users                        │
│ Exams                        │
│ Questions                    │
│ Answers                      │
│ Results                      │
│ Invitations                  │
│ Violations                   │
│ ExamSessions                 │
│ AuditLogs                    │
└──────────────────────────────┘
```

---

# 6. Fitur Anti-Cheat

## 6.1 Exam Full Screen

Ketika siswa memulai ujian, aplikasi masuk ke tampilan ujian penuh.

Navigasi sistem diminimalkan sesuai kemampuan Android/device.

## 6.2 Lock Task / Kiosk Mode

Sistem harus mendukung mode kiosk/Lock Task pada perangkat yang mendukung konfigurasi tersebut.

Tujuan:

- membatasi Home
- membatasi Recent Apps
- mencegah keluar aplikasi
- menjaga siswa tetap berada di aplikasi ujian

**Catatan:** Lock Task Mode memiliki persyaratan Android/device tertentu. Sistem tidak boleh mengklaim bahwa semua perangkat Android dapat dikunci secara absolut.

## 6.3 Deteksi App Background

Jika Activity ujian kehilangan fokus karena siswa keluar dari aplikasi:

```text
EXAM
 ↓
ON PAUSE / BACKGROUND
 ↓
ANTI-CHEAT EVENT
 ↓
VIOLATION +1
```

Event:

`APP_BACKGROUND`

Data:

- studentId
- examId
- sessionId
- timestamp
- eventType
- severity

## 6.4 Deteksi Split Screen

Sistem mendeteksi kondisi multi-window/split-screen yang tersedia melalui API Android.

Event:

`SPLIT_SCREEN`

## 6.5 Deteksi Multi-Window

Jika aplikasi berada dalam mode multi-window:

`MULTI_WINDOW`

Sistem menjalankan policy Anti-Cheat yang telah ditentukan oleh Guru.

## 6.6 Screenshot Protection

Jika diaktifkan:

`Prevent Screenshot = ON`

Android menggunakan mekanisme keamanan yang sesuai untuk mencegah screenshot pada layar ujian.

Event opsional:

`SCREEN_CAPTURE_ATTEMPT`

**Catatan:** Tidak semua mekanisme screenshot/recording dapat dideteksi secara sempurna pada seluruh versi Android. Fokus utama adalah mencegah capture ketika API mendukungnya.

## 6.7 Screen Recording Protection

Jika:

`Prevent Screen Recording = ON`

layar ujian menggunakan mekanisme Android yang mencegah konten sensitif masuk ke screen capture.

## 6.8 Copy/Paste Protection

Selama ujian:

- text selection dinonaktifkan bila relevan
- copy dinonaktifkan
- paste dari clipboard dibatasi
- input jawaban tidak boleh menerima data clipboard jika policy ujian melarangnya

Default:

`Allow Copy/Paste = OFF`

---

# 7. Sistem Pelanggaran

Setiap pelanggaran memiliki:

- Violation ID
- Student ID
- Exam ID
- Session ID
- Violation Type
- Timestamp
- Severity
- Device Info
- Description
- Status

Contoh:

```text
V001
Student: S001
Exam: EX001
Type: APP_BACKGROUND
Time: 20:14:32
Severity: WARNING
```

---

# 8. Tingkat Pelanggaran

## Level 1 — Warning

Pelanggaran ringan.

Contoh:

- aplikasi masuk background
- multi-window

Aksi:

```text
Peringatan
+
Catat pelanggaran
```

## Level 2 — Lock

Pelanggaran berulang.

Contoh:

`3 pelanggaran`

Aksi:

`Ujian dikunci`

Siswa melihat:

```text
🔒 UJIAN DIKUNCI

Silakan hubungi Pengawas.

Masukkan PIN Pengawas
```

## Level 3 — Terminate

Pelanggaran berat atau jumlah pelanggaran melewati batas.

Aksi:

```text
Ujian dihentikan
Jawaban terakhir disimpan
Status = TERMINATED
```

---

# 9. Konfigurasi Anti-Cheat

Saat Guru membuat ujian:

```text
Pengaturan Ujian
────────────────────

Anti-Cheat
[ ON ]

Exam Lock
[ ON ]

Prevent Screenshot
[ ON ]

Prevent Screen Recording
[ ON ]

Prevent Copy/Paste
[ ON ]

Detect Background
[ ON ]

Detect Split Screen
[ ON ]

Maximum Violations
[ 3 ]

Action After Limit
[ Lock Exam ]

Require Supervisor PIN
[ ON ]
```

---

# 10. PIN Pengawas

Setiap ujian dapat memiliki PIN Pengawas.

PIN tidak boleh disimpan dalam bentuk plaintext jika backend dapat mendukung hashing.

Alur:

```text
Pelanggaran
     ↓
Violation Count >= Limit
     ↓
Exam Locked
     ↓
PIN Pengawas
     ↓
Valid?
 ┌───┴────┐
YES       NO
 ↓         ↓
Unlock    Tetap Lock
```

---

# 11. Dashboard Pengawasan

Guru dapat membuka menu:

**Monitoring Ujian**

Contoh:

```text
UJIAN MATEMATIKA
Status: ACTIVE

Total Siswa       30
Sedang Ujian      27
Selesai            2
Dikunci            1
Pelanggaran        5
```

Daftar:

```text
Siswa       Status       Pelanggaran

Andi        🟢 Aman       0
Budi        🟡 Warning    2
Citra       🔴 Locked     3
Deni        🟢 Aman       0
```

---

# 12. Detail Siswa

```text
Budi

Status:
WARNING

Pelanggaran:
2

──────────────────

20:14:31
APP_BACKGROUND

20:16:02
SPLIT_SCREEN

──────────────────

[ UNLOCK ]
[ LOCK ]
[ FORCE SUBMIT ]
```

---

# 13. Force Submit

Guru dapat memaksa ujian dikirim.

Konfirmasi:

```text
Apakah Anda yakin ingin
mengakhiri ujian siswa?

[ BATAL ]
[ FORCE SUBMIT ]
```

Backend:

`session.status = FORCE_SUBMITTED`

Jawaban terakhir diproses.

---

# 14. Data Model

## Sheet: Violations

Kolom:

```text
ViolationID
StudentID
ExamID
SessionID
Type
Severity
Timestamp
Description
Device
AppVersion
Status
CreatedAt
```

## Sheet: ExamSessions

Kolom:

```text
SessionID
ExamID
StudentID
StartTime
ExpectedEndTime
ActualEndTime
Status
ViolationCount
LastHeartbeat
DeviceInfo
AppVersion
```

Status:

```text
NOT_STARTED
ACTIVE
PAUSED
WARNING
LOCKED
SUBMITTED
FORCE_SUBMITTED
TERMINATED
EXPIRED
```

## Sheet: AuditLogs

Kolom:

```text
AuditID
ActorID
ActorRole
Action
TargetID
ExamID
Timestamp
Description
```

Contoh:

```text
A001
Teacher01
TEACHER
UNLOCK_STUDENT
S001
EX001
20:18:20
Student unlocked by supervisor
```

---

# 15. Heartbeat

Android mengirim heartbeat selama ujian.

Contoh endpoint:

`POST /exam/heartbeat`

Data:

```text
studentId
examId
sessionId
timestamp
remainingTime
appState
```

Interval awal:

`10–30 detik`

Tujuan:

- mengetahui siswa masih aktif
- mengetahui koneksi
- sinkronisasi status
- membantu monitoring

Heartbeat tidak boleh digunakan sebagai satu-satunya bukti kecurangan.

---

# 16. Offline Handling

Jika koneksi internet terputus:

```text
Internet OFF
     ↓
Ujian tetap berjalan
     ↓
Event disimpan lokal
     ↓
Internet kembali
     ↓
Event dikirim ke server
```

Queue lokal:

- ViolationQueue
- AnswerQueue
- HeartbeatQueue

Event penting tidak boleh hilang hanya karena koneksi sementara terputus.

---

# 17. Security Requirements

### API Authentication

Setiap request harus membawa session/authentication token yang valid.

### Server Validation

Server harus memvalidasi:

- studentId
- examId
- sessionId
- waktu ujian
- status ujian
- hak siswa
- timestamp yang masuk akal

### Server Timer

Timer menggunakan waktu server sebagai sumber utama. Android hanya menampilkan countdown.

### Anti-Cheat Tidak Boleh Hanya Client-Side

Client mengirim event seperti:

`APP_BACKGROUND`

Backend tetap mencatat:

- student
- exam
- session
- timestamp

Sehingga terdapat audit trail.

---

# 18. UX Saat Pelanggaran

## Warning

```text
⚠️ PERINGATAN

Anda terdeteksi meninggalkan
halaman ujian.

Pelanggaran: 1 / 3

Tetap berada di aplikasi ujian.

[ LANJUTKAN ]
```

## Locked

```text
🔒 UJIAN DIKUNCI

Batas pelanggaran telah tercapai.

Hubungi pengawas untuk
melanjutkan ujian.

PIN Pengawas

[ ______ ]

[ BUKA UJIAN ]
```

## Terminated

```text
UJIAN DIHENTIKAN

Ujian Anda telah dihentikan
oleh sistem/pengawas.

Jawaban terakhir telah disimpan.

Hubungi pengawas.
```

---

# 19. Rules Engine

Konfigurasi:

`maxViolation = 3`

Rule:

```text
0 pelanggaran
→ NORMAL

1 pelanggaran
→ WARNING

2 pelanggaran
→ WARNING

3 pelanggaran
→ LOCKED

pelanggaran berat
→ TERMINATED
```

Guru dapat mengubah policy.

---

# 20. Fitur Opsional Tahap Berikutnya

Tidak masuk MVP:

- Device Binding
- Network Monitoring
- Location Verification
- Camera Proctoring
- Face Verification
- AI Proctoring

Fitur tersebut memiliki kompleksitas dan implikasi privasi lebih tinggi.

---

# 21. Prioritas Implementasi

## P0 — Wajib

1. Exam Full Screen
2. App Background Detection
3. Split Screen Detection
4. Violation System
5. Backend Violation API
6. Sheet Violations
7. Exam Session
8. Warning UI
9. Lock Exam
10. PIN Pengawas

## P1 — Sangat Disarankan

11. Lock Task/Kiosk
12. Screenshot Protection
13. Screen Recording Protection
14. Copy/Paste Protection
15. Monitoring Dashboard
16. Force Submit
17. Audit Logs
18. Heartbeat
19. Offline Event Queue

## P2 — Pengembangan Lanjutan

20. Device Binding
21. Network Monitoring
22. Advanced Proctoring
23. Camera Monitoring
24. AI Proctoring

---

# 22. Acceptance Criteria

- [ ] Exam Session dibuat ketika ujian dimulai.
- [ ] Timer server tetap berjalan.
- [ ] App background dapat dicatat.
- [ ] Split screen dapat ditangani pada perangkat yang mendukung.
- [ ] Screenshot protection diterapkan.
- [ ] Screen recording protection diterapkan.
- [ ] Copy/paste protection diterapkan sesuai policy.
- [ ] Pelanggaran tersimpan ke backend.
- [ ] Pelanggaran masuk Google Sheets.
- [ ] Violation count dihitung.
- [ ] Batas pelanggaran dapat dikonfigurasi.
- [ ] Siswa dapat dikunci.
- [ ] PIN Pengawas dapat membuka sesi.
- [ ] Guru dapat melihat pelanggaran.
- [ ] Guru dapat melakukan force submit.
- [ ] Audit log tersedia.
- [ ] Offline queue bekerja.
- [ ] Tidak ada kehilangan jawaban.
- [ ] Android project berhasil build.
- [ ] Backend berhasil deploy.
- [ ] Seluruh fitur diuji pada minimal satu perangkat Android target.

---

# 23. Non-Functional Requirements

### Performance

Anti-Cheat tidak boleh menyebabkan UI ujian terasa lambat.

Target operasi lokal normal:

`< 300 ms`

### Reliability

Event penting tidak boleh hilang karena koneksi sementara.

### Compatibility

Target:

`Android 8+`

dengan penyesuaian API berdasarkan kemampuan perangkat.

### Privacy

Sistem tidak boleh mengumpulkan data pribadi/perangkat yang tidak diperlukan.

Fitur kamera, lokasi, atau monitoring lanjutan harus memiliki kebijakan dan persetujuan yang jelas.

---

# 24. Struktur Modul Android

Struktur yang disarankan:

```text
app/
└── src/main/java/
    └── .../
        ├── exam/
        │   ├── ExamActivity
        │   ├── ExamViewModel
        │   └── ExamSession
        │
        ├── anticheat/
        │   ├── AntiCheatManager
        │   ├── ViolationManager
        │   ├── AppStateDetector
        │   ├── MultiWindowDetector
        │   ├── ScreenCaptureGuard
        │   └── ExamLockManager
        │
        ├── supervisor/
        │   ├── SupervisorPin
        │   ├── ViolationDetail
        │   └── ExamMonitoring
        │
        └── network/
            ├── ExamApi
            ├── ViolationApi
            └── HeartbeatApi
```

Nama kelas dapat disesuaikan dengan struktur project UjianGAS yang sudah ada.

---

# 25. API Baru

API minimal:

```text
POST /exam/start
POST /exam/heartbeat
POST /exam/violation
POST /exam/violation/batch
POST /exam/unlock
POST /exam/lock
POST /exam/force-submit
GET  /exam/monitoring
GET  /exam/violations
GET  /exam/session
```

Contoh event:

```json
{
  "studentId": "S001",
  "examId": "EX001",
  "sessionId": "SES001",
  "type": "APP_BACKGROUND",
  "timestamp": "2026-09-01T20:14:32",
  "severity": "WARNING"
}
```

---

# 26. Success Metrics

### Technical

- 100% sesi ujian memiliki SessionID.
- 100% pelanggaran yang diterima server memiliki timestamp.
- Tidak ada jawaban hilang karena event Anti-Cheat.
- Status ujian dapat dipulihkan setelah koneksi terputus.

### Operational

Guru dapat:

- melihat siswa aktif,
- melihat siswa yang melakukan pelanggaran,
- melihat jenis pelanggaran,
- membuka siswa yang terkunci,
- mengakhiri ujian siswa.

---

# 27. Roadmap

## Sprint 1 — Core Anti-Cheat

```text
ExamSession
Violation Model
Violation API
Google Sheets Violations
App Background Detection
Warning UI
```

## Sprint 2 — Exam Lock

```text
Full Screen
Multi Window Detection
Lock Task
Screenshot Protection
Copy/Paste Protection
```

## Sprint 3 — Supervisor

```text
Supervisor PIN
Unlock
Lock
Force Submit
Monitoring Dashboard
```

## Sprint 4 — Reliability

```text
Heartbeat
Offline Queue
Retry
Audit Logs
Server Validation
```

## Sprint 5 — UI/UX

```text
Modern Exam UI
Violation Dialog
Monitoring UI
Status Cards
Animation
Accessibility
```

---

# 28. Definition of Done

Fitur Anti-Cheat dianggap selesai apabila:

- [ ] Exam Session dibuat ketika ujian dimulai.
- [ ] Timer server tetap berjalan.
- [ ] App background dapat dicatat.
- [ ] Split screen dapat ditangani pada perangkat yang mendukung.
- [ ] Screenshot protection diterapkan.
- [ ] Screen recording protection diterapkan.
- [ ] Copy/paste protection diterapkan sesuai policy.
- [ ] Pelanggaran tersimpan ke backend.
- [ ] Pelanggaran masuk Google Sheets.
- [ ] Violation count dihitung.
- [ ] Batas pelanggaran dapat dikonfigurasi.
- [ ] Siswa dapat dikunci.
- [ ] PIN Pengawas dapat membuka sesi.
- [ ] Guru dapat melihat pelanggaran.
- [ ] Guru dapat melakukan force submit.
- [ ] Audit log tersedia.
- [ ] Offline queue bekerja.
- [ ] Tidak ada kehilangan jawaban.
- [ ] Android project berhasil build.
- [ ] Backend berhasil deploy.
- [ ] Seluruh fitur diuji pada minimal satu perangkat Android target.

---

# 29. Kesimpulan

UjianGAS dikembangkan dari aplikasi ujian menjadi sistem:

**Exam + Anti-Cheat + Monitoring.**

Target arsitektur:

```text
                 UJIAN GAS
                     │
        ┌────────────┴────────────┐
        │                         │
   SISTEM UJIAN              ANTI-CHEAT
        │                         │
 Login / Soal / Timer        App Background
 Submit / Nilai              Split Screen
                             Lock Task
                             Pelanggaran
                             PIN Pengawas
                             Audit Log
                                   │
                                   ↓
                             Google Sheets
```

Prioritas implementasi adalah membangun **ExamSession → AntiCheat → Violation → Backend → Supervisor** secara bertahap sebelum fitur proctoring lanjutan.
