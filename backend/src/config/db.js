const { Pool, types } = require('pg');
require('dotenv').config();
const { catatan, dariGalat } = require('../utils/catatan');

// Kolom DATE dikembalikan apa adanya sebagai teks "YYYY-MM-DD".
//
// Bawaan pg mengubahnya jadi objek Date tengah malam waktu server, lalu
// Express men-JSON-kannya sebagai instan UTC: tanggal 21 Agustus di server
// WITA berangkat sebagai "2026-08-20T16:00:00.000Z" dan terbaca sebagai
// 20 Agustus oleh browser yang zona waktunya lebih barat. Tanggal absensi
// adalah tanggal kalender, bukan titik waktu -- jadi jangan pernah
// dikonversi zona waktu.
types.setTypeParser(1082, (nilai) => nilai);

// Alasan yang sama untuk TIMESTAMP tanpa zona waktu (jam absen masuk &
// pulang). Nilainya adalah jam dinding kantor. Kalau dikirim sebagai
// instan UTC, jam 07.39 WITA tampil jadi 23.39 hari sebelumnya di browser
// yang berjalan pada UTC. Dikirim apa adanya: "2026-08-21 07:39:12".
types.setTypeParser(1114, (nilai) => nilai);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  catatan.galat('Galat tak terduga pada sambungan basis data', dariGalat(err));
});

// Helper query supaya controller lebih ringkas
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
