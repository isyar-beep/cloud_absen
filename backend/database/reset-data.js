// ============================================================
// Kosongkan data operasional untuk uji coba dari nol.
//
// Yang DIHAPUS:
//   - Semua akun pegawai (role != 'admin') berikut absensi, izin,
//     koreksi, dan penetapan WFA miliknya
//   - Seluruh catatan absensi, termasuk yang tertinggal milik admin
//   - Berkas foto absensi, lampiran izin, dan foto profil pegawai
//   - Catatan aktivitas admin
//
// Yang DIPERTAHANKAN:
//   - Akun admin (kalau ikut terhapus, pemiliknya terkunci di luar
//     aplikasinya sendiri)
//   - Shift berikut jam dan hari kerjanya
//   - Hari libur
//   - Departemen
//
// URUTANNYA PENTING: daftar berkas dibaca dari database, berkasnya
// dihapus, baru barisnya. Kalau dibalik, daftar berkas mana yang harus
// dihapus sudah hilang lebih dulu dan folder uploads menyisakan ratusan
// foto yatim yang tidak lagi ditunjuk siapa pun.
//
// Jalankan: npm run reset:data
// ============================================================
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { pool, query } = require('../src/config/db');
const { hapusFotoLama, uploadDir } = require('../src/utils/uploadPhoto');
require('dotenv').config();

const KATA_KUNCI = 'HAPUS';

// Satu-satunya folder unggahan yang TIDAK dikosongkan seluruhnya. Foto
// profil admin ada di situ juga, dan admin memang dipertahankan.
//
// Sengaja daftar pengecualian, bukan daftar folder-yang-dihapus: versi
// lama aplikasi ini pernah menulis ke folder dengan nama lain (mis.
// `checkin/`), dan daftar tetap akan melewatkannya diam-diam. Apa pun
// yang ada di uploads selain avatar adalah berkas pegawai.
const FOLDER_DIKECUALIKAN = new Set(['avatar']);

function jalurBerkas(url) {
  if (!url) return null;
  const bersih = String(url).replace(/^\/uploads\//, '').replace(/^\/+/, '');
  if (!bersih || bersih.includes('..')) return null;
  return path.join(uploadDir, bersih);
}

// Hitung seluruh berkas di dalam sebuah folder unggahan.
async function hitungBerkas(namaFolder) {
  const dasar = path.join(uploadDir, namaFolder);
  let jumlah = 0;
  async function telusuri(dir) {
    let isi;
    try {
      isi = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const item of isi) {
      const penuh = path.join(dir, item.name);
      if (item.isDirectory()) await telusuri(penuh);
      else jumlah += 1;
    }
  }
  await telusuri(dasar);
  return jumlah;
}

// Berkas di folder unggahan mana pun selain avatar, absensi, dan dokumen
// -- biasanya peninggalan versi lama. Dihitung terpisah supaya muncul di
// ringkasan sebelum konfirmasi, bukan menghilang tanpa disebut.
async function hitungBerkasLain() {
  let isi;
  try {
    isi = await fs.promises.readdir(uploadDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  let jumlah = 0;
  for (const item of isi) {
    if (!item.isDirectory()) continue;
    if (FOLDER_DIKECUALIKAN.has(item.name) || item.name === 'absensi' || item.name === 'dokumen') continue;
    jumlah += await hitungBerkas(item.name);
  }
  return jumlah;
}

// Kosongkan seluruh folder unggahan kecuali yang dikecualikan.
// Mengembalikan daftar nama folder yang dihapus, untuk dilaporkan.
async function hapusFolderPegawai() {
  let isi;
  try {
    isi = await fs.promises.readdir(uploadDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const dihapus = [];
  for (const item of isi) {
    if (!item.isDirectory() || FOLDER_DIKECUALIKAN.has(item.name)) continue;
    await fs.promises.rm(path.join(uploadDir, item.name), { recursive: true, force: true });
    dihapus.push(item.name);
  }
  return dihapus;
}

// Kosongkan folder avatar KECUALI berkas yang masih ditunjuk akun yang
// bertahan. Tanpa pengecualian ini, admin kehilangan foto profilnya dan
// aplikasinya menampilkan gambar rusak setelah reset.
async function bersihkanAvatar(urlDipertahankan) {
  const simpan = new Set(
    urlDipertahankan.map((u) => jalurBerkas(u)).filter(Boolean)
  );
  const dasar = path.join(uploadDir, 'avatar');
  let dihapus = 0;

  let isi;
  try {
    isi = await fs.promises.readdir(dasar, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }

  for (const item of isi) {
    const penuh = path.join(dasar, item.name);
    if (item.isDirectory()) continue;
    if (simpan.has(penuh)) continue;
    await fs.promises.unlink(penuh).catch(() => {});
    dihapus += 1;
  }
  return dihapus;
}

async function ringkasan() {
  const [pegawai, absensi, izin, koreksi, wfa, log, admin] = await Promise.all([
    query("SELECT COUNT(*) AS n FROM users WHERE role != 'admin'"),
    query('SELECT COUNT(*) AS n FROM attendance'),
    query('SELECT COUNT(*) AS n FROM leave_requests'),
    query('SELECT COUNT(*) AS n FROM correction_requests'),
    query('SELECT COUNT(*) AS n FROM wfa_assignments'),
    query('SELECT COUNT(*) AS n FROM admin_logs'),
    query("SELECT id, name, email, avatar_url FROM users WHERE role = 'admin' ORDER BY id"),
  ]);

  return {
    pegawai: Number(pegawai.rows[0].n),
    absensi: Number(absensi.rows[0].n),
    izin: Number(izin.rows[0].n),
    koreksi: Number(koreksi.rows[0].n),
    wfa: Number(wfa.rows[0].n),
    log: Number(log.rows[0].n),
    admin: admin.rows,
    fotoAbsensi: await hitungBerkas('absensi'),
    dokumen: await hitungBerkas('dokumen'),
    berkasLain: await hitungBerkasLain(),
  };
}

function tanya(pertanyaan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((selesai) => {
    rl.question(pertanyaan, (jawab) => {
      rl.close();
      selesai(jawab.trim());
    });
  });
}

async function main() {
  // Penjaga pertama. Script ini menghapus seluruh data operasional dan
  // tidak punya tombol batal -- di server produksi ia tidak boleh bisa
  // berjalan sama sekali, walau seseorang salah mengetik perintah.
  if (process.env.NODE_ENV === 'production') {
    console.error('DITOLAK: NODE_ENV=production.');
    console.error('Script ini hanya untuk uji coba lokal, bukan server produksi.');
    process.exitCode = 1;
    return;
  }

  const r = await ringkasan();

  if (r.admin.length === 0) {
    console.error('DITOLAK: tidak ada akun admin di database.');
    console.error('Tanpa admin yang bertahan, Anda akan terkunci di luar aplikasi.');
    console.error('Jalankan `npm run seed` dulu untuk membuat akun admin.');
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('============================================');
  console.log(' KOSONGKAN DATA UJI COBA');
  console.log('============================================');
  console.log('');
  console.log('Akan DIHAPUS:');
  console.log(`  Akun pegawai         : ${r.pegawai}`);
  console.log(`  Catatan absensi      : ${r.absensi}`);
  console.log(`  Pengajuan izin       : ${r.izin}`);
  console.log(`  Pengajuan koreksi    : ${r.koreksi}`);
  console.log(`  Penetapan WFA        : ${r.wfa}`);
  console.log(`  Catatan aktivitas    : ${r.log}`);
  console.log(`  Berkas foto absensi  : ${r.fotoAbsensi}`);
  console.log(`  Berkas lampiran izin : ${r.dokumen}`);
  if (r.berkasLain > 0) {
    console.log(`  Berkas folder lain   : ${r.berkasLain}  (peninggalan versi lama)`);
  }
  console.log('');
  console.log('Akan DIPERTAHANKAN:');
  r.admin.forEach((a) => console.log(`  Admin                : ${a.name} <${a.email}>`));
  console.log('  Shift, hari libur, dan departemen tetap utuh.');
  console.log('');
  console.log(`  Database             : ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`  Folder unggahan      : ${uploadDir}`);
  console.log('');

  if (r.pegawai === 0 && r.absensi === 0 && r.fotoAbsensi === 0
    && r.dokumen === 0 && r.berkasLain === 0 && r.izin === 0
    && r.koreksi === 0 && r.wfa === 0 && r.log === 0) {
    console.log('Tidak ada yang perlu dihapus. Datanya memang sudah kosong.');
    return;
  }

  // Penjaga kedua. `--ya` disediakan untuk pemakaian terjadwal, tapi
  // sengaja tidak dipromosikan: mengetik kata kuncinya memaksa orang
  // membaca dulu daftar di atas.
  if (process.argv.includes('--ya')) {
    console.log('Dilewati konfirmasi karena --ya diberikan.');
  } else {
    const jawab = await tanya(`Ketik ${KATA_KUNCI} untuk melanjutkan (apa pun selain itu membatalkan): `);
    if (jawab !== KATA_KUNCI) {
      console.log('Dibatalkan. Tidak ada yang dihapus.');
      return;
    }
  }

  console.log('');

  // --- 1. Berkas lebih dulu, selagi daftarnya masih ada di database ---
  const berkas = await query(
    `SELECT photo_in_url, photo_out_url FROM attendance
     WHERE photo_in_url IS NOT NULL OR photo_out_url IS NOT NULL`
  );
  for (const baris of berkas.rows) {
    await hapusFotoLama(baris.photo_in_url);
    await hapusFotoLama(baris.photo_out_url);
  }

  const dokumen = await query(
    'SELECT document_url FROM leave_requests WHERE document_url IS NOT NULL'
  );
  for (const baris of dokumen.rows) {
    await hapusFotoLama(baris.document_url);
  }

  // Sapu bersih sisanya. Berkas bisa tertinggal karena unggahan yang
  // gagal di tengah jalan, baris yang pernah dihapus manual, atau folder
  // dari versi aplikasi yang lebih lama -- tidak satu pun dari ketiganya
  // akan muncul di kueri mana pun.
  const folderDihapus = await hapusFolderPegawai();
  const avatarDihapus = await bersihkanAvatar(
    r.admin.map((a) => a.avatar_url).filter(Boolean)
  );

  console.log(`Berkas foto & lampiran dihapus (${r.fotoAbsensi + r.dokumen} terdaftar di database).`);
  if (folderDihapus.length > 0) {
    console.log(`Folder unggahan dikosongkan: ${folderDihapus.join(', ')}.`);
  }
  console.log(`Foto profil pegawai dihapus: ${avatarDihapus} berkas.`);

  // --- 2. Baru barisnya ---
  //
  // attendance dihapus terpisah, tidak mengandalkan CASCADE dari users:
  // baris yang pernah dibuat untuk akun yang sudah tidak ada, atau milik
  // admin sendiri, tidak akan tersapu oleh penghapusan pegawai.
  await query('DELETE FROM attendance');
  await query('DELETE FROM leave_requests');
  await query('DELETE FROM correction_requests');
  await query('DELETE FROM wfa_assignments');
  await query('DELETE FROM admin_logs');

  const hapusPegawai = await query("DELETE FROM users WHERE role != 'admin' RETURNING id");

  console.log(`Akun pegawai dihapus: ${hapusPegawai.rows.length}.`);
  console.log('Catatan absensi, izin, koreksi, WFA, dan aktivitas admin dikosongkan.');
  console.log('');
  console.log('Selesai. Shift, hari libur, dan akun admin tidak disentuh.');
  console.log('');
  console.log('Langkah berikutnya:');
  console.log('  1. Login sebagai admin');
  console.log('  2. Buat akun pegawai di menu Pengguna');
  console.log('  3. Assign shift tiap pegawai di menu yang sama');
  console.log('');
}

main()
  .catch((err) => {
    console.error('Gagal mengosongkan data:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
