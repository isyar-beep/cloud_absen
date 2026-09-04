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

## 2. Absensi tidak bisa dilakukan saat sinyal hilang

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

## 3. Foto wajah tidak diverifikasi mesin

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

---

## 4. Foto dan lampiran menumpuk terus

**Belum ada penghapusan otomatis** untuk foto absensi dan lampiran
pengajuan. Keduanya bertambah setiap hari dan tidak pernah dibuang
sendiri.

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

Keputusan yang perlu diambil dinas: berapa lama foto absensi wajib
disimpan. Setelah angkanya ada, penghapusan otomatis mudah ditambahkan.
Yang tidak bisa diputuskan oleh pembuat aplikasi adalah angkanya sendiri,
karena itu menyangkut kewajiban pemeriksaan dan pembayaran.

Pemantauan sisa disk perlu didaftarkan bersama pemantauan `/health`.

---

## 5. Batas jumlah pengguna

Sistem ini dirancang untuk skala **puluhan sampai ratusan pegawai** dalam
satu dinas. Yang paling menentukan bukan jumlah pegawainya, tapi
**puncak di jam masuk**: hampir semua absen dalam rentang 15–30 menit,
masing-masing mengunggah foto.

Pada VPS 2 vCPU / 4 GB, itu masih lapang. Di atas beberapa ratus pegawai
yang absen serentak, pengecilan gambar akan menjadi hambatan lebih dulu
daripada basis datanya, dan bagian itulah yang perlu dipindahkan ke
antrean terpisah.

---

## 6. Kewajiban perawatan setelah serah terima

Ini bagian yang paling sering terlupakan saat menghitung biaya, dan
paling mahal akibatnya bila terlewat.

### 6.1 Aplikasi Android — kewajiban tahunan

Google Play menaikkan syarat `targetSdkVersion` **setiap tahun**. Aplikasi
yang tidak mengikutinya akan **berhenti bisa diperbarui**, dan pada
akhirnya tidak bisa dipasang di perangkat baru.

Artinya: APK yang dibangun hari ini **tidak akan hidup selamanya**.
Setidaknya sekali setahun aplikasi HP perlu dibangun ulang dengan Expo SDK
yang lebih baru dan diuji ulang. Biayanya kecil bila dikerjakan rutin, dan
besar bila ditunda tiga tahun lalu semuanya harus dilompati sekaligus.

### 6.2 Sertifikat HTTPS

Diperbarui otomatis oleh Let's Encrypt, tapi pembaruan otomatis itu sendiri
bisa gagal diam-diam. Perlu masuk daftar periksa berkala.

### 6.3 Pembaruan keamanan pustaka

Dependabot sudah dipasang dan mengajukan pembaruan setiap minggu. Yang
tidak otomatis adalah **memeriksa dan menggabungkannya**. Pengajuan yang
menumpuk enam bulan berubah menjadi pekerjaan besar yang tidak ada yang
mau memulainya.

### 6.4 Cadangan

Cadangan yang tidak pernah diuji pulih bukan cadangan — ia baru diketahui
gagal pada hari ia dibutuhkan. Pemulihan sudah diuji satu kali; pengujian
itu perlu diulang berkala, dan hasilnya dicatat.

---

## 7. Yang sengaja tidak dibuat

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

## 8. Keadaan versi saat ini

Versi **1.0.0-beta.1**. Beta, dan disebut beta dengan sengaja: seluruh
alurnya sudah berjalan ujung ke ujung dan sudah bisa diperagakan, tapi
belum dipakai satu musim penuh oleh pengguna sungguhan. Yang biasanya
baru tampak pada pemakaian nyata adalah hal-hal yang tidak terpikir saat
merancang — hari libur yang khas daerah, pergantian shift di tengah bulan,
pegawai yang pindah proyek di tengah pekerjaan.

Penomoran akan naik ke 1.0.0 setelah satu bulan penuh dipakai tanpa
perbaikan mendesak.

---

## 9. Ringkasan yang perlu diputuskan dinas

1. Berapa lama foto absensi dan lampiran pengajuan wajib disimpan
   (bagian 4).
2. Siapa yang bertanggung jawab menanggapi peringatan pemantauan, dan
   lewat jalur apa (bagian 1).
3. Apakah perawatan tahunan aplikasi Android masuk dalam kontrak lanjutan
   (bagian 6.1).

Ketiganya tidak bisa diputuskan oleh pembuat aplikasi, dan ketiganya akan
menagih sendiri bila dibiarkan.
