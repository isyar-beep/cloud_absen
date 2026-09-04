const crypto = require('crypto');

// ============================================================
// Penanda permintaan.
//
// Ini bagian yang membuat pencatatan berguna, dan tanpanya sisanya
// hanya tumpukan teks.
//
// Keadaan sebelumnya: pegawai menelepon "tadi pagi gagal absen, muncul
// tulisan merah". Di catatan ada puluhan galat pagi itu, semuanya
// berbunyi "Terjadi kesalahan pada server." Tidak ada satu pun cara
// mengetahui yang mana miliknya, jadi laporannya berakhir tanpa
// jawaban -- bukan karena galatnya sulit, tapi karena galatnya tidak
// pernah ketemu.
//
// Sekarang setiap permintaan mendapat penanda pendek. Kalau gagal,
// penanda itu IKUT DITAMPILKAN di layar pengguna: "Kode: a3f9c1".
// Pegawai membacakannya lewat telepon, admin mengetik satu perintah:
//
//   grep a3f9c1 /var/log/cloud_absen.log
//
// dan langsung memegang endpoint, pengguna, waktu, serta galat aslinya.
//
// Pendek dan tanpa huruf yang mudah tertukar, karena memang untuk
// dibacakan lewat telepon -- UUID penuh tidak akan pernah sampai utuh.
// Enam karakter dari abjad 32 huruf memberi 1 dari 1.073.741.824;
// penanda ini hanya perlu unik di antara permintaan yang berdekatan
// waktunya, bukan sepanjang sejarah.
// ============================================================

const ABJAD = 'abcdefghjkmnpqrstuvwxyz23456789'; // tanpa i l o 0 1

function buatPenanda() {
  const b = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i += 1) s += ABJAD[b[i] % ABJAD.length];
  return s;
}

function penandaPermintaan(req, res, next) {
  req.kode = buatPenanda();
  // Ikut dikirim sebagai header supaya bisa dibaca dari Network tab
  // peramban walau balasannya bukan JSON.
  res.setHeader('X-Kode-Permintaan', req.kode);
  req.mulai = Date.now();
  next();
}

module.exports = { penandaPermintaan, buatPenanda };
