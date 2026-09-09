# Setup Cloudflare Tunnel untuk UjianGAS Local Server

Dokumen ini menjelaskan cara mengekspos `ujiangas-server` (backend Node.js lokal) ke internet menggunakan Cloudflare Tunnel, supaya siswa bisa mengakses ujian dari jaringan sendiri (kuota data, WiFi rumah, dll) — tidak harus satu WiFi dengan laptop server.

## Kenapa Perlu Ini?

`ujiangas-server` secara default hanya bisa diakses dari device yang satu jaringan WiFi/LAN dengan laptop server (`http://<IP-LAN-laptop>:3000`). Kalau siswa perlu akses dari jaringan sendiri, server ini perlu diekspos ke internet.

Selain itu, aplikasi Android (`GasApi.kt`) mewajibkan URL berawalan `https://`:

```kotlin
require(GAS_WEB_APP_URL.startsWith("https://")) { ... }
```

Cloudflare Tunnel menghasilkan URL `https://` otomatis, jadi **tidak perlu mengubah kode Android** untuk validasi ini — cukup ganti nilai `GAS_WEB_APP_URL`.

## Prasyarat

- `ujiangas-server` sudah bisa dijalankan normal di laptop (`node server.js`)
- Laptop server terhubung ke internet dengan koneksi yang stabil (bukan cuma WiFi lokal sekolah)
- Untuk Opsi B (Named Tunnel): domain yang sudah terdaftar/dikelola di akun Cloudflare

---

## Opsi A — Quick Tunnel (cepat, untuk uji coba)

Cocok untuk testing. **Tidak disarankan untuk hari-H** karena URL berubah setiap kali tunnel dijalankan ulang.

### 1. Install `cloudflared`

**Windows (PowerShell):**
```powershell
winget install --id Cloudflare.cloudflared
```
Jika `winget` tidak tersedia, unduh installer `.msi` dari halaman rilis resmi `cloudflared` di GitHub Cloudflare.

**macOS:**
```bash
brew install cloudflared
```

### 2. Jalankan server (terminal 1)

```bash
node server.js
```

Pastikan server jalan di `http://localhost:3000` (atau port sesuai `config.js` / env `PORT`).

### 3. Jalankan tunnel (terminal 2, biarkan server tetap jalan)

```bash
cloudflared tunnel --url http://localhost:3000
```

### 4. Catat URL publik yang muncul

Bentuknya seperti:
```
https://random-words-1234.trycloudflare.com
```

### 5. Update `GasApi.kt`

```kotlin
private const val GAS_WEB_APP_URL =
    "https://random-words-1234.trycloudflare.com/exec"
```

Build ulang APK, bagikan ke siswa.

### 6. Verifikasi dari jaringan luar

Dari HP dengan **kuota data** (bukan WiFi laptop), buka browser ke URL tunnel tanpa `/exec`, contoh:
```
https://random-words-1234.trycloudflare.com/
```
Harus muncul:
```json
{"ok":true,"message":"UjianGAS local server aktif."}
```

### Batasan Quick Tunnel

- URL **berubah setiap kali** `cloudflared` direstart
- Kalau laptop mati/tunnel putus saat ujian berlangsung → perlu jalankan ulang, dapat URL baru, build ulang APK
- Hanya cocok untuk uji coba, bukan untuk hari ujian sungguhan

---

## Opsi B — Named Tunnel (URL tetap, untuk hari-H)

Butuh domain yang dikelola di akun Cloudflare (bisa domain berbayar murah, atau domain yang sudah dimiliki lalu nameserver-nya diarahkan ke Cloudflare).

### 1. Login ke akun Cloudflare

```bash
cloudflared tunnel login
```

Ini membuka browser — pilih domain yang akan dipakai, lalu izinkan akses.

### 2. Buat tunnel dengan nama tetap

```bash
cloudflared tunnel create ujiangas
```

Catat **Tunnel ID** yang muncul di output — file kredensial `.json` juga otomatis dibuat.

### 3. Arahkan subdomain ke tunnel

Contoh memakai subdomain `ujian.namadomain.com`:

```bash
cloudflared tunnel route dns ujiangas ujian.namadomain.com
```

### 4. Buat file konfigurasi

Buat file `~/.cloudflared/config.yml`:

```yaml
tunnel: ujiangas
credentials-file: /path/ke/[Tunnel-ID].json
ingress:
  - hostname: ujian.namadomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Ganti `/path/ke/[Tunnel-ID].json` sesuai lokasi file kredensial yang dibuat di langkah 2 (biasanya ada di `~/.cloudflared/`).

### 5. Jalankan tunnel

```bash
cloudflared tunnel run ujiangas
```

### 6. Update `GasApi.kt` dengan URL tetap

```kotlin
private const val GAS_WEB_APP_URL = "https://ujian.namadomain.com/exec"
```

Build APK **sekali** — URL ini tidak berubah lagi meski laptop/tunnel di-restart, selama konfigurasi `config.yml` sama.

---

## Checklist Sebelum Hari-H

- [ ] Jalankan `node scripts/smoke-test.js` di laptop server yang sebenarnya
- [ ] Jalankan `node scripts/load-test.js 400` (atau sesuai jumlah siswa) di laptop server yang sebenarnya
- [ ] Tes akses dari HP memakai **kuota data**, bukan WiFi laptop, untuk memastikan tunnel benar-benar berfungsi dari luar
- [ ] Pastikan laptop server tercolok listrik / baterai penuh — laptop ini titik gagal tunggal untuk seluruh ujian
- [ ] Backup file `data/ujiangas.db` sebelum ujian dimulai
- [ ] Siapkan rencana cadangan koneksi internet (misal tethering HP guru) kalau internet utama laptop putus
- [ ] Kalau pakai Opsi A (Quick Tunnel), pastikan tunnel dan server dijalankan **tanpa jeda** dari sebelum ujian dimulai sampai selesai — hindari restart di tengah ujian

## Catatan Keamanan

- Trafik antara HP siswa dan Cloudflare terenkripsi (HTTPS), tapi endpoint `/exec` di server tetap menerima semua request sesuai logika `routes.js` yang ada — tidak ada perubahan tambahan pada sisi autentikasi/otorisasi hanya karena memakai tunnel
- URL tunnel sebaiknya tidak disebarluaskan di luar keperluan ujian (mis. jangan diposting di media sosial publik), terutama untuk Named Tunnel yang URL-nya permanen
