const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Detik terbit (iat) dari sebuah token yang baru dibuat.
 *
 * Dipakai untuk menetapkan garis pemutusan sesi TEPAT pada token ini,
 * bukan pada NOW() saat perintah UPDATE dijalankan.
 *
 * Bedanya bukan soal kerapian. Pemutusan menolak token yang iat-nya
 * LEBIH TUA dari garisnya. Kalau garisnya diambil dari NOW(), ada celah
 * satu detik: token terbit pada detik 07, perintah UPDATE berjalan
 * sepersekian detik kemudian dan kebetulan sudah masuk detik 08, garis
 * jadi 08 -- dan token yang baru saja diberikan kepada orangnya langsung
 * ditolak oleh garis yang dibuat untuknya sendiri. Gejalanya: login
 * berhasil, lalu setiap permintaan berikutnya 401, tapi hanya
 * kadang-kadang, tergantung jatuhnya pada detik ke berapa.
 *
 * Cacat sejenis pernah benar-benar terjadi di sini lewat pembulatan
 * ::bigint, dan baru ketahuan karena ujinya dijalankan berulang kali.
 * Mengambil iat langsung dari tokennya membuat celah itu tidak ada sama
 * sekali -- bukan diperkecil, tapi hilang.
 */
function waktuTerbit(token) {
  return jwt.decode(token).iat;
}

module.exports = { generateToken, waktuTerbit };
