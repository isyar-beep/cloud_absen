# Kebijakan Privasi — Absensi Konsultan (PERCIPKAR)

Versi 1.0 · Aplikasi versi 1.0.0-beta.1

Dokumen ini menjelaskan data apa yang dikumpulkan sistem ini, untuk apa,
siapa yang bisa melihatnya, dan berapa lama disimpan. Ditulis supaya bisa
dibaca pegawai yang datanya diambil, bukan hanya oleh yang memasangnya.

Yang ditulis di sini adalah apa yang **benar-benar dilakukan kodenya** hari
ini. Bila ada yang belum berjalan, itu disebut apa adanya, bukan
dijanjikan.

---

## 1. Siapa pengelola data

Data dikumpulkan dan disimpan atas nama **dinas pemilik pekerjaan**.
Konsultan pengawas hanya diberi akses untuk mengawasi proyek yang menjadi
tanggung jawabnya. Daftar personel dipegang dinas, bukan konsultan.

Sistem berjalan pada **satu server milik pengguna sendiri** (VPS). Tidak
ada data yang dikirim ke layanan analitik, pengiklan, atau pihak ketiga
mana pun, dengan satu pengecualian yang disebut di bagian 5.

---

## 2. Data yang dikumpulkan

### 2.1 Data akun

| Data | Dari mana | Untuk apa |
|---|---|---|
| Nama | diisi admin | menampilkan siapa yang absen |
| Alamat email | diisi admin | login |
| Kata sandi | dibuat pengguna/admin | login — disimpan **teracak (bcrypt)**, tidak bisa dibaca kembali oleh siapa pun, termasuk admin |
| Peran, proyek, shift, unit | diisi admin | menentukan jam kerja dan hak akses |
| Foto profil | opsional, diunggah sendiri | tampilan |

### 2.2 Data absensi

| Data | Kapan diambil | Untuk apa |
|---|---|---|
| **Foto wajah** | setiap absen masuk dan pulang | membuktikan yang absen adalah orangnya, bukan titip absen |
| **Koordinat lokasi (GPS)** | bersamaan dengan foto | mencatat dari mana absen dilakukan |
| Waktu masuk dan pulang | otomatis | menghitung kehadiran dan keterlambatan |
| Proyek | otomatis, dari penugasan saat itu | laporan per proyek |

**Foto wajah dan koordinat adalah data pribadi.** Keduanya diambil hanya
pada saat pengguna menekan tombol absen — aplikasi **tidak** melacak lokasi
di latar belakang, dan **tidak** mengakses kamera di luar layar absensi.

Koordinat **dicatat dan ditampilkan saja**. Sistem ini **tidak memakai
geofencing**: tidak ada absen yang ditolak karena lokasinya di luar
radius tertentu. Penilaian atas lokasi diserahkan kepada manusia yang
membacanya.

Waktu dan koordinat juga **ditanam ke dalam gambar** foto absensi. Ini
disengaja: foto absensi sering diteruskan lewat WhatsApp ke dinas atau
konsultan, dan keterangan yang hanya hidup di halaman web akan hilang
begitu gambarnya keluar dari aplikasi.

### 2.3 Data pengajuan

Alasan izin/sakit/cuti yang ditulis pengguna, dan **dokumen lampiran**
bila diunggah (PDF/JPG/PNG, maksimal 5MB). Lampiran bersifat **opsional** —
pengajuan tetap bisa dikirim tanpanya.

Perlu disadari: surat keterangan sakit memuat keterangan kesehatan.
Yang mengunggah menentukan sendiri apakah akan melampirkannya.

### 2.4 Perangkat dan token pemberitahuan

Bila pengguna mengizinkan notifikasi di aplikasi HP, sebuah token
perangkat disimpan agar pemberitahuan bisa dikirim, **satu baris per
perangkat**. Token ini tidak memuat identitas dan bisa dihapus dengan
mematikan izin notifikasi atau keluar dari perangkat itu. Bersamanya
disimpan **merek dan model** perangkat — dipakai untuk menyusun kalimat
yang bisa Anda kenali ("Samsung Galaxy S21"), bukan deretan huruf token.

Selain itu disimpan **penanda perangkat**: satu nilai acak yang dibuat
sekali oleh aplikasi atau peramban Anda, lalu dikirim setiap login.
Gunanya satu-satunya adalah menjawab *"apakah akun ini pernah dipakai
dari sini sebelumnya"*, sehingga sistem bisa memberi tahu Anda ketika
akun Anda dipakai login dari perangkat yang belum dikenal.

Yang perlu diketahui tentang penanda ini:

- **Bukan nomor seri perangkat Anda.** Nilainya acak, dibuat di perangkat
  Anda sendiri, dan tidak berhubungan dengan identitas apa pun.
- **Tidak bisa dipakai melacak Anda.** Ia hanya bermakna di dalam sistem
  ini, dan hilang begitu data aplikasi atau riwayat peramban dibersihkan.
- **Bukan alat pembatasan.** Absen tidak pernah ditolak karena
  perangkatnya berbeda — Anda tetap bisa masuk dari HP mana pun dan dari
  peramban di komputer.

### 2.5 Catatan teknis

Setiap permintaan ke server dicatat: waktu, endpoint, nomor pengguna,
peran, lama pemrosesan, dan galat bila ada.

**Isi permintaan tidak pernah dicatat.** Kata sandi, foto, dan koordinat
tidak masuk ke catatan teknis.

---

## 3. Siapa yang bisa melihat apa

| | Data dirinya sendiri | Pegawai proyek yang diawasinya | Semua pegawai |
|---|---|---|---|
| **Pegawai** | ya | tidak | tidak |
| **Konsultan** | ya | ya | tidak |
| **Admin (dinas)** | ya | ya | ya |

Pembatasan ini berlaku di sisi server, bukan sekadar disembunyikan dari
tampilan. Konsultan yang mencoba membuka data pegawai proyek lain akan
ditolak walau ia mengetik alamatnya langsung.

**Foto absensi tidak terbuka untuk umum.** Foto tidak dilayani sebagai
berkas statis; setiap pembukaan memerlukan token berumur pendek (30 menit)
dan diperiksa kepemilikannya. Tautan foto yang bocor keluar akan mati
dengan sendirinya.

---

## 4. Berapa lama disimpan

| Data | Lama simpan |
|---|---|
| Token perangkat | sampai keluar dari perangkat itu, atau aplikasinya dihapus |
| Penanda perangkat yang dikenal | selama akun masih ada |
| Pemberitahuan yang sudah dibaca | 90 hari, lalu dihapus otomatis |
| Pemberitahuan apa pun | 180 hari, lalu dihapus otomatis |
| **Foto absensi dan lampiran pengajuan** | **24 bulan**, lalu berkasnya dihapus |
| Baris absensi (tanggal, jam, status, koordinat) | selama akun masih ada |

Perhatikan bahwa dua baris terakhir berbeda, dan itu disengaja. Setelah 24
bulan yang dihapus hanya **gambarnya**; catatan kehadirannya tetap utuh,
sehingga riwayat dan laporan tetap lengkap.

Sebelum dihapus, foto disalin lebih dulu ke penyimpanan dinas sebagai
arsip mereka, dan penghapusan **ditolak sistem** selama salinan itu belum
ada dan belum terbukti utuh. Rinciannya di
[BATAS-SISTEM.md](BATAS-SISTEM.md) bagian 6.

Menonaktifkan akun **tidak menghapus datanya**. Riwayat absensi orang yang
sudah berhenti tetap tersimpan, karena riwayat itu adalah dasar pembayaran
yang sudah terjadi dan bisa diperiksa kemudian.

---

## 5. Pengiriman ke luar

Satu-satunya data yang meninggalkan server adalah **pemberitahuan push**,
yang dikirim lewat layanan Expo agar sampai ke HP. Yang dikirim hanya
judul dan isi singkat pemberitahuan (misalnya "Pengajuan izin disetujui").
Foto, koordinat, dan kata sandi tidak pernah dikirim ke sana.

Bila pemberitahuan push dimatikan, tidak ada data apa pun yang keluar dari
server.

---

## 6. Hak pengguna

- **Melihat data sendiri.** Seluruh riwayat absensi dan pengajuan dapat
  dibuka sendiri lewat aplikasi, kapan saja.
- **Mengganti kata sandi sendiri**, tanpa melalui admin.
- **Meminta koreksi.** Absensi yang keliru dapat diajukan koreksinya
  melalui aplikasi, dan keputusannya tercatat beserta siapa yang
  memutuskan.
- **Mematikan pemberitahuan** lewat pengaturan HP.
- **Mengeluarkan perangkat lain** dari akunnya sendiri, kapan saja, tanpa
  perlu meminta admin.

Permintaan penghapusan data diajukan kepada dinas sebagai pengelola data,
karena data absensi terkait dengan kewajiban pembayaran dan pemeriksaan.

---

## 7. Pengamanan

- Kata sandi disimpan teracak (bcrypt) — tidak bisa dibaca kembali,
  termasuk oleh admin. Admin hanya bisa **menetapkan** kata sandi baru,
  bukan melihat yang lama.
- Lalu lintas berjalan lewat HTTPS.
- Akun yang dinonaktifkan **langsung** kehilangan akses, tidak menunggu
  sesinya kedaluwarsa.
- Percobaan login dibatasi per akun dan per alamat IP.
- Foto hanya bisa dibuka lewat token berumur pendek yang diperiksa
  kepemilikannya.
- Login dari perangkat yang belum dikenal **diberitahukan kepada pemilik
  akun**, sehingga pemakaian tanpa izin bisa disadari tanpa menunggu ada
  yang melapor.

Batas dari pengamanan ini — dan apa yang belum ada — ditulis terus terang
di [BATAS-SISTEM.md](BATAS-SISTEM.md).

---

## 8. Perubahan kebijakan

Perubahan dicatat dalam riwayat berkas ini di repositori, sehingga bisa
ditelusuri kapan dan apa yang berubah.

---

*Dokumen ini menyertai aplikasi versi 1.0.0-beta.1 dan akan diperbarui
mengikuti perubahan sistem.*
