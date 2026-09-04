#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const R = require('../src/utils/retensi');

// ============================================================
// Perkakas masa simpan foto absensi dan lampiran pengajuan.
//
//   npm run foto:lihat    apa yang sudah lewat masa simpan
//   npm run foto:arsip    salin yang lewat masa simpan ke ARSIP_DIR
//
// Penghapusannya sendiri tetap di npm run purge:photos yang sudah ada --
// ia yang tahu mengosongkan photo_in_url di basis data. Sejak sekarang
// perintah itu MENOLAK menghapus foto yang belum diarsipkan, jadi urutan
// yang benar: lihat -> arsip -> serahkan salinannya ke dinas ->
// purge:photos.
//
// Pengarsipan dijalankan tangan, bukan cron, dan itu disengaja. Menyalin
// puluhan giga ke penyimpanan dinas adalah pekerjaan tahunan yang pantas
// dikerjakan sambil dilihat orangnya.
// ============================================================

const dasar = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

const arsipDir = process.env.ARSIP_DIR
  ? path.resolve(process.env.ARSIP_DIR)
  : path.join(dasar, '..', 'arsip');

const perintah = process.argv[2];
const bulanSimpan = R.BULAN_SIMPAN;

function mb(bita) {
  return `${(bita / 1024 / 1024).toFixed(1)} MB`;
}

// Bulan yang sudah lewat masa simpan, per jenis.
function yangLewat() {
  const hasil = [];
  for (const jenis of R.JENIS) {
    for (const bulan of R.daftarBulan(dasar, jenis)) {
      if (!R.lewatMasaSimpan(bulan, { bulanSimpan })) continue;
      const dir = path.join(dasar, jenis, bulan);
      const berkas = R.daftarBerkas(dir);
      const bita = berkas.reduce((a, n) => a + fs.statSync(path.join(dir, n)).size, 0);
      hasil.push({ jenis, bulan, jumlah: berkas.length, bita });
    }
  }
  return hasil;
}

function garis() {
  console.log('─'.repeat(64));
}

function lihat() {
  const daftar = yangLewat();
  console.log(`Masa simpan  : ${R.TAHUN_SIMPAN} tahun (${bulanSimpan} bulan)`);
  console.log(`Berkas asal  : ${dasar}`);
  console.log(`Arsip        : ${arsipDir}`);
  garis();

  if (daftar.length === 0) {
    console.log('Belum ada bulan yang lewat masa simpan. Tidak ada yang perlu dikerjakan.');
    return;
  }

  let total = 0;
  for (const d of daftar) {
    const p = R.bolehDihapus({ dasar, arsipDir, jenis: d.jenis, bulan: d.bulan });
    const tanda = p.boleh ? 'siap dihapus' : `BELUM: ${p.alasan}`;
    console.log(`${d.jenis.padEnd(8)} ${d.bulan}  ${String(d.jumlah).padStart(5)} berkas  ${mb(d.bita).padStart(10)}  ${tanda}`);
    total += d.bita;
  }
  garis();
  console.log(`Total yang bisa dibebaskan: ${mb(total)}`);
  console.log('');
  console.log('Langkah berikutnya: npm run foto:arsip, salin isi folder arsip ke');
  console.log('penyimpanan dinas, lalu npm run purge:photos.');
}

function arsip() {
  const daftar = yangLewat();
  if (daftar.length === 0) {
    console.log('Belum ada bulan yang lewat masa simpan.');
    return;
  }

  console.log(`Menyalin ke ${arsipDir}`);
  garis();
  for (const d of daftar) {
    process.stdout.write(`${d.jenis.padEnd(8)} ${d.bulan}  ${String(d.jumlah).padStart(5)} berkas ... `);
    const m = R.arsipkanBulan({ dasar, arsipDir, jenis: d.jenis, bulan: d.bulan });
    console.log(`selesai, ${mb(m.total_bita)}, sidik cocok semua`);
  }
  garis();
  console.log('SALIN ISI FOLDER ARSIP KE PENYIMPANAN DINAS SEKARANG.');
  console.log('Setelah itu baru jalankan: npm run purge:photos');
}

const perintahTersedia = { lihat, arsip };

if (!perintahTersedia[perintah]) {
  console.log('Pemakaian: node scripts/retensiFoto.js <lihat|arsip>');
  console.log('');
  console.log('  lihat      apa yang sudah lewat masa simpan, dan sudah siap dihapus atau belum');
  console.log('  arsip      salin yang lewat masa simpan ke ARSIP_DIR, lalu buktikan salinannya utuh');
  console.log('');
  console.log('Penghapusannya: npm run purge:photos (menolak yang belum diarsipkan).');
  process.exit(1);
}

try {
  perintahTersedia[perintah]();
} catch (err) {
  console.error(`Gagal: ${err.message}`);
  process.exit(1);
}
