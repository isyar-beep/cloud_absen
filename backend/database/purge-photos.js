// ============================================================
// Hapus foto absensi yang sudah melewati masa simpan.
//
// Kebijakan: foto disimpan 2 tahun. Untuk 50 pegawai, foto absensi
// tumbuh sekitar 8 GB per tahun -- tanpa pembersihan, disk VPS akan
// penuh dalam beberapa tahun.
//
// Yang dihapus hanya BERKAS FOTO-nya. Catatan absensinya (tanggal,
// jam, status) tetap utuh selamanya, karena itu yang dipakai laporan
// dan perhitungan statistik.
//
// Jalankan manual : npm run purge:photos
// Terjadwal (cron): lihat docs/deployment.md
// ============================================================
const { pool, query } = require('../src/config/db');
const { hapusFotoLama } = require('../src/utils/uploadPhoto');
require('dotenv').config();

const SIMPAN_TAHUN = Number(process.env.PHOTO_RETENTION_YEARS) || 2;

async function main() {
  const batas = new Date();
  batas.setFullYear(batas.getFullYear() - SIMPAN_TAHUN);
  const batasStr = `${batas.getFullYear()}-${String(batas.getMonth() + 1).padStart(2, '0')}-${String(batas.getDate()).padStart(2, '0')}`;

  const hasil = await query(
    `SELECT id, photo_in_url, photo_out_url FROM attendance
     WHERE date < $1 AND (photo_in_url IS NOT NULL OR photo_out_url IS NOT NULL)`,
    [batasStr]
  );

  if (hasil.rows.length === 0) {
    console.log(`Tidak ada foto sebelum ${batasStr} yang perlu dihapus.`);
    return;
  }

  let berkasDihapus = 0;
  for (const baris of hasil.rows) {
    for (const url of [baris.photo_in_url, baris.photo_out_url]) {
      if (url) {
        await hapusFotoLama(url);
        berkasDihapus++;
      }
    }
    await query(
      'UPDATE attendance SET photo_in_url = NULL, photo_out_url = NULL WHERE id = $1',
      [baris.id]
    );
  }

  console.log('============================================');
  console.log(`Masa simpan  : ${SIMPAN_TAHUN} tahun (sebelum ${batasStr})`);
  console.log(`Berkas hapus : ${berkasDihapus} foto dari ${hasil.rows.length} catatan`);
  console.log('Catatan absensinya sendiri tetap utuh.');
  console.log('============================================');
}

main()
  .catch((err) => {
    console.error('Gagal membersihkan foto lama:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
