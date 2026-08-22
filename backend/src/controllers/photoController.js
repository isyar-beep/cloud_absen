const fs = require('fs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { lokasiBerkas } = require('../utils/uploadPhoto');

// Masa berlaku token foto. Sengaja pendek: token ini ikut tertulis di URL
// gambar, jadi bisa bocor lewat log server atau riwayat browser.
const MASA_BERLAKU = '30m';

// GET /api/photos/token
// Tag <img> di browser tidak bisa mengirim header Authorization, jadi token
// harus ikut di URL. Daripada menaruh token sesi penuh di sana, diterbitkan
// token khusus yang hanya bisa membaca foto dan berumur pendek.
async function terbitkanTokenFoto(req, res, next) {
  try {
    const token = jwt.sign(
      { id: req.user.id, role: req.user.role, scope: 'photo' },
      process.env.JWT_SECRET,
      { expiresIn: MASA_BERLAKU }
    );
    res.json({ token, expires_in: MASA_BERLAKU });
  } catch (err) {
    next(err);
  }
}

// Cari pemilik berkas. Nama berkas baru sudah memuat ID pegawai
// (mis. ..._id02_budi-pegawai_masuk_a7f3.jpg) sehingga tidak perlu query.
// Berkas lama tanpa penanda ID dicari ke database supaya tetap bisa dibuka.
async function pemilikBerkas(relatif) {
  const cocok = relatif.match(/_id(\d+)_/);
  if (cocok) return Number(cocok[1]);

  const hasil = await query(
    `SELECT user_id FROM attendance WHERE photo_in_url LIKE $1 OR photo_out_url LIKE $1
     UNION
     SELECT id FROM users WHERE avatar_url LIKE $1
     LIMIT 1`,
    [`%${relatif}%`]
  );
  return hasil.rows[0]?.user_id ?? hasil.rows[0]?.id ?? null;
}

// GET /api/photos/*?t=<token foto>
// Menyajikan foto absensi & foto profil. Sebelumnya folder uploads dilayani
// terbuka sebagai berkas statis -- siapa pun yang menebak URL bisa melihat
// wajah pegawai tanpa login. Sekarang wajib token, dan pegawai hanya boleh
// membuka fotonya sendiri (admin boleh semua).
async function sajikanFoto(req, res, next) {
  try {
    const relatif = req.params[0];
    const token = req.query.t;

    if (!token) {
      return res.status(401).json({ message: 'Token foto tidak ada.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Token foto tidak valid atau sudah kedaluwarsa.' });
    }
    if (payload.scope !== 'photo') {
      return res.status(403).json({ message: 'Token ini tidak berlaku untuk membuka foto.' });
    }

    const berkas = lokasiBerkas(relatif);
    if (!berkas || !fs.existsSync(berkas)) {
      return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    }

    if (payload.role !== 'admin') {
      const pemilik = await pemilikBerkas(relatif);
      if (pemilik !== payload.id) {
        return res.status(403).json({ message: 'Anda hanya bisa membuka foto milik sendiri.' });
      }
    }

    // Foto absensi tidak pernah berubah isinya, jadi aman di-cache lama di
    // sisi browser. private: jangan disimpan proxy bersama.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(berkas);
  } catch (err) {
    next(err);
  }
}

module.exports = { terbitkanTokenFoto, sajikanFoto };
