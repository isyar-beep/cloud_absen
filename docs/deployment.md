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

Edit `mobile/src/services/api.js`:

```js
const API_URL = 'https://api.perusahaan.com/api';
```

Build dengan EAS:

```bash
cd mobile
npm install
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
```

Link download APK muncul setelah build selesai (~10 menit).

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

Restore:

```bash
docker exec -i cloud_absen_db psql -U postgres -d cloud_absen < backup-2026-07-18.sql
```

## 8. (Opsional) Email Peringatan Terjadwal

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

## 9. Pembersihan Foto Lama (Masa Simpan)

Foto absensi menumpuk cepat: 50 pegawai x 2 foto per hari kerja kira-kira
8 GB per tahun. Kebijakan default menyimpan foto 2 tahun, lalu berkasnya
dihapus. **Catatan absensinya (tanggal, jam, status) tetap utuh** — yang
hilang hanya file gambarnya, jadi laporan dan statistik tidak terpengaruh.

Jalankan manual:

```bash
docker exec cloud_absen_api npm run purge:photos
```

Terjadwal tiap tanggal 1 jam 03:00 (crontab -e):

```cron
0 3 1 * * docker exec cloud_absen_api npm run purge:photos >> /root/purge-photos.log 2>&1
```

Ganti masa simpan lewat `PHOTO_RETENTION_YEARS` di `.env` backend
(misal `PHOTO_RETENTION_YEARS=3`), lalu restart API.

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
