// ============================================================
// Penyiapan basis data untuk pengujian.
//
// Data ujinya DIBUAT SENDIRI, tidak menumpang data yang kebetulan sudah
// ada. Uji yang bergantung pada isi basis data seseorang akan lulus di
// satu komputer dan gagal di komputer lain, dan kegagalan seperti itu
// membuat orang berhenti mempercayai hasilnya.
//
// Semua baris diberi awalan penanda supaya bisa dibuang lagi tanpa
// menyentuh data lain sedikit pun -- termasuk kalau ujinya dijalankan
// pada basis data pengembangan yang sedang dipakai.
//
// Penandanya BERBEDA PER BERKAS UJI. node --test menjalankan berkas
// secara serentak, dan dengan satu penanda bersama, penyiapan di satu
// berkas menghapus data yang sedang dipakai berkas lain. Gejalanya
// menyesatkan -- galat kunci asing yang seolah menunjuk cacat produk,
// padahal cuma dua uji yang berebut baris yang sama. Terbukti saat
// berkas ketiga ditambahkan: masing-masing lulus sendiri-sendiri,
// bersama-sama gagal.
// ============================================================

const PENANDA_DASAR = '__uji__';

// Diisi oleh siapkan(); tiap berkas uji menyebut namanya sendiri.
let penanda = PENANDA_DASAR;

let pool = null;

// Sambungan dibuat malas: berkas ini ikut dimuat walau basis datanya tidak
// ada, dan membuat Pool di tingkat modul akan melempar galat sebelum
// sempat dilewati.
function ambilPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'cloud_absen',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      // Jangan menggantung lama saat basis datanya memang tidak ada.
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

// Apakah ada PostgreSQL yang bisa dipakai, DAN skemanya sudah termigrasi?
// Keduanya diperiksa: basis data kosong tanpa tabel bukan alasan untuk
// menyatakan ujinya lulus.
async function adaBasisData() {
  try {
    const p = ambilPool();
    const hasil = await p.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_name IN ('users', 'projects', 'notifications')`
    );
    return hasil.rows[0].n === 3;
  } catch {
    return false;
  }
}

// Dua proyek dengan konsultan berbeda, satu konsultan tanpa proyek, dan
// satu pegawai yang belum ditempatkan. Susunan ini yang membuat kebocoran
// antar proyek bisa terbukti -- bukan sekadar diasumsikan.
async function siapkan(label = 'umum') {
  penanda = `${PENANDA_DASAR}${label}_`;
  const p = ambilPool();
  await bersihkan();

  const buatUser = async (nama, peran) => {
    const r = await p.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, 'x', $3, TRUE) RETURNING id`,
      [`${penanda}${nama}`, `${penanda}${nama}@uji.local`, peran]
    );
    return r.rows[0].id;
  };

  const admin = await buatUser('dinas', 'admin');
  const konsultanA = await buatUser('konsultanA', 'konsultan');
  const konsultanB = await buatUser('konsultanB', 'konsultan');
  const konsultanKosong = await buatUser('konsultanKosong', 'konsultan');

  const buatProyek = async (nama, konsultan) => {
    const r = await p.query(
      `INSERT INTO projects (name, consultant_id) VALUES ($1, $2) RETURNING id`,
      [`${penanda}${nama}`, konsultan]
    );
    return r.rows[0].id;
  };
  const proyekA = await buatProyek('proyekA', konsultanA);
  const proyekB = await buatProyek('proyekB', konsultanB);

  const pegawaiA = await buatUser('pegawaiA', 'staff');
  const pegawaiB = await buatUser('pegawaiB', 'staff');
  const pegawaiLepas = await buatUser('pegawaiLepas', 'staff');
  await p.query('UPDATE users SET project_id = $1 WHERE id = $2', [proyekA, pegawaiA]);
  await p.query('UPDATE users SET project_id = $1 WHERE id = $2', [proyekB, pegawaiB]);

  return {
    admin, konsultanA, konsultanB, konsultanKosong,
    proyekA, proyekB, pegawaiA, pegawaiB, pegawaiLepas,
  };
}

// Urutannya penting: baris yang menunjuk ke baris lain dibuang lebih dulu.
// Hanya membuang baris milik berkas ini. Memakai penanda bersama akan
// menghapus data berkas lain yang sedang berjalan serentak.
async function bersihkan() {
  const p = ambilPool();
  const pola = `${penanda}%`;
  await p.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE name LIKE $1)`, [pola]);
  await p.query(`UPDATE users SET project_id = NULL WHERE name LIKE $1`, [pola]);
  await p.query(`DELETE FROM projects WHERE name LIKE $1`, [pola]);
  await p.query(`DELETE FROM users WHERE name LIKE $1`, [pola]);
}

async function tutup() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { adaBasisData, siapkan, bersihkan, tutup, ambilPool };
