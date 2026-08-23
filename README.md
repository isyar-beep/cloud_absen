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
for f in database/migrations/*.sql; do psql -U postgres -d cloud_absen -f "$f"; done
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

**Isi data contoh untuk peragaan (opsional):**
```bash
npm run seed:demo
```
Mengisi absensi acak sejak 1 Agustus untuk seluruh pegawai aktif, supaya grafik
dan laporan terlihat berisi saat didemokan. Akhir pekan dan hari libur dilewati.
Foto contoh (siluet berwarna, bukan foto orang sungguhan) ikut ditulis ke
`uploads/absensi/` supaya Galeri Foto tidak kosong. Sekitar satu dari delapan
hari sengaja tanpa absen pulang, meniru pegawai yang lupa absen keluar.
Sengaja dipisah dari `npm run seed` supaya **tidak pernah tereksekusi di server
produksi** — perintah ini menghapus lalu menulis ulang absensi pada rentang tersebut.

**Jalankan server:**
```bash
npm run dev
```
Server akan berjalan di `http://localhost:5000`. Cek dengan membuka `http://localhost:5000/health`.

### Penyimpanan Foto Absensi

Foto absensi disimpan langsung di disk server (folder `backend/uploads/` secara
default). Tidak perlu akun cloud storage apa pun. Atur lokasi folder lewat
`UPLOAD_DIR` dan domain publik API lewat `PUBLIC_BASE_URL` di `.env` bila perlu
(lihat `.env.example`).

**Nama berkas** dibuat rapi supaya mudah dicari dan diarsipkan:

```
uploads/absensi/2026-08/2026-08-22_12-31-22_id02_budi-pegawai_masuk_a636.jpg
                        └tanggal─┘ └─jam──┘ └id┘ └──nama───┘ └jenis┘ └acak┘
```

Foto profil terpisah di `uploads/profil/`. Berkas dikelompokkan per bulan
supaya satu folder tidak berisi puluhan ribu file.

**Akses foto butuh login.** Foto TIDAK dilayani sebagai folder statis publik.
Frontend memanggil `/api/photos/token` untuk mendapat token berumur 30 menit,
lalu memuat gambar lewat `/api/photos/<path>?t=<token>`. Admin boleh membuka
semua foto, pegawai hanya fotonya sendiri, dan percobaan path traversal ditolak.

**Masa simpan.** Foto lama dibersihkan dengan `npm run purge:photos` (default
2 tahun, atur lewat `PHOTO_RETENTION_YEARS`). Yang dihapus hanya berkas
gambarnya — catatan absensi tetap utuh. Lihat `docs/deployment.md` untuk cron-nya.

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
- Riwayat absensi pegawai: preset periode (minggu ini, bulan ini, bulan lalu,
  tahun ini, semua) plus pilih bulan/tahun tertentu atau rentang khusus, tab
  status (semua/hadir/terlambat/izin/alpha), dan rekap jumlah tiap status yang
  sekaligus jadi pintasan ke tab-nya. Rekap dihitung di server, jadi tetap
  benar walau daftarnya dipaginasi
- Riwayat absensi admin dengan filter tanggal/status/departemen
- Koreksi absensi. Admin bisa mengubah jam masuk/pulang dan status satu
  catatan langsung dari menu Riwayat; alasan perubahan wajib diisi dan tiap
  perubahan tersimpan di jejak audit (nilai lama, nilai baru, siapa, kapan,
  alasannya) yang tampil di jendela koreksi dan tidak bisa dihapus
- Pegawai bisa mengajukan koreksi jam dari halaman Riwayat (mis. lupa absen
  pulang); admin menyetujui atau menolak di menu Pengajuan > Koreksi Absensi.
  Koreksi yang disetujui langsung memperbarui absensinya, termasuk membuatkan
  catatan untuk hari yang belum punya baris sama sekali, dan ikut tercatat di
  jejak audit yang sama
- Notifikasi email peringatan untuk pegawai dengan attendance rendah
  (opsional, aktif jika kredensial SMTP diisi di `.env`)
- Notifikasi push ke mobile app (Expo Push Notifications): saat izin
  di-approve/reject, pengingat belum check-in, dan peringatan attendance rendah
- Pengingat absen bisa dikirim ke semua pegawai yang belum absen sekaligus
  (bentuk yang dipakai cron harian) atau ke orang tertentu saja. Dashboard admin
  menampilkan daftar yang belum absen dengan kotak centang, dan admin bisa
  menulis pesan sendiri (maks. 300 karakter) menggantikan teks bawaan
- Shift kerja per pegawai (admin atur jam masuk/pulang tiap shift; deteksi
  telat otomatis mengikuti jam shift masing-masing pegawai, bukan jam tetap)
- Jendela waktu absen per shift: absen masuk dan pulang hanya diterima dalam
  rentang yang diatur admin, dihitung dalam menit terhadap jam shift. Halaman
  Absensi pegawai menampilkan shift, jam kerja, rentang jendelanya, dan apakah
  absen sudah boleh dilakukan sekarang
- Shift yang menyeberang tengah malam (mis. 22:00-06:00) ditangani utuh: absen
  masuk pukul 22:00 dan absen pulang pukul 06:10 keesokan harinya tercatat
  sebagai satu shift yang sama
- WFA (Work From Anywhere) ditetapkan admin per pegawai untuk rentang tanggal
  tertentu, di menu Shift & WFA. Pegawainya tetap absen berfoto seperti biasa;
  catatan absensinya ditandai WFA dan penanda itu tampil di riwayat pegawai,
  riwayat admin, dan galeri foto. Rentang yang tumpang tindih untuk pegawai
  yang sama ditolak, dijaga sampai tingkat database.
  **Catatan:** sistem ini merekam koordinat absen tapi belum pernah
  membandingkannya dengan titik kantor, jadi penandaan WFA saat ini berfungsi
  untuk pelaporan — belum ada pembatasan lokasi yang dilonggarkan
- Kelola hari libur/cuti bersama (Sabtu-Minggu otomatis bukan hari kerja)
- Absen ditutup di akhir pekan dan hari libur terdaftar. Yang diperiksa adalah
  tanggal shift, jadi shift malam yang mulai Jumat 22:00 tetap bisa absen pulang
  Sabtu pagi, sementara shift yang mulai Sabtu ditolak
- Alpha otomatis: pegawai yang tidak absen & tidak izin di hari kerja
  ditandai otomatis (terjadwal via cron, melewati weekend & hari libur)
- Statistik & grafik lengkap untuk admin: pilih pegawai (semua/individual),
  pilih periode (bulan tertentu/riwayat keseluruhan), pilih tampilan
  (bar chart, line chart, pie chart, atau tabel)
- Galeri foto absensi untuk admin: satu kartu per pegawai per hari berisi
  foto masuk & pulang berdampingan, filter tanggal/pegawai/jenis/status,
  urutan terbaru-terlama, dan jendela detail dengan navigasi panah keyboard.
  Hari tanpa absen pulang tampil sebagai slot kosong agar mudah terlihat
- Foto profil pegawai (upload dari web, otomatis dikecilkan sebelum dikirim)
- Keterlambatan tetap dihitung hadir, ditandai "Hadir (Terlambat)" warna kuning

---

## 8. Roadmap Selanjutnya

- [x] Export laporan ke Excel/PDF
- [x] Notifikasi email untuk pegawai dengan attendance rendah
- [x] Fitur pengajuan izin terintegrasi (bukan hanya set manual oleh admin)
- [x] Notifikasi push (mobile)
- [ ] Dark mode di web & mobile
- [ ] Multi-bahasa (ID/EN)

---

## 9. Notifikasi Push (Mobile)

Dipakai untuk 3 hal: izin di-approve/reject, pengingat belum check-in, dan
peringatan attendance rendah. Pakai [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/) —
gratis, tanpa kredensial tambahan di backend.

**Setup sekali di project mobile** (supaya push token bisa diterbitkan):
```bash
cd mobile
npm install -g eas-cli
eas login       # buat akun gratis di expo.dev kalau belum punya
eas init         # otomatis mengisi extra.eas.projectId di app.json
```
Setelah itu, saat pegawai login di app dan mengizinkan notifikasi, push token
otomatis terdaftar ke backend (`PUT /api/auth/push-token`).

**Trigger otomatis:**
- Approve/reject izin — langsung terkirim saat admin mereview (`PUT /api/leaves/:id/review`)

**Trigger manual/terjadwal admin** (mirip pola `low-attendance`, bisa dipanggil dari crontab):
```bash
# Pengingat belum check-in (mis. jam 08:00 tiap hari kerja)
curl -X POST https://api.perusahaan.com/api/notifications/checkin-reminder \
  -H "Authorization: Bearer TOKEN"

# Peringatan attendance rendah (sekarang juga kirim push, selain email)
curl -X POST https://api.perusahaan.com/api/notifications/low-attendance \
  -H "Authorization: Bearer TOKEN"
```

Pegawai yang belum pernah login di mobile app (belum punya push token) otomatis
dilewati — tidak ada error, cuma tidak menerima notifikasi push (tetap dapat
email untuk peringatan attendance rendah kalau SMTP dikonfigurasi).

---

## Troubleshooting

**Kamera tidak muncul di web app**
Pastikan mengakses via `https://` atau `localhost` — browser modern memblokir akses kamera di koneksi HTTP biasa (kecuali localhost).

**Error koneksi database**
Cek apakah PostgreSQL sudah berjalan (`docker ps` jika pakai Docker) dan kredensial di `.env` sudah benar.

**Mobile app tidak bisa connect ke backend**
Pastikan HP dan komputer berada di jaringan WiFi yang sama, dan gunakan IP lokal komputer (bukan `localhost`) di `mobile/src/services/api.js`.
