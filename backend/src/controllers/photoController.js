const fs = require('fs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { lokasiBerkas } = require('../utils/uploadPhoto');
const { bolehAksesPegawai } = require('../utils/lingkupProyek');

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

// Halaman galat sederhana. Tautan foto dibuka di tab baru lewat <a
// target="_blank">, jadi kalau ditolak, yang muncul di layar adalah JSON
// mentah -- terbaca seperti aplikasi rusak, padahal penolakannya wajar.
// Halaman kecil ini menjelaskan apa yang terjadi dengan bahasa manusia.
function halamanGalat(res, kode, judul, pesan) {
  // JSON tetap dikirim untuk pemanggil non-peramban (aplikasi HP memakai
  // fetch dan membaca pesannya sendiri).
  if (!String(res.req.headers.accept || '').includes('text/html')) {
    return res.status(kode).json({ message: pesan });
  }
  return res.status(kode).type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${judul}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;
       font-family:Inter,system-ui,-apple-system,sans-serif;
       background:#e6effa;color:#334155;padding:24px}
  .k{max-width:26rem;text-align:center;background:rgba(255,255,255,.75);
     border:1px solid rgba(255,255,255,.8);border-radius:24px;padding:36px 28px;
     box-shadow:0 8px 32px -12px rgba(15,23,42,.18)}
  h1{margin:0 0 10px;font-size:19px;color:#0f172a;letter-spacing:-.02em}
  p{margin:0;font-size:14px;line-height:1.6}
</style></head>
<body><div class="k"><h1>${judul}</h1><p>${pesan}</p></div></body></html>`);
}

// GET /api/photos/*?t=<token foto>
// Menyajikan foto absensi & foto profil. Sebelumnya folder uploads dilayani
// terbuka sebagai berkas statis -- siapa pun yang menebak URL bisa melihat
// wajah pegawai tanpa login. Sekarang wajib token.
//
// Siapa boleh membuka apa:
//   admin     -- semua foto
//   konsultan -- foto pegawai di proyek yang ditanganinya
//   pegawai   -- fotonya sendiri
//
// Konsultan sempat terlewat di sini: syaratnya cuma `role !== 'admin'` lalu
// "pemilik harus dirinya sendiri", sehingga konsultan ditolak bahkan untuk
// foto pegawainya sendiri -- padahal memeriksa bukti kehadiran justru
// pekerjaan utamanya. Sekarang memakai bolehAksesPegawai, penjaga lingkup
// yang sama dengan yang dipakai riwayat dan pengajuan.
async function sajikanFoto(req, res, next) {
  try {
    const relatif = req.params[0];
    const token = req.query.t;

    if (!token) {
      return halamanGalat(res, 401, 'Tautan tidak lengkap',
        'Tautan foto ini tidak memuat token. Buka fotonya dari dalam aplikasi.');
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return halamanGalat(res, 401, 'Tautan sudah kedaluwarsa',
        'Demi keamanan, tautan foto hanya berlaku 30 menit. Kembali ke aplikasi, '
        + 'muat ulang halamannya, lalu buka fotonya lagi.');
    }
    if (payload.scope !== 'photo') {
      return halamanGalat(res, 403, 'Tautan tidak berlaku',
        'Token ini bukan token foto.');
    }

    const berkas = lokasiBerkas(relatif);
    if (!berkas || !fs.existsSync(berkas)) {
      return halamanGalat(res, 404, 'Foto tidak ditemukan',
        'Berkasnya sudah tidak ada di server.');
    }

    if (payload.role !== 'admin') {
      const pemilik = await pemilikBerkas(relatif);
      // bolehAksesPegawai memberi konsultan akses ke pegawai di proyeknya,
      // dan pegawai hanya ke dirinya sendiri.
      if (pemilik === null || !(await bolehAksesPegawai(payload, pemilik))) {
        return halamanGalat(res, 403, 'Foto ini di luar lingkup Anda',
          payload.role === 'konsultan'
            ? 'Anda hanya bisa membuka foto pegawai pada proyek yang Anda tangani.'
            : 'Anda hanya bisa membuka foto milik sendiri.');
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
