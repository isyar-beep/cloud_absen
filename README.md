# Cloud Absen

Sistem absensi terpusat berbasis cloud — pengganti absensi manual via WhatsApp.
Pengguna login, absen dengan kamera aktif, foto & waktu otomatis tersimpan ke cloud.
Admin punya dashboard real-time, kelola pengguna, dan laporan/statistik lengkap.

## Struktur Project

```
cloud_absen/
├── backend/          Node.js + Express + PostgreSQL (REST API)
├── frontend/         React + Vite + Tailwind (web app, bisa diakses browser HP/laptop)
├── mobile/           React Native + Expo (aplikasi Android/iOS)
└── docs/             Dokumentasi tambahan
```

---

## 1. Setup Backend

### Prasyarat
- Node.js versi 18 ke atas
- PostgreSQL (atau Docker, lebih mudah)

### Langkah setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit file `.env` dan isi sesuai konfigurasi Anda (lihat penjelasan tiap variabel di `.env.example`).

**Opsi A — Database via Docker (paling mudah):**
```bash
docker-compose up -d postgres
```

**Opsi B — Database PostgreSQL manual:**
```bash
psql -U postgres -c "CREATE DATABASE cloud_absen;"
psql -U postgres -d cloud_absen -f database/schema.sql
psql -U postgres -d cloud_absen -f database/migrations/001_leave_requests.sql
```

**Catatan migration:** perubahan schema setelah rilis awal disimpan di
`database/migrations/` (tidak mengubah `schema.sql`). Jalankan tiap file
migration secara berurutan pada database yang sudah ada. Untuk Docker,
migration otomatis ikut dijalankan hanya saat volume database masih baru.

**Buat akun admin pertama:**
```bash
npm run seed
```
Ini akan membuat akun `admin@company.com` dengan password `admin123`.
**Segera ganti password ini setelah login pertama kali.**

**Jalankan server:**
```bash
npm run dev
```
Server akan berjalan di `http://localhost:5000`. Cek dengan membuka `http://localhost:5000/health`.

### Penyimpanan Foto Absensi

Foto absensi disimpan langsung di disk server (folder `backend/uploads/` secara
default) dan di-serve lewat endpoint `/uploads/...`. Tidak perlu akun cloud
storage apa pun. Atur lokasi folder lewat `UPLOAD_DIR` dan domain publik API
lewat `PUBLIC_BASE_URL` di `.env` bila perlu (lihat `.env.example`).

---

## 2. Setup Frontend Web

```bash
cd frontend
npm install
cp .env.example .env
```

Pastikan `VITE_API_URL` di `.env` mengarah ke backend yang sedang berjalan.

```bash
npm run dev
```

Buka `http://localhost:5173` di browser. Login dengan akun admin dari hasil seed backend.

**Build untuk production:**
```bash
npm run build
```
Hasil build ada di folder `dist/` — siap diupload ke Hostinger atau hosting statis lainnya.

---

## 3. Setup Mobile App (Android/iOS)

### Prasyarat
- Install Expo Go app di HP dari Play Store / App Store
- Node.js sudah terinstall di komputer

```bash
cd mobile
npm install
```

Edit `src/services/api.js`, ganti `API_URL` dengan alamat backend Anda.
**Penting:** jika testing di HP fisik, `localhost` tidak akan bisa diakses dari HP.
Gunakan IP lokal komputer Anda, misalnya `http://192.168.1.10:5000/api`
(cek IP dengan `ipconfig` di Windows atau `ifconfig` di Mac/Linux).

```bash
npm start
```

Scan QR code yang muncul menggunakan aplikasi **Expo Go** di HP Android Anda.
Aplikasi akan langsung terbuka di HP tanpa perlu install APK.

### Build APK Production

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
```

Setelah build selesai (~10 menit), Anda akan mendapat link download file `.apk`
yang bisa langsung dibagikan atau diupload ke Google Play Store.

---

## 4. Deploy ke Hostinger (Production)

### Backend (VPS Hostinger)

```bash
# Di server VPS:
git clone https://github.com/isyar-beep/cloud_absen.git
cd cloud_absen/backend
cp .env.example .env
# Edit .env dengan konfigurasi production

# Install Docker jika belum ada, lalu:
docker-compose up -d

# Jalankan migrasi & seed
docker exec -it cloud_absen_api npm run seed
```

Setup **Nginx** sebagai reverse proxy dan **Let's Encrypt** untuk SSL gratis
(dokumentasi detail bisa ditambahkan di `docs/deployment.md`).

### Frontend (Static Hosting)

```bash
cd frontend
npm run build
```

Upload isi folder `dist/` ke `public_html` di Hostinger (via File Manager atau FTP).

---

## 5. Akun Default

Setelah menjalankan `npm run seed` di backend:

| Email | Password | Role |
|---|---|---|
| admin@company.com | admin123 | admin |

**Wajib diganti setelah login pertama kali untuk keamanan.**

---

## 6. Tech Stack

| Layer | Teknologi |
|---|---|
| Database | PostgreSQL |
| Backend | Node.js + Express |
| Frontend Web | React + Vite + Tailwind CSS |
| Mobile | React Native + Expo |
| Penyimpanan Foto | Disk lokal server (volume Docker) |
| Autentikasi | JWT (JSON Web Token) |
| Hosting | Hostinger VPS + Docker |

---

## 7. Fitur Utama

- Login berbasis akun terdaftar (bukan lagi kirim foto manual via WhatsApp)
- Absen masuk & pulang dengan kamera aktif langsung dari browser/HP
- Data waktu & foto otomatis tersimpan ke database cloud
- Dashboard admin real-time: siapa saja yang sudah absen hari ini
- Manajemen pengguna oleh admin (tambah, edit, nonaktifkan akun)
- Statistik personal pegawai (attendance rate, trend, riwayat)
- Statistik & ranking untuk admin (top performer, pegawai berisiko)
- Export laporan bulanan ke Excel & PDF (admin, per periode/departemen)
- Pengajuan izin oleh pegawai + persetujuan admin (approve otomatis mengisi
  status `izin` di absensi)
- Riwayat absensi lengkap dengan filter tanggal/status (pegawai) dan
  tanggal/status/departemen (admin)
- Notifikasi email peringatan untuk pegawai dengan attendance rendah
  (opsional, aktif jika kredensial SMTP diisi di `.env`)

---

## 8. Roadmap Selanjutnya

- [x] Export laporan ke Excel/PDF
- [x] Notifikasi email untuk pegawai dengan attendance rendah
- [x] Fitur pengajuan izin terintegrasi (bukan hanya set manual oleh admin)
- [ ] Notifikasi push (mobile)
- [ ] Dark mode di web & mobile
- [ ] Multi-bahasa (ID/EN)

---

## Troubleshooting

**Kamera tidak muncul di web app**
Pastikan mengakses via `https://` atau `localhost` — browser modern memblokir akses kamera di koneksi HTTP biasa (kecuali localhost).

**Error koneksi database**
Cek apakah PostgreSQL sudah berjalan (`docker ps` jika pakai Docker) dan kredensial di `.env` sudah benar.

**Mobile app tidak bisa connect ke backend**
Pastikan HP dan komputer berada di jaringan WiFi yang sama, dan gunakan IP lokal komputer (bukan `localhost`) di `mobile/src/services/api.js`.
