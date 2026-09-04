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
// SEJAK SEKARANG FOTO YANG BELUM DIARSIPKAN TIDAK IKUT DIHAPUS.
//
// Dinas menyimpan sendiri foto tiap tahun sebagai datanya. Penghapusan
// yang berjalan sebelum penyalinan itu bukan penghematan disk, melainkan
// penghancuran data orang lain -- dan karena skrip ini dipasang di cron
// bulanan, kejadiannya akan berlangsung diam-diam sampai ada yang mencari
// foto lama dan tidak menemukannya lagi.
//
// Urutan yang benar:
//   1. npm run foto:lihat    -- apa yang sudah lewat masa simpan
//   2. npm run foto:arsip    -- salin ke ARSIP_DIR, sha256 tiap berkas dicek
//   3. serahkan salinannya ke dinas
//   4. npm run purge:photos  -- baru menghapus
//
// Foto yang manifesnya belum ada akan DILEWATI, bukan menggagalkan
// seluruh proses: sebagian yang sudah diarsipkan tetap dibersihkan, dan
// sisanya dilaporkan dengan alasannya.
//
// Pengamanan ini bisa dimatikan dengan WAJIB_ARSIP=false bagi yang memang
// tidak menghendaki penyalinan. Itu pilihan yang sah, tapi harus diambil
// dengan sengaja -- bukan menjadi bawaan yang tidak pernah disadari.
//
// Jalankan manual : npm run purge:photos
// Terjadwal (cron): lihat docs/deployment.md
// ============================================================
const path = require('path');
const { pool, query } = require('../src/config/db');
const { hapusFotoLama } = require('../src/utils/uploadPhoto');
const R = require('../src/utils/retensi');
require('dotenv').config();

const SIMPAN_TAHUN = Number(process.env.PHOTO_RETENTION_YEARS) || 2;
const WAJIB_ARSIP = String(process.env.WAJIB_ARSIP || 'true') !== 'false';

const dasar = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
const arsipDir = process.env.ARSIP_DIR
  ? path.resolve(process.env.ARSIP_DIR)
  : path.join(dasar, '..', 'arsip');

// Apakah satu foto sudah punya salinan yang tercatat di manifes bulannya?
// Yang diperiksa keberadaan BERKAS ITU di dalam manifes, bukan sekadar
// ada-tidaknya manifes bulan itu -- foto yang masuk setelah pengarsipan
// (mis. dari koreksi absensi yang disetujui belakangan) tidak punya
// salinan, dan justru itu yang paling mudah terlewat.
function sudahDiarsipkan(url) {
  if (!WAJIB_ARSIP) return true;
  const b = R.bulanDariUrl(url);
  if (!b) return false;
  return R.manifesMemuat(arsipDir, b.jenis, b.bulan, path.basename(url));
}

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
  let dilewati = 0;
  const bulanTertunda = new Set();

  for (const baris of hasil.rows) {
    // Kolom di basis data hanya dikosongkan untuk foto yang BENAR-BENAR
    // dihapus. Mengosongkannya lebih dulu akan membuat foto yang masih
    // ada di disk kehilangan penunjuknya -- ia menjadi berkas yatim yang
    // tidak bisa dibuka siapa pun dan tidak akan pernah terhapus.
    const kolom = { photo_in_url: baris.photo_in_url, photo_out_url: baris.photo_out_url };
    const dikosongkan = [];

    for (const [nama, url] of Object.entries(kolom)) {
      if (!url) continue;
      if (!sudahDiarsipkan(url)) {
        dilewati += 1;
        const b = R.bulanDariUrl(url);
        if (b) bulanTertunda.add(`${b.jenis}/${b.bulan}`);
        continue;
      }
      await hapusFotoLama(url);
      berkasDihapus += 1;
      dikosongkan.push(nama);
    }

    if (dikosongkan.length > 0) {
      await query(
        `UPDATE attendance SET ${dikosongkan.map((k) => `${k} = NULL`).join(', ')} WHERE id = $1`,
        [baris.id]
      );
    }
  }

  console.log('============================================');
  console.log(`Masa simpan  : ${SIMPAN_TAHUN} tahun (sebelum ${batasStr})`);
  console.log(`Berkas hapus : ${berkasDihapus} foto dari ${hasil.rows.length} catatan`);
  if (dilewati > 0) {
    console.log(`DILEWATI     : ${dilewati} foto belum diarsipkan`);
    console.log(`Bulan        : ${[...bulanTertunda].sort().join(', ')}`);
    console.log('Jalankan `npm run foto:arsip`, serahkan salinannya ke dinas,');
    console.log('lalu ulangi perintah ini.');
  }
  if (!WAJIB_ARSIP) {
    console.log('CATATAN      : WAJIB_ARSIP=false -- foto dihapus tanpa disalin lebih dulu.');
  }
  console.log('Catatan absensinya sendiri tetap utuh.');
  console.log('============================================');
}

main()
  .catch((err) => {
    console.error('Gagal membersihkan foto lama:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
