# Batas Sistem — Absensi Konsultan (PERCIPKAR)

Versi 1.0 · Aplikasi versi 1.0.0-beta.1

Dokumen ini menyebut terus terang apa yang **belum** dilakukan sistem ini,
apa yang bisa membuatnya berhenti, dan apa yang menjadi kewajiban pihak
pengelola setelah serah terima.

Alasannya sederhana. Batas yang tidak pernah ditulis tidak hilang — ia
hanya berpindah waktu, dan muncul lagi pada hari ketika semua orang
mengira sistemnya sedang berjalan baik. Dokumen ini ditulis supaya
keputusan tentang batas-batas itu diambil sekarang, dengan tenang, oleh
orang yang berwenang mengambilnya.

---

## 1. Yang paling perlu diketahui lebih dulu

**Sistem berjalan pada satu server.** Tidak ada cadangan yang menyala
otomatis bila server itu mati. Selama server mati:

- pegawai **tidak bisa absen sama sekali** — aplikasi HP tidak menyimpan
  absensi untuk dikirim belakangan;
- admin dan konsultan tidak bisa membuka data apa pun.

Ini bukan kerusakan yang bisa diperbaiki dengan kode; ini konsekuensi dari
memakai satu server. Menghilangkannya berarti menambah server kedua,
penyeimbang beban, dan basis data yang ditiru — biaya bulanannya berlipat,
dan perawatannya menuntut orang yang siaga. Untuk jumlah pengguna sistem
ini, biaya itu tidak sebanding.

**Yang bisa dilakukan sebagai gantinya, dan sudah disiapkan:**

- endpoint `/health` yang benar-benar menyentuh basis data, sehingga
  pemantauan tidak berbohong saat PostgreSQL mati;
- catatan galat yang bisa ditelusuri sampai ke keluhan penggunanya;
- cadangan basis data yang **sudah pernah diuji pulih**, bukan sekadar
  dijadwalkan.

**Yang harus dilakukan pengelola:** mendaftarkan `/health` ke layanan
pemantauan (UptimeRobot atau sejenisnya) agar ada yang memberi tahu saat
server mati. Tanpa itu, yang pertama tahu adalah pegawai yang gagal absen.

---

## 2. Rencana pemulihan bencana belum lengkap

Ada bagian yang sudah berjalan dan sudah teruji, dan ada bagian yang
belum ada sama sekali. Keduanya perlu dibedakan dengan jelas, karena
"sudah ada backup" dan "sudah ada rencana pemulihan bencana" adalah dua
klaim yang berbeda.

**Yang sudah ada dan sudah dibuktikan bekerja:**

- cadangan basis data harian (`pg_dump`, terjadwal jam 02:00);
- prosedur pemulihan sudah benar-benar diuji, bukan sekadar ditulis:
  jumlah baris 12 tabel dibandingkan, kunci asing dan indeks diperiksa
  utuh, dan **seluruh pengujian otomatis dijalankan di atas basis data
  hasil pulih** — lihat `deployment.md` bagian 7 untuk hasil uji terakhir.

**Yang belum ada, dan ini bukan detail kecil:**

1. **Cadangan disimpan di server yang sama dengan data aslinya.**
   Berkas `pg_dump` ada di `/root/backups/` pada VPS yang sama. Bila
   VPS itu sendiri rusak total — disk gagal, kena serangan, atau
   providernya bermasalah — data asli dan cadangannya hilang bersamaan.
   Cadangan yang tersimpan di tempat yang sama dengan yang dilindunginya
   bukan cadangan dalam arti yang sesungguhnya.

2. **Foto absensi tidak ikut tercadangkan sama sekali.** Perintah
   `pg_dump` hanya mencadangkan baris basis data, bukan folder
   `uploads/` tempat berkas foto disimpan. Bila disk VPS rusak, basis
   data bisa dipulihkan lengkap dengan URL fotonya — tapi berkas
   fotonya sendiri hilang selamanya, karena tidak pernah disalin ke
   mana pun di luar server itu.

3. **Tidak ada RTO/RPO yang ditulis.** RTO (*Recovery Time Objective*)
   menjawab "berapa lama sampai sistem bisa dipakai lagi". RPO
   (*Recovery Point Objective*) menjawab "data sampai jam berapa yang
   boleh hilang". Tanpa angka ini, "sudah ada backup" tidak menjawab
   pertanyaan yang sebenarnya penting: VPS mati total jam 14.00, jam
   berapa sistem jalan lagi, dan data jam berapa yang hilang?

4. **Uji pulihnya bergantung diingat orang.** "Minimal tiap tiga
   bulan" adalah instruksi, bukan sesuatu yang dipaksa sistem. Kalau
   terlewat enam bulan tanpa ada yang sadar, tidak ada gejala apa pun
   sampai hari cadangannya benar-benar dibutuhkan.

**Perbaikannya murah dan tidak menuntut arsitektur baru** — sejalan
dengan batasan satu server di bagian 1, bukan menggantikannya:

- salin berkas `pg_dump` ke penyimpanan di luar VPS (penyimpanan awan,
  atau sekadar diunduh berkala ke komputer lain);
- masukkan folder `uploads/` ke dalam rutinitas pencadangan yang sama
  (`tar` sederhana sudah cukup), bukan cuma basis datanya;
- tuliskan angka RTO/RPO yang disepakati dinas, supaya harapan soal
  "seberapa cepat pulih" dan "seberapa banyak boleh hilang" jelas
  sebelum insiden terjadi, bukan didebat saat insiden sedang berlangsung.

---

## 3. Penjagaan yang ditegakkan kode, bukan diserahkan pada kedisiplinan

Tiga hal yang dulu hanya berupa instruksi di `deployment.md` — dan
instruksi bisa dilewatkan orang yang sedang buru-buru memasang, tanpa
satu pun gejala yang menunjukkannya.

**1. `JWT_SECRET` yang lemah menolak menyalakan server.** Dulu yang
diperiksa hanya "ada isinya", sehingga `JWT_SECRET=asdf` lolos tanpa
keberatan. Sekarang di produksi ditolak bila kurang dari 32 karakter,
memuat kata yang lazim dipakai sebagai contoh, atau variasi karakternya
terlalu sedikit untuk disebut acak. Kunci token yang lemah berarti
seluruh sistem sesi bisa ditembus, dan sistemnya akan berjalan normal
sambil terbuka.

Catatan: mengganti `JWT_SECRET` mengakhiri seluruh sesi yang sedang
berjalan. Semua orang perlu login ulang.

**2. HTTPS dipaksa dari sisi aplikasi.** Nginx + Certbot tetap yang
menangani TLS, tapi itu berarti keamanannya bergantung sepenuhnya pada
satu berkas konfigurasi yang ditulis tangan. Sekarang bila reverse proxy
melaporkan sambungan aslinya HTTP, permintaan GET dialihkan ke HTTPS dan
selain GET ditolak. Yang lewat di dalamnya kata sandi, foto wajah, dan
koordinat.

Selain GET sengaja **tidak** dialihkan: badannya sudah terkirim polos,
dan mengalihkannya hanya membuat data yang sama dikirim dua kali.

Hanya berlaku di produksi. Memaksanya saat mengembangkan akan mematikan
`localhost`, dan pengembang yang harus melumpuhkan penjagaan keamanan
supaya bisa bekerja akan melumpuhkannya untuk selamanya.

**3. Jenis berkas unggahan diperiksa dari isinya.** `multer` menyaring
memakai `Content-Type` yang **ditulis klien** — siapa pun yang menyusun
permintaannya sendiri bisa menuliskan `application/pdf` pada berkas apa
saja. Untuk foto bahayanya kecil karena `sharp` memproses ulang
gambarnya; **lampiran pengajuan tidak diproses ulang**, jadi sebelum ini
tidak ada yang memeriksanya sama sekali. Sekarang bita pertama berkasnya
dicocokkan dengan jenis yang diakuinya.

Ini **bukan pemindai virus** dan tidak berpura-pura begitu. Yang
dicegahnya satu hal saja, dan itu memang yang bisa dicegah: berkas jenis
lain menyamar sebagai PDF atau gambar.

---

## 4. Absensi tidak bisa dilakukan saat sinyal hilang

Aplikasi HP mengirim absensi **saat itu juga**. Bila sinyal di lokasi
proyek sedang tidak ada, absensi gagal dan harus diulang saat sinyal
kembali.

Absensi luring (disimpan di HP, dikirim belakangan) **tidak** dibuat, dan
itu keputusan yang disengaja: absensi yang tersimpan di HP berarti waktu
absennya ditentukan jam HP, dan jam HP bisa diubah pemiliknya. Untuk
sistem yang menentukan pembayaran, itu membuka celah yang lebih besar
daripada masalah yang ditutupnya.

Jalan keluar bila memang terjadi: pegawai mengajukan **koreksi absensi**,
dan atasannya memutuskan. Jalur itu sudah tersedia dan setiap keputusannya
tercatat beserta siapa yang memutuskan.

---

## 5. Foto wajah tidak diverifikasi mesin

Sistem menyimpan dan menampilkan foto wajah, tapi **tidak membandingkan**
wajah itu dengan wajah pemilik akun. Yang menilai adalah manusia yang
melihatnya.

Artinya: titip absen masih mungkin bila ada yang bersedia difoto
menggantikan orang lain, dan tidak ada yang memeriksa fotonya. Pengenalan
wajah otomatis tidak dipasang karena membutuhkan penyimpanan **data
biometrik** — yang menuntut dasar hukum, izin, dan pengamanan jauh lebih
berat daripada foto biasa — serta perangkat yang lebih kuat.

Yang dilakukan sebagai gantinya: waktu dan koordinat ditanam ke dalam
gambar, sehingga foto yang diteruskan ke luar aplikasi tetap membawa
keterangannya.

**Yang ditambahkan kemudian: titip absen kini bisa TERLIHAT.** Karena di
lapangan tidak ada HP yang dipakai bergantian, satu fakta menjadi bukti
yang hampir tak terbantahkan — *satu perangkat dipakai absen oleh dua
pegawai berbeda pada hari yang sama*. Bila itu terjadi, konsultan
penanggung jawab diberi tahu untuk memeriksa fotonya.

Ini **mendeteksi, bukan mencegah**, dan bedanya perlu disebut terus
terang. Orang yang nekat tetap bisa melakukannya sekali; yang berubah, ia
tidak bisa melakukannya berulang tanpa ketahuan. Dan nilainya **nol**
bila konsultan tidak benar-benar meninjau yang ditandai — sama seperti
pemantauan yang peringatannya tidak pernah dibaca.

Ikatan perangkat (satu pegawai satu HP) sudah dipertimbangkan dan
**ditolak**: pegawai yang HP-nya rusak tidak akan bisa absen, sementara
absensinya menentukan bayarannya. Penanda perangkat Android juga tidak
stabil — berubah saat aplikasi dipasang ulang — sehingga pegawai yang sah
akan ditolak seperti penyusup.

---

## 6. Foto dan lampiran perlu diarsipkan sebelum dibuang

Masa simpannya **24 bulan**, dan ini keputusan yang sudah diambil, bukan
saran. Angkanya menutup satu tahun anggaran penuh ditambah masa
pemeriksaannya di tahun berikutnya.

Yang dibuang hanya **berkasnya**. Baris absensinya — tanggal, jam, status,
koordinat — tetap utuh selamanya, dan baris itu kecil sekali. Jadi riwayat
lengkap tetap bisa dibaca dan dilaporkan; yang hilang hanya gambarnya.

**Dinas menyimpan sendiri foto tiap tahun sebagai datanya.** Karena itu
penghapusan tidak boleh berjalan sebelum penyalinan, dan sistem
menegakkannya: `npm run purge:photos` **menolak** menghapus foto yang
belum diarsipkan, menyebutkan bulan mana yang tertahan, lalu berhenti.
Urutannya:

```bash
npm run foto:lihat      # apa yang sudah lewat masa simpan
npm run foto:arsip      # salin ke ARSIP_DIR, sha256 tiap berkas diperiksa
#                       # -> serahkan salinannya ke dinas
npm run purge:photos    # baru menghapus
```

Yang dibuktikan sistem bukan bahwa dinas sudah mengambil salinannya —
tidak ada kode yang bisa membuktikan itu. Yang dibuktikan: seseorang
benar-benar menjalankan penyalinan, salinannya masih ada, dan isinya
masih sama persis dengan aslinya. Itu jauh lebih baik daripada berharap
seseorang mengingatnya.

Angkanya diukur, bukan dikira-kira: foto kamera depan 1080×1440 sebesar
980 KB menjadi **272 KB** setelah dikecilkan ke 1000 piksel dan dicap.
Itu batas atas — gambar ujinya sengaja penuh derau, sedangkan foto wajah
sungguhan memampat lebih baik. Hitungan di bawah memakai 250 KB per foto,
dua foto per pegawai per hari, 22 hari kerja per bulan.

| Jumlah pegawai | Per bulan | Per tahun |
|---|---|---|
| 20 | ± 0,2 GB | ± 2,6 GB |
| 50 | ± 0,55 GB | ± 6,6 GB |
| 100 | ± 1,1 GB | ± 13 GB |

Pada VPS dengan disk 50 GB, 100 pegawai menghabiskannya dalam waktu
sekitar **tiga sampai empat tahun** — dan itu belum menghitung basis data,
cadangan, serta sistem operasinya sendiri, sehingga waktu nyatanya lebih
pendek. **Disk penuh mematikan PostgreSQL**, bukan hanya menghentikan
unggahan foto, jadi ini perlu diputuskan sebelum terjadi, bukan sesudah.

Dengan masa simpan 24 bulan, penyimpanan **berhenti tumbuh** di sekitar
26 GB untuk 100 pegawai — bukan naik terus tanpa batas.

Yang masih perlu dipastikan dinas: apakah **Jadwal Retensi Arsip (JRA)**
instansi menyebut angka yang lebih panjang untuk dokumen pendukung
pembayaran. Bila ya, angka itu yang berlaku, dan tinggal diubah lewat
`PHOTO_RETENTION_YEARS` di `.env`.

Pemantauan sisa disk perlu didaftarkan bersama pemantauan `/health`.

---

## 7. Batas jumlah pengguna

Sistem ini dirancang untuk skala **puluhan sampai ratusan pegawai** dalam
satu dinas. Yang paling menentukan bukan jumlah pegawainya, tapi
**puncak di jam masuk**: hampir semua absen dalam rentang 15–30 menit,
masing-masing mengunggah foto.

Pada VPS 2 vCPU / 4 GB, itu masih lapang. Di atas beberapa ratus pegawai
yang absen serentak, pengecilan gambar akan menjadi hambatan lebih dulu
daripada basis datanya, dan bagian itulah yang perlu dipindahkan ke
antrean terpisah.

---

## 8. Kewajiban perawatan setelah serah terima

Ini bagian yang paling sering terlupakan saat menghitung biaya, dan
paling mahal akibatnya bila terlewat.

### 8.1 Aplikasi Android — kewajiban tahunan

Google Play menaikkan syarat `targetSdkVersion` **setiap tahun**. Aplikasi
yang tidak mengikutinya akan **berhenti bisa diperbarui**, dan pada
akhirnya tidak bisa dipasang di perangkat baru.

Artinya: APK yang dibangun hari ini **tidak akan hidup selamanya**.
Setidaknya sekali setahun aplikasi HP perlu dibangun ulang dengan Expo SDK
yang lebih baru dan diuji ulang. Biayanya kecil bila dikerjakan rutin, dan
besar bila ditunda tiga tahun lalu semuanya harus dilompati sekaligus.

### 8.2 Sertifikat HTTPS

Diperbarui otomatis oleh Let's Encrypt, tapi pembaruan otomatis itu sendiri
bisa gagal diam-diam. Perlu masuk daftar periksa berkala.

### 8.3 Pembaruan keamanan pustaka

Dependabot sudah dipasang dan mengajukan pembaruan setiap minggu. Yang
tidak otomatis adalah **memeriksa dan menggabungkannya**. Pengajuan yang
menumpuk enam bulan berubah menjadi pekerjaan besar yang tidak ada yang
mau memulainya.

### 8.4 Cadangan

Cadangan yang tidak pernah diuji pulih bukan cadangan — ia baru diketahui
gagal pada hari ia dibutuhkan. Pemulihan sudah diuji satu kali; pengujian
itu perlu diulang berkala, dan hasilnya dicatat.

---

## 9. Yang sengaja tidak dibuat

Bukan karena tidak sempat, tapi karena masing-masing punya alasan.

| Tidak ada | Alasannya |
|---|---|
| **Geofencing** | absen ditolak otomatis karena GPS meleset akan menghukum pegawai atas kesalahan perangkat. Koordinat dicatat dan dinilai manusia. |
| **Kuota cuti tahunan** | perhitungan kuota berbeda-beda antar instansi dan berubah tiap tahun; salah hitung berarti hak orang berkurang. |
| **Absensi luring** | waktu absennya akan ditentukan jam HP yang bisa diubah pemiliknya. |
| **Pengenalan wajah** | menuntut penyimpanan data biometrik dengan kewajiban hukum yang jauh lebih berat. |
| **Satu pegawai di banyak proyek** | membuat laporan per proyek menjadi ambigu; satu pegawai aktif di tepat satu proyek. |
| **Wajib ganti kata sandi berkala** | terbukti mendorong orang menulis sandinya di kertas yang ditempel di meja. |

Bila salah satunya nanti dibutuhkan, yang berubah adalah keputusannya —
bukan penemuan bahwa hal itu terlupakan.

---

## 10. Keadaan versi saat ini

Versi **1.0.0-beta.1**. Beta, dan disebut beta dengan sengaja: seluruh
alurnya sudah berjalan ujung ke ujung dan sudah bisa diperagakan, tapi
belum dipakai satu musim penuh oleh pengguna sungguhan. Yang biasanya
baru tampak pada pemakaian nyata adalah hal-hal yang tidak terpikir saat
merancang — hari libur yang khas daerah, pergantian shift di tengah bulan,
pegawai yang pindah proyek di tengah pekerjaan.

Penomoran akan naik ke 1.0.0 setelah satu bulan penuh dipakai tanpa
perbaikan mendesak.

---

## 11. Ringkasan yang perlu diputuskan dinas

1. Apakah JRA dinas menuntut masa simpan lebih panjang dari 24 bulan
   untuk dokumen pendukung pembayaran (bagian 6).
2. Siapa yang bertanggung jawab menanggapi peringatan pemantauan, dan
   lewat jalur apa (bagian 1).
3. Apakah perawatan tahunan aplikasi Android masuk dalam kontrak lanjutan
   (bagian 8.1).
4. Berapa RTO/RPO yang bisa diterima, dan apakah penyalinan cadangan ke
   luar VPS serta pencadangan folder foto masuk kontrak lanjutan
   (bagian 2).

Keempatnya tidak bisa diputuskan oleh pembuat aplikasi, dan keempatnya
akan menagih sendiri bila dibiarkan.
