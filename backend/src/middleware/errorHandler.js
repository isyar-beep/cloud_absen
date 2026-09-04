const { catatan, dariGalat } = require('../utils/catatan');

// ============================================================
// Menangkap galat yang tidak tertangani di controller supaya balasannya
// selalu berbentuk sama dan server tidak mati.
//
// Dua hal yang dulu tidak ada, dan keduanya baru terasa hilang justru
// saat sedang dibutuhkan:
//
// 1. Catatannya hanya err.stack -- tanpa endpoint, tanpa siapa
//    penggunanya, tanpa waktu. Tumpukan galat memberi tahu BARIS mana
//    yang meledak, tapi bukan siapa yang mengalaminya atau apa yang
//    sedang ia lakukan, dan justru itu yang ditanyakan orang.
//
// 2. Tidak ada yang menghubungkan layar pengguna dengan catatan server.
//    Sekarang penanda permintaan ikut ditampilkan pada galat 500, jadi
//    keluhan lewat telepon bisa ditemukan dengan satu perintah grep.
// ============================================================

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server.';

  // Pelanggaran unique constraint PostgreSQL (mis. email sudah terdaftar)
  if (err.code === '23505') {
    status = 409;
    message = 'Data sudah terdaftar (duplikat).';
  }

  // Error dari multer saat upload file
  if (err.name === 'MulterError') {
    status = 400;
    // Pesannya netral: jalur unggah bukan cuma foto absensi, ada juga
    // lampiran pengajuan izin/sakit/cuti dengan batas yang sama.
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran berkas maksimal 5MB.' : 'Unggah berkas gagal.';
  }

  // Yang dicatat sengaja tidak memuat badan permintaan: di dalamnya ada
  // kata sandi, foto wajah, dan koordinat.
  const konteks = {
    kode: req.kode,
    metode: req.method,
    jalur: req.originalUrl,
    status,
    // Siapa yang mengalaminya. Tanpa ini, galat yang hanya menimpa satu
    // orang -- karena datanya memang khas -- mustahil dikenali sebagai
    // pola.
    pengguna: req.user?.id,
    peran: req.user?.role,
    ms: req.mulai ? Date.now() - req.mulai : undefined,
    ...dariGalat(err, {
      // Tumpukan hanya untuk yang benar-benar tak terduga. Galat 4xx
      // adalah permintaan yang memang keliru, bukan kerusakan; mencetak
      // tumpukannya hanya menenggelamkan yang penting.
      tumpukan: status >= 500,
    }),
  };

  if (status >= 500) {
    catatan.galat('Permintaan gagal', konteks);
  } else {
    catatan.ingat('Permintaan ditolak', konteks);
  }

  // Di produksi, jangan bocorkan rincian galat internal (kueri, tumpukan,
  // jalur berkas). Tapi penandanya JUSTRU ditampilkan -- itu yang
  // membuat galatnya bisa ditelusuri tanpa membocorkan apa pun, karena
  // penanda itu sendiri tidak mengandung keterangan apa-apa.
  if (status >= 500) {
    const dasar = process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : message;
    // Penandanya ditempelkan ke PESANNYA, bukan cuma dikirim sebagai
    // bidang terpisah. Web dan aplikasi HP sama-sama menampilkan
    // data.message apa adanya, jadi cara ini membuat kodenya sampai ke
    // mata pengguna tanpa satu pun perubahan di kedua sisi tampilan --
    // dan tanpa risiko satu layar terlupa diperbarui.
    return res.status(status).json({
      message: req.kode ? `${dasar} (Kode: ${req.kode})` : dasar,
      kode: req.kode,
    });
  }

  res.status(status).json({ message });
}

module.exports = errorHandler;
