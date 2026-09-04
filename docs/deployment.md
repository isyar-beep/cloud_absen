# Panduan Deploy Cloud Absen ke Hostinger VPS

Panduan langkah demi langkah men-deploy backend (API + database) ke VPS Hostinger
dengan Docker, frontend web ke hosting statis, dan build APK mobile.

## Arsitektur Production

```
[HP Pegawai / Browser]
        |
        v  HTTPS
[Nginx di VPS] --- reverse proxy ---> [cloud_absen_api :5000 (Docker)]
        |                                      |
        |                                      v
        |                             [cloud_absen_db :5432 (Docker)]
        |
[Hosting statis Hostinger] <-- frontend dist/ (React build)

Foto absensi disimpan di disk VPS (volume Docker `uploads`) dan di-serve
oleh API lewat `/api/photos/...` — bukan folder statis publik. Setiap
permintaan foto harus membawa token foto berumur pendek (30 menit) yang
diterbitkan `/api/photos/token` setelah login. Admin bisa melihat semua
foto; pegawai hanya fotonya sendiri.
```

---

## 1. Persiapan VPS

Login SSH ke VPS Hostinger:

```bash
ssh root@IP-VPS-ANDA
```

Install Docker (sekali saja):

```bash
curl -fsSL https://get.docker.com | sh
```

Pastikan port 80 dan 443 terbuka di firewall Hostinger (menu Firewall di hPanel VPS).
Port 5000 dan 5432 TIDAK perlu dibuka ke publik — cukup diakses lewat Nginx.

## 2. Deploy Backend

```bash
git clone https://github.com/isyar-beep/cloud_absen.git
cd cloud_absen/backend
cp .env.example .env
nano .env
```

Isi `.env` dengan nilai production. Yang WAJIB diganti:

| Variabel | Nilai production |
|---|---|
| `NODE_ENV` | `production` |
| `TZ` | zona waktu kantor: `Asia/Makassar` (WITA, default), `Asia/Jakarta` (WIB), `Asia/Jayapura` (WIT) |
| `CORS_ORIGIN` | domain frontend Anda, misal `https://absen.perusahaan.com` |
| `DB_PASSWORD` | password kuat yang baru (JANGAN `postgres`) |
| `JWT_SECRET` | string acak panjang, generate: `openssl rand -hex 32` |
| `PUBLIC_BASE_URL` | domain API publik, misal `https://api.perusahaan.com` (dipakai untuk URL foto) |
| `PHOTO_RETENTION_YEARS` | (opsional) lama foto absensi disimpan, default `2` |
| `SMTP_*` | (opsional) kredensial SMTP jika fitur email dipakai |

Catatan keamanan: port database (5432) dan API (5000) di docker-compose
sudah terikat ke `127.0.0.1` — tidak bisa diakses langsung dari internet.
Satu-satunya pintu masuk publik adalah Nginx (port 80/443).

Catatan zona waktu: `TZ` dipakai oleh container API **dan** container
database sekaligus. Kalau nilainya diubah setelah deploy, jalankan
`docker compose up -d` supaya kedua container dibuat ulang — bukan hanya
API-nya. Jam yang dicap di foto absensi berasal dari API, jadi selisih
zona antara keduanya akan terlihat sebagai foto bercap 08.35 WITA yang
tercatat pada jam lain.

Jalankan:

```bash
docker compose up -d --build
```

Saat pertama kali jalan dengan volume baru, `schema.sql` dan semua file migration
otomatis dieksekusi. Lalu buat akun admin:

```bash
docker exec -it cloud_absen_api npm run seed
```

Cek API hidup:

```bash
curl http://localhost:5000/health
```

## 3. Nginx Reverse Proxy + SSL

Install Nginx dan Certbot:

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
```

Buat file `/etc/nginx/sites-available/cloud-absen-api`:

```nginx
server {
    listen 80;
    server_name api.perusahaan.com;   # ganti dengan subdomain API Anda

    # Batasi ukuran upload foto (backend batasi 5MB per file)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan dan pasang SSL:

```bash
ln -s /etc/nginx/sites-available/cloud-absen-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.perusahaan.com
```

Sebelumnya, arahkan DNS `api.perusahaan.com` (A record) ke IP VPS lewat
pengelola domain di hPanel.

## 4. Deploy Frontend Web

Di komputer lokal:

```bash
cd frontend
cp .env.example .env
```

Edit `.env`, arahkan ke API production:

```
VITE_API_URL=https://api.perusahaan.com/api
```

Build:

```bash
npm install
npm run build
```

Upload seluruh isi folder `dist/` ke `public_html` di Hostinger
(File Manager atau FTP). Karena aplikasi memakai React Router,
tambahkan file `.htaccess` di `public_html` supaya semua route
diarahkan ke `index.html`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Penting: kamera hanya berfungsi lewat HTTPS — aktifkan SSL untuk domain
frontend juga (gratis di hPanel Hostinger).

Jangan lupa: nilai `CORS_ORIGIN` di `.env` backend harus sama persis dengan
domain frontend (termasuk `https://`), lalu restart API:
`docker compose restart api`.

## 5. Build APK Mobile

> **Jangan menyunting `mobile/src/services/api.js`.** Berkas itu membaca
> alamat dari `EXPO_PUBLIC_API_URL`; kalau tidak ada, ia mencari sendiri
> alamat komputer pengembang — berguna saat mengembangkan, dan berakibat
> APK yang tidak bisa menghubungi apa pun kalau ikut terbawa ke produksi.

### 5.1 Isi alamat server

Buka `mobile/eas.json`, ganti `GANTI-DENGAN-ALAMAT-SERVER` pada profil
`preview` dan `production` dengan alamat server sungguhan:

```json
"env": { "EXPO_PUBLIC_API_URL": "https://absensi.contoh.id/api" }
```

Kalau ada berkas `mobile/.env` sisa pengembangan yang memuat
`EXPO_PUBLIC_API_URL`, **hapus dulu** — isinya bisa menimpa nilai di atas.

### 5.2 Periksa sebelum membangun

```bash
cd mobile
npm run periksa:build
```

Build EAS berjalan sekitar sepuluh menit dan antre di server orang lain.
Pemeriksaan ini selesai seketika dan menangkap kesalahan yang biasanya
baru ketahuan setelah APK terpasang di HP:

- alamat masih berisi contoh, atau menunjuk `localhost` / `192.168.x.x`
  (HP pegawai di luar kantor tidak akan bisa menjangkaunya)
- alamat memakai `http`, bukan `https` — absensi mengirim foto wajah dan
  password
- versi di `app.json` berselisih dengan `package.json`
- izin `CAMERA` atau `ACCESS_FINE_LOCATION` belum didaftarkan
- ada `mobile/.env` yang akan menimpa alamat produksi

Perbaiki sampai ia menulis **Siap dibangun**.

### 5.3 Bangun

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Profil `preview` menghasilkan **APK** yang tinggal dipasang. Ini yang
dipakai untuk demo dan untuk dibagikan langsung ke pegawai.

Profil `production` menghasilkan **AAB** — format khusus untuk diunggah
ke Play Store, dan **tidak bisa dipasang langsung dari berkas**. Jangan
memakainya untuk demo.

Tautan unduhan muncul setelah build selesai (~10 menit).

### 5.4 Sebelum dibagikan, uji di HP yang bukan HP pengembang

Ini yang membuktikan alamat servernya benar. Pasang APK-nya di HP yang
**tidak pernah** tersambung ke jaringan kantor — pakai data seluler, bukan
WiFi kantor — lalu login. Kalau berhasil, alamatnya sudah benar-benar
terjangkau dari luar.

APK yang diuji hanya di jaringan kantor bisa lolos karena alasan yang
keliru, dan baru ketahuan saat pegawai pertama mencobanya di lapangan.

### Catatan: jangan andalkan Expo Go untuk demo

Expo Go diperbarui sendiri oleh Play Store, dan versi barunya menolak
membuka proyek dengan SDK lama — hal ini sudah terjadi selama
pengembangan sistem ini. Demo yang bergantung padanya bisa rusak kapan
saja, termasuk pada hari presentasi.

APK tidak punya masalah itu: versi SDK-nya tertanam di dalam.

## 6. Update Aplikasi (Redeploy)

Backend:

```bash
cd cloud_absen && git pull
cd backend
docker compose up -d --build
# Jika ada file migration baru di database/migrations/, jalankan manual:
docker exec -i cloud_absen_db psql -U postgres -d cloud_absen < database/migrations/NAMA_FILE.sql
```

Frontend: build ulang di lokal (`npm run build`) lalu upload ulang isi `dist/`.

## 7. Backup Database

Backup manual:

```bash
docker exec cloud_absen_db pg_dump -U postgres cloud_absen > backup-$(date +%F).sql
```

Backup otomatis tiap hari jam 02:00 (crontab -e):

```cron
0 2 * * * docker exec cloud_absen_db pg_dump -U postgres cloud_absen > /root/backups/cloud_absen-$(date +\%F).sql
```

### Memulihkan

Perhatikan: dump dikembalikan ke basis data **kosong**, bukan ditimpakan
ke basis data yang sedang berisi. Menimpakannya di atas data yang ada
akan menabrak baris yang sudah ada dan berhenti separuh jalan.

```bash
# 1. Basis data baru yang kosong
docker exec cloud_absen_db psql -U postgres -c "CREATE DATABASE cloud_absen_pulih;"

# 2. Kembalikan dumpnya ke situ
docker exec -i cloud_absen_db psql -U postgres -d cloud_absen_pulih \
  -v ON_ERROR_STOP=1 < backup-2026-07-18.sql

# 3. Setelah diperiksa benar, tukar namanya
docker exec cloud_absen_db psql -U postgres -c "ALTER DATABASE cloud_absen RENAME TO cloud_absen_lama;"
docker exec cloud_absen_db psql -U postgres -c "ALTER DATABASE cloud_absen_pulih RENAME TO cloud_absen;"
```

`-v ON_ERROR_STOP=1` penting: tanpa itu psql melanjutkan setelah galat,
dan pemulihan yang separuh gagal tetap terlihat berhasil.

### Uji pulih — WAJIB dilakukan berkala

**Backup yang belum pernah dicoba dikembalikan bukan backup, melainkan
berkas yang belum terbukti berguna.** Satu-satunya cara mengetahui
backup Anda benar adalah memulihkannya, dan waktu yang paling buruk
untuk mengetahuinya adalah saat data aslinya sudah hilang.

Lakukan sekali setiap kali ada migrasi baru, dan minimal tiap tiga
bulan. Prosedurnya sudah dijalankan dan terbukti bekerja:

```bash
# Bandingkan jumlah baris tiap tabel: asal vs hasil pulih
for t in users projects attendance leave_requests notifications shifts \
         holidays correction_requests wfa_assignments admin_logs \
         attendance_edits departments; do
  a=$(docker exec cloud_absen_db psql -U postgres -d cloud_absen     -qtAc "SELECT COUNT(*) FROM $t")
  b=$(docker exec cloud_absen_db psql -U postgres -d cloud_absen_pulih -qtAc "SELECT COUNT(*) FROM $t")
  [ "$a" = "$b" ] && echo "OK   $t $a" || echo "BEDA $t $a vs $b"
done

# Bukti yang lebih kuat daripada jumlah baris: jalankan seluruh pengujian
# di atas basis data hasil pulih. Ini membuktikan skema, kunci asing, dan
# indeksnya ikut utuh -- bukan cuma isinya.
cd backend
DB_NAME=cloud_absen_pulih npm test
```

**Hasil uji terakhir** (4 September 2026, PostgreSQL 16):

| Yang diperiksa | Hasil |
|---|---|
| 12 tabel dibandingkan jumlah barisnya | seluruhnya sama |
| Kunci asing pada basis data hasil pulih | 16 terpasang |
| Indeks | 35 terpasang |
| Relasi pegawai ke proyek | menunjuk proyek yang benar |
| 54 pengujian dijalankan di atas hasil pulih | lolos semua, nol dilewati |

Catat hasil uji berikutnya di tabel ini, berikut tanggalnya.

## 8. Pemantauan (WAJIB sebelum dipakai sungguhan)

Tanpa pemantauan, yang pertama tahu server mati adalah **pegawai yang
gagal absen** — dan mereka mengetahuinya pukul tujuh pagi, saat tidak ada
yang bisa memperbaikinya dengan cepat. Penyiapan di bawah ini di bawah
lima belas menit dan menutup risiko itu.

### Apa yang diperiksa `/health`

Endpoint ini **menyentuh basis data**, bukan sekadar membalas "ok":

```bash
curl https://absensi.contoh.id/health
```

Sehat — HTTP **200**:

```json
{"status":"ok","basis_data":"terhubung","balas_ms":8,
 "zona_waktu":"Asia/Makassar","time":"2026-09-04T10:15:54.456Z"}
```

Rusak — HTTP **503**:

```json
{"status":"gagal","basis_data":"tidak terhubung",
 "time":"2026-09-04T10:16:18.640Z"}
```

Pembedaan ini penting. Kalau `/health` hanya membuktikan Express hidup, ia
akan tetap menjawab "ok" saat PostgreSQL mati — pemantauan tetap hijau,
dan tidak ada yang tahu apa pun sampai keesokan paginya. Pemantauan yang
berbohong lebih buruk daripada tidak ada pemantauan, karena ia membuat
orang berhenti memeriksa sendiri.

Dua nilai lain yang berguna dibaca sesekali:

- `balas_ms` — lama basis data menjawab. Angka yang merangkak naik dari
  belasan ke ratusan milidetik adalah peringatan dini **sebelum** ia mati.
- `zona_waktu` — harus `Asia/Makassar`. Kalau kosong atau berbeda,
  tanggal absensi dan batas terlambat akan salah tanpa ada galat apa pun.

### Menyiapkan pemantauan luar

Pakai layanan gratis mana pun yang bisa memanggil URL berkala —
UptimeRobot, Better Stack, dan sejenisnya semuanya cukup. Yang penting
setelannya:

| Setelan | Nilai | Alasan |
|---|---|---|
| URL | `https://.../health` | bukan halaman depan; halaman depan tetap tampil walau basis data mati |
| Selang | 5 menit | cukup rapat untuk tahu sebelum jam masuk |
| Dianggap gagal bila | kode HTTP bukan 200 | 503 harus memicu peringatan |
| Peringatan ke | surel **dan** WhatsApp/Telegram bila tersedia | surel saja mudah terlewat dini hari |

Kalau layanannya mendukung pemeriksaan isi balasan, tambahkan syarat
badan memuat `"status":"ok"`. Itu menangkap kasus langka ketika proxy
membalas 200 padahal aplikasinya sendiri tidak menjawab.

### Memeriksa bahwa peringatannya benar-benar sampai

Pemantauan yang tidak pernah diuji sama tidak bisa dipercayanya dengan
backup yang tidak pernah dipulihkan. Sekali saja, matikan container
basis datanya dan pastikan peringatannya tiba:

```bash
docker stop cloud_absen_db
# tunggu satu selang pemeriksaan, pastikan peringatan masuk
docker start cloud_absen_db
# pastikan pemberitahuan "pulih" juga masuk
```

Catat tanggal ujinya di sini:

| Tanggal | Peringatan sampai? | Catatan |
|---|---|---|
| _(belum diuji)_ | | |

## 9. (Opsional) Email Peringatan Terjadwal

Kirim peringatan attendance rendah otomatis tiap tanggal 1 jam 08:00
(crontab -e; ganti TOKEN dengan token login admin yang masih berlaku,
atau buat script kecil yang login dulu):

```cron
0 8 1 * * curl -s -X POST https://api.perusahaan.com/api/notifications/low-attendance -H "Authorization: Bearer TOKEN"
```

Pola yang sama juga dipakai untuk push notification pengingat belum check-in
(kirim ke pegawai yang belum absen sampai jam tertentu, lihat README bagian 9):

```cron
0 8 * * 1-5 curl -s -X POST https://api.perusahaan.com/api/notifications/checkin-reminder -H "Authorization: Bearer TOKEN"
```

Tanpa body, endpoint ini mengirim ke SEMUA pegawai yang belum absen — bentuk
inilah yang dipakai cron. Untuk mengingatkan orang tertentu saja, admin memakai
daftar bercentang di dashboard web, yang mengirim `{"user_ids": [...]}` ke
endpoint yang sama.

Pola yang sama juga dipakai untuk menandai "alpha" otomatis (pegawai yang tidak
absen & tidak izin di hari kerja). Jalankan sekali sehari, setelah tengah malam,
supaya menandai hari SEBELUMNYA yang sudah pasti selesai (endpoint ini default
ke kemarin kalau tanggal tidak dikirim eksplisit):

```cron
5 0 * * * curl -s -X POST https://api.perusahaan.com/api/attendance/mark-alpha -H "Authorization: Bearer TOKEN"
```

Endpoint ini menolak tanggal yang belum terjadi dan tanggal yang bentuknya
bukan `YYYY-MM-DD`, jadi salah ketik di crontab akan gagal terang-terangan
alih-alih menandai seluruh pegawai alpha di tanggal yang salah.

Cron ini WAJIB dipasang: tombol manualnya sudah dihapus dari dashboard admin,
karena rawan dipakai untuk tanggal yang harinya belum selesai. Endpointnya
masih ada dan tetap bisa dipanggil manual bila diperlukan. Untuk membetulkan
satu catatan absensi, gunakan menu Riwayat > Koreksi di web admin -- jalur itu
mencatat jejak audit, sedangkan menjalankan ulang mark-alpha tidak.

## 10. Pembersihan Foto Lama (Masa Simpan)

Foto absensi menumpuk cepat: 50 pegawai x 2 foto per hari kerja kira-kira
8 GB per tahun. Kebijakan default menyimpan foto 2 tahun, lalu berkasnya
dihapus. **Catatan absensinya (tanggal, jam, status) tetap utuh** — yang
hilang hanya file gambarnya, jadi laporan dan statistik tidak terpengaruh.

### Arsipkan dulu, baru hapus

Dinas menyimpan sendiri foto tiap tahun sebagai datanya. Karena itu
`purge:photos` **menolak menghapus foto yang belum diarsipkan** — ia
melewatinya, menyebutkan bulan mana yang tertahan, lalu berhenti.

Urutan tahunannya:

```bash
# 1. Apa yang sudah lewat masa simpan, dan sudah siap dihapus atau belum
docker exec cloud_absen_api npm run foto:lihat

# 2. Salin ke ARSIP_DIR. sha256 tiap berkas hasil salinan diperiksa,
#    dan pengarsipan dibatalkan bila ada satu saja yang tidak cocok.
docker exec cloud_absen_api npm run foto:arsip

# 3. Serahkan isi folder arsip ke penyimpanan dinas (hard disk, NAS,
#    atau penyimpanan awan mereka). Ini langkah yang dikerjakan manusia
#    dan tidak bisa diwakilkan ke skrip mana pun.

# 4. Baru menghapus
docker exec cloud_absen_api npm run purge:photos
```

Yang dijaga sistem bukan bahwa dinas sudah mengambil salinannya — tidak
ada kode yang bisa membuktikan itu. Yang dijaga: penyalinan benar-benar
pernah dijalankan, salinannya masih ada, dan isinya masih sama persis
dengan aslinya. Foto yang masuk **setelah** pengarsipan — misalnya dari
koreksi absensi yang disetujui belakangan — ikut tertahan sampai
diarsipkan ulang.

### Cron

```cron
0 3 1 * * docker exec cloud_absen_api npm run purge:photos >> /root/purge-photos.log 2>&1
```

**Cron ini tidak akan menghapus apa pun sampai pengarsipan dijalankan,**
dan itu memang yang dikehendaki. Ia berjalan tiap bulan, melapor apa yang
tertahan ke `/root/purge-photos.log`, dan baru benar-benar membersihkan
setelah langkah 2 dan 3 di atas dikerjakan. Periksa berkas log itu sekali
setahun; kalau isinya "DILEWATI" terus-menerus, berarti pengarsipan
tahunannya belum dikerjakan.

Bila memang tidak menghendaki penyalinan sama sekali, pengamanannya bisa
dimatikan dengan `WAJIB_ARSIP=false` di `.env`. Itu pilihan yang sah, tapi
harus diambil dengan sengaja — bukan menjadi bawaan yang tidak pernah
disadari sampai ada yang mencari foto lama dan tidak menemukannya.

### Pengaturan

| Variabel | Bawaan | Guna |
|---|---|---|
| `PHOTO_RETENTION_YEARS` | `2` | masa simpan foto. Dipakai pengarsipan **dan** penghapusan, jadi keduanya tidak bisa berbeda. |
| `ARSIP_DIR` | `<UPLOAD_DIR>/../arsip` | tempat salinan ditulis. Arahkan ke volume atau disk lain. |
| `WAJIB_ARSIP` | `true` | menolak menghapus yang belum diarsipkan. |

Setelah mengubahnya, restart API.

Untuk memantau pemakaian disk volume foto:

```bash
docker exec cloud_absen_api du -sh uploads
```

## Troubleshooting Production

**API tidak bisa diakses dari frontend (error CORS)**
Cek `CORS_ORIGIN` di `.env` backend — harus sama persis dengan domain frontend,
tanpa garis miring di akhir. Restart API setelah mengubah.

**`docker compose up` gagal di bagian database**
Cek log: `docker logs cloud_absen_db`. Jika schema berubah tapi volume lama
masih ada, migration baru harus dijalankan manual (lihat bagian 6).

**Foto tidak terupload**
Cek log API: `docker logs cloud_absen_api`. Pastikan folder `uploads/` bisa
ditulis oleh container (volume `uploads` di `docker-compose.yml` sudah
menangani ini secara default) dan disk VPS tidak penuh.

**Foto tampil sebagai gambar rusak di web admin**
Foto sekarang dilayani lewat `/api/photos/...` dengan token, bukan folder
statis. Pastikan Nginx meneruskan seluruh `/api/` ke API (jangan ada rule
khusus yang memotong `/uploads`), dan cek di DevTools apakah permintaan
`/api/photos/token` mengembalikan 200. Respons 401 berarti sesi sudah
kedaluwarsa (login ulang), 403 berarti pegawai membuka foto milik orang lain.
