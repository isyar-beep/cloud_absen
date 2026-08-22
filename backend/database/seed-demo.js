// ============================================================
// Seed DEMO -- mengisi catatan absensi acak untuk keperluan
// peragaan (grafik & laporan terlihat berisi).
//
// SENGAJA DIPISAH dari `npm run seed` supaya tidak pernah
// tereksekusi tanpa disadari di server produksi.
// Jalankan: npm run seed:demo
//
// Yang diisi: absensi seluruh pegawai aktif (bukan admin),
// dari 1 Agustus tahun berjalan sampai hari ini. Akhir pekan
// dan hari libur terdaftar dilewati.
// ============================================================
const { pool, query } = require('../src/config/db');
require('dotenv').config();

const TANGGAL_MULAI = 1; // 1 Agustus
const BULAN_MULAI = 8;

// Peluang tiap status pada satu hari kerja. Dibuat realistis:
// mayoritas hadir, sesekali terlambat, jarang izin/alpha.
const PELUANG = [
  { status: 'hadir', bobot: 68 },
  { status: 'terlambat', bobot: 18 },
  { status: 'izin', bobot: 9 },
  { status: 'alpha', bobot: 5 },
];

function acakStatus() {
  const total = PELUANG.reduce((a, p) => a + p.bobot, 0);
  let n = Math.random() * total;
  for (const p of PELUANG) {
    if (n < p.bobot) return p.status;
    n -= p.bobot;
  }
  return 'hadir';
}

function acakInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jam(h, m, s) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tanggalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const pegawai = await query(
    `SELECT u.id, u.name, COALESCE(s.start_time, '08:00:00') AS mulai, COALESCE(s.end_time, '17:00:00') AS selesai
     FROM users u LEFT JOIN shifts s ON u.shift_id = s.id
     WHERE u.role != 'admin' AND u.is_active = TRUE
     ORDER BY u.id`
  );

  if (pegawai.rows.length === 0) {
    console.log('Tidak ada pegawai aktif. Jalankan `npm run seed` dulu, lalu buat akun pegawai.');
    return;
  }

  const libur = await query(`SELECT to_char(date, 'YYYY-MM-DD') AS d FROM holidays`);
  const setLibur = new Set(libur.rows.map((r) => r.d));

  const hariIni = new Date();
  const mulai = new Date(hariIni.getFullYear(), BULAN_MULAI - 1, TANGGAL_MULAI);

  // Bersihkan dulu rentang yang sama supaya bisa dijalankan berulang
  // tanpa menumpuk data yang saling bertabrakan.
  const hapus = await query(
    `DELETE FROM attendance WHERE date >= $1 AND date <= $2`,
    [tanggalStr(mulai), tanggalStr(hariIni)]
  );

  let dibuat = 0;
  let dilewati = 0;

  for (const p of pegawai.rows) {
    const [jamMulai] = p.mulai.split(':').map(Number);

    for (let d = new Date(mulai); d <= hariIni; d.setDate(d.getDate() + 1)) {
      const tgl = tanggalStr(d);
      const hari = d.getDay();

      if (hari === 0 || hari === 6 || setLibur.has(tgl)) {
        dilewati++;
        continue;
      }

      const status = acakStatus();

      // izin & alpha tidak punya foto maupun jam
      if (status === 'izin' || status === 'alpha') {
        await query(
          `INSERT INTO attendance (user_id, date, status, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, date) DO NOTHING`,
          [p.id, tgl, status, status === 'izin' ? 'Keperluan keluarga (data demo)' : null]
        );
        dibuat++;
        continue;
      }

      // hadir: masuk sebelum jam shift. terlambat: sesudahnya.
      const masuk = status === 'hadir'
        ? jam(jamMulai - 1, acakInt(35, 59), acakInt(0, 59))
        : jam(jamMulai, acakInt(5, 45), acakInt(0, 59));

      const [jamSelesai] = p.selesai.split(':').map(Number);
      const pulang = jam(jamSelesai, acakInt(0, 40), acakInt(0, 59));

      await query(
        `INSERT INTO attendance (user_id, date, check_in_time, check_out_time, status)
         VALUES ($1, $2, $3::timestamp, $4::timestamp, $5)
         ON CONFLICT (user_id, date) DO NOTHING`,
        [p.id, tgl, `${tgl} ${masuk}`, `${tgl} ${pulang}`, status]
      );
      dibuat++;
    }
  }

  console.log('============================================');
  console.log('Data demo absensi berhasil dibuat.');
  console.log(`Pegawai   : ${pegawai.rows.map((p) => p.name).join(', ')}`);
  console.log(`Periode   : ${tanggalStr(mulai)} s/d ${tanggalStr(hariIni)}`);
  console.log(`Dibuat    : ${dibuat} catatan (${hapus.rowCount} catatan lama dihapus)`);
  console.log(`Dilewati  : ${dilewati} hari (akhir pekan & hari libur)`);
  console.log('============================================');
}

main()
  .catch((err) => {
    console.error('Gagal membuat data demo:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
