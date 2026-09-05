// ============================================================
// Memeriksa jenis berkas dari ISINYA, bukan dari kata pengirimnya.
//
// multer menyaring memakai file.mimetype, dan nilai itu datang dari
// header Content-Type yang DITULIS KLIEN. Siapa pun yang mengirim
// permintaan sendiri bisa menuliskan "application/pdf" pada berkas apa
// saja, dan penyaringnya lolos begitu saja.
//
// Untuk foto absensi bahayanya kecil: sharp memproses ulang gambarnya,
// jadi berkas yang bukan gambar sungguhan gagal di situ. Lampiran
// pengajuan tidak diproses ulang -- ia disimpan apa adanya, jadi tidak
// ada yang memeriksanya sama sekali.
//
// Yang diperiksa di sini adalah beberapa bita pertama, yaitu bagian yang
// memang menentukan jenis berkasnya dan tidak bisa dikarang dari luar.
//
// Ini BUKAN pemindai virus, dan tidak berpura-pura begitu. Yang
// dicegahnya satu hal saja, dan itu memang yang bisa dicegah: berkas
// jenis lain menyamar sebagai PDF atau gambar.
// ============================================================

// Tanda tangan di awal berkas. Sengaja ditulis sebagai bita, bukan teks:
// sebagian bukan huruf yang bisa diketik.
const TANDA = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],                    // %PDF
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // WebP: "RIFF" pada bita 0-3, lalu "WEBP" pada bita 8-11. Bagian
  // tengahnya ukuran berkas, jadi tidak ikut dicocokkan.
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

function cocok(buffer, pola) {
  if (buffer.length < pola.length) return false;
  return pola.every((b, i) => buffer[i] === b);
}

/**
 * Apakah isi berkas benar-benar berjenis yang diakui?
 *
 * @param {Buffer} buffer isi berkas
 * @param {string} mimetype jenis yang DIAKUI pengirim
 * @returns {boolean}
 */
function isiSesuaiJenis(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;

  const daftar = TANDA[mimetype];
  if (!daftar) return false;

  if (!daftar.some((pola) => cocok(buffer, pola))) return false;

  // WebP butuh pemeriksaan kedua: "RIFF" saja juga dipakai berkas suara
  // WAV dan video AVI, jadi tanpa ini keduanya lolos sebagai gambar.
  if (mimetype === 'image/webp') {
    if (buffer.length < 12) return false;
    return buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }

  return true;
}

module.exports = { isiSesuaiJenis };
