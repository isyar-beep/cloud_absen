const { isiSesuaiJenis } = require('../utils/jenisBerkas');
const { catatan } = require('../utils/catatan');

// ============================================================
// Menolak berkas yang isinya tidak sesuai jenis yang diakuinya.
//
// Dipasang SESUDAH multer, dan sengaja sebagai middleware tersendiri --
// bukan di dalam tiap controller yang menerima unggahan. Alasannya sama
// dengan kenapa pemeriksaan sandi ditaruh di satu berkas: jalur unggah
// ada di beberapa tempat, dan yang ditambahkan kemudian tidak akan
// pernah membaca catatan ini.
//
// multer sudah menyaring lewat file.mimetype, tapi nilai itu ditulis
// KLIEN. Siapa pun yang menyusun permintaannya sendiri bisa menuliskan
// "application/pdf" pada berkas apa pun. Yang diperiksa di sini bita
// pertama isinya, bagian yang tidak bisa dikarang dari luar.
// ============================================================

function periksaBerkas(req, res, next) {
  const berkas = req.file;

  // Unggahan memang opsional di sebagian jalur (lampiran pengajuan).
  if (!berkas || !berkas.buffer) return next();

  if (!isiSesuaiJenis(berkas.buffer, berkas.mimetype)) {
    // Dicatat, karena ini bukan salah ketik biasa: berkas yang isinya
    // tidak sesuai jenis yang diakuinya berarti ada yang menyusun
    // permintaannya sendiri, atau berkasnya rusak. Keduanya layak
    // ditelusuri, dan tanpa catatan tidak ada yang akan tahu.
    catatan.ingat('Isi berkas tidak sesuai jenis yang diakui', {
      kode: req.kode,
      pengguna: req.user?.id,
      jenis_diakui: berkas.mimetype,
      ukuran: berkas.size,
    });

    return res.status(400).json({
      // Pesannya tidak menuduh: yang paling sering terjadi sebenarnya
      // berkas rusak atau ekstensi yang diganti tangan, bukan serangan.
      message: 'Isi berkas tidak sesuai dengan jenisnya. Pastikan berkasnya benar dan tidak rusak.',
    });
  }

  return next();
}

module.exports = periksaBerkas;
