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
const { uploadFotoAbsensi, hapusFotoLama } = require('../src/utils/uploadPhoto');
const { gambarContoh } = require('./foto-contoh');
const { durasiMenit } = require('../src/utils/shiftWindow');
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

function tanggalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ubah "2026-08-20" + "07:41:12" jadi objek Date lokal, supaya nama berkas
// fotonya memakai tanggal & jam absen -- bukan waktu seed dijalankan.
function waktuDari(tgl, jamStr) {
  const [y, m, d] = tgl.split('-').map(Number);
  const [hh, mm, ss] = jamStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

// Tulis satu foto contoh ke disk dengan penamaan yang sama persis seperti
// absen sungguhan, lalu kembalikan path relatifnya untuk disimpan di database.
async function fotoDemo(p, waktu, jenis) {
  return uploadFotoAbsensi(gambarContoh(p.id), {
    userId: p.id,
    userName: p.name,
    jenis,
    waktu,
  });
}

// "2026-08-21 22:05:13" -- bentuk yang diterima kolom TIMESTAMP.
function stempel(d) {
  const jj = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getSeconds()).padStart(2, '0');
  return `${tanggalStr(d)} ${jj}:${mm}:${dd}`;
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

  // Bersihkan dulu rentang yang sama supaya bisa dijalankan berulang tanpa
  // menumpuk data yang saling bertabrakan. Berkas fotonya ikut dibuang
  // supaya tidak ada foto yatim yang tertinggal di disk.
  const fotoLama = await query(
    `SELECT photo_in_url, photo_out_url FROM attendance
     WHERE date >= $1 AND date <= $2
       AND (photo_in_url IS NOT NULL OR photo_out_url IS NOT NULL)`,
    [tanggalStr(mulai), tanggalStr(hariIni)]
  );
  for (const baris of fotoLama.rows) {
    await hapusFotoLama(baris.photo_in_url);
    await hapusFotoLama(baris.photo_out_url);
  }

  const hapus = await query(
    `DELETE FROM attendance WHERE date >= $1 AND date <= $2`,
    [tanggalStr(mulai), tanggalStr(hariIni)]
  );

  let dibuat = 0;
  let dilewati = 0;
  let foto = 0;

  for (const p of pegawai.rows) {
    const lamaShift = durasiMenit({ start_time: p.mulai, end_time: p.selesai });

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

      // Jam absen dihitung dari kejadian shift yang konkret, bukan dari
      // angka jam saja. Untuk shift malam 22:00-06:00, absen pulang otomatis
      // jatuh di tanggal berikutnya -- kalau tidak, data demo akan tampil
      // ganjil: "masuk 22.05, pulang 06.12" di tanggal yang sama.
      const shiftMulai = waktuDari(tgl, p.mulai);
      const shiftSelesai = new Date(shiftMulai.getTime() + lamaShift * 60000);

      const masuk = new Date(shiftMulai.getTime() + (status === 'hadir'
        ? -acakInt(1, 25) * 60000       // hadir: datang sebelum jam shift
        : acakInt(5, 45) * 60000));     // terlambat: sesudahnya
      masuk.setSeconds(acakInt(0, 59));

      // Sekitar 1 dari 8 hari sengaja tidak punya absen pulang -- kejadian
      // nyata (pegawai lupa absen pulang) dan sekaligus memperlihatkan slot
      // foto kosong di galeri saat diperagakan.
      const lupaPulang = Math.random() < 0.12;
      let pulang = null;
      if (!lupaPulang) {
        pulang = new Date(shiftSelesai.getTime() + acakInt(0, 40) * 60000);
        pulang.setSeconds(acakInt(0, 59));
      }

      const fotoMasuk = await fotoDemo(p, masuk, 'masuk');
      const fotoPulang = pulang ? await fotoDemo(p, pulang, 'pulang') : null;
      foto += pulang ? 2 : 1;

      await query(
        `INSERT INTO attendance (user_id, date, check_in_time, check_out_time, status, photo_in_url, photo_out_url)
         VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, $6, $7)
         ON CONFLICT (user_id, date) DO NOTHING`,
        [p.id, tgl, stempel(masuk), pulang ? stempel(pulang) : null, status, fotoMasuk, fotoPulang]
      );
      dibuat++;
    }
  }

  console.log('============================================');
  console.log('Data demo absensi berhasil dibuat.');
  console.log(`Pegawai   : ${pegawai.rows.map((p) => p.name).join(', ')}`);
  console.log(`Periode   : ${tanggalStr(mulai)} s/d ${tanggalStr(hariIni)}`);
  console.log(`Dibuat    : ${dibuat} catatan (${hapus.rowCount} catatan lama dihapus)`);
  console.log(`Foto      : ${foto} berkas contoh di uploads/absensi/`);
  console.log(`Dilewati  : ${dilewati} hari (akhir pekan & hari libur)`);
  console.log('============================================');
}

main()
  .catch((err) => {
    console.error('Gagal membuat data demo:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
