#!/usr/bin/env node
// ============================================================
// Pemeriksaan sebelum membangun APK.
//
// Build EAS berjalan sekitar sepuluh menit dan antre di server orang
// lain. Kesalahan yang baru ketahuan setelah APK terpasang di HP --
// alamat server yang lupa diisi, misalnya -- berarti dua kali sepuluh
// menit ditambah waktu memasang ulang. Yang diperiksa di sini semuanya
// bisa diketahui dalam sepersekian detik.
//
// Jalankan: npm run periksa:build
// ============================================================

const fs = require('node:fs');
const path = require('node:path');

const akar = path.join(__dirname, '..');
const baca = (f) => JSON.parse(fs.readFileSync(path.join(akar, f), 'utf8'));

const galat = [];
const ingat = [];

// --- 1. Alamat server ---
//
// Kesalahan yang paling mahal dan paling mudah terjadi. APK yang
// dibangun tanpa alamat akan menunjuk komputer pengembang, dan itu baru
// ketahuan saat pegawai pertama mencoba login.
let eas;
try {
  eas = baca('eas.json');
} catch {
  galat.push('eas.json tidak ada. Tanpa itu `eas build` menghasilkan AAB yang tidak bisa dipasang langsung.');
}

if (eas) {
  for (const profil of ['preview', 'production']) {
    const p = eas.build?.[profil];
    if (!p) { galat.push(`Profil "${profil}" tidak ada di eas.json.`); continue; }

    const url = p.env?.EXPO_PUBLIC_API_URL;
    if (!url) {
      galat.push(`Profil "${profil}": EXPO_PUBLIC_API_URL belum diisi.`);
    } else if (url.includes('GANTI-DENGAN')) {
      galat.push(`Profil "${profil}": EXPO_PUBLIC_API_URL masih berisi contoh (${url}).`);
    } else if (/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./.test(url)) {
      galat.push(`Profil "${profil}": EXPO_PUBLIC_API_URL menunjuk alamat jaringan lokal (${url}). HP pegawai di luar kantor tidak akan bisa menjangkaunya.`);
    } else if (!url.startsWith('https://')) {
      galat.push(`Profil "${profil}": alamat harus https (${url}). Absensi mengirim foto wajah dan password; http mengirimkannya terbaca.`);
    } else if (!url.endsWith('/api')) {
      ingat.push(`Profil "${profil}": alamat biasanya berakhiran /api (sekarang ${url}). Pastikan ini disengaja.`);
    }
  }

  // --- 2. Bentuk berkas Android ---
  if (eas.build?.preview?.android?.buildType !== 'apk') {
    galat.push('Profil "preview" harus menghasilkan APK. AAB tidak bisa dipasang langsung dari berkas.');
  }
}

// --- 3. Versi selaras ---
//
// Versi di app.json yang tampil di HP, versi di package.json yang
// terbaca perkakas. Kalau berselisih, laporan masalah menunjuk kode
// yang keliru.
const app = baca('app.json');
const pkg = baca('package.json');
if (app.expo.version !== pkg.version) {
  galat.push(`Versi berselisih: app.json ${app.expo.version} vs package.json ${pkg.version}.`);
}

// --- 4. Izin Android yang memang dibutuhkan ---
const izin = app.expo.android?.permissions || [];
for (const wajib of ['CAMERA', 'ACCESS_FINE_LOCATION']) {
  if (!izin.includes(wajib)) {
    galat.push(`Izin ${wajib} belum didaftarkan di app.json. Absen foto berkoordinat tidak akan bekerja.`);
  }
}

// --- 5. Nama paket Android ---
if (!app.expo.android?.package) {
  galat.push('app.json: android.package belum diisi. Build akan ditolak.');
}

// --- 6. Berkas .env tidak boleh ikut mengacaukan ---
//
// .env di folder mobile dipakai saat pengembangan dan biasanya berisi
// alamat komputer sendiri. EAS membacanya juga, dan nilainya bisa
// menimpa yang dari eas.json.
if (fs.existsSync(path.join(akar, '.env'))) {
  const isi = fs.readFileSync(path.join(akar, '.env'), 'utf8');
  if (/EXPO_PUBLIC_API_URL\s*=\s*\S/.test(isi)) {
    galat.push('Berkas mobile/.env memuat EXPO_PUBLIC_API_URL. Isinya bisa menimpa alamat dari eas.json — hapus atau kosongkan sebelum build.');
  }
}

// --- Hasil ---
const H = { merah: '\x1b[31m', kuning: '\x1b[33m', hijau: '\x1b[32m', mati: '\x1b[0m' };

if (ingat.length) {
  console.log(`\n${H.kuning}Perlu diperhatikan:${H.mati}`);
  ingat.forEach((p) => console.log(`  - ${p}`));
}

if (galat.length) {
  console.log(`\n${H.merah}Belum siap dibangun:${H.mati}`);
  galat.forEach((p) => console.log(`  - ${p}`));
  console.log('');
  process.exit(1);
}

console.log(`\n${H.hijau}Siap dibangun.${H.mati}`);
console.log(`  versi        : ${app.expo.version}`);
console.log(`  paket        : ${app.expo.android.package}`);
console.log(`  alamat server: ${eas.build.preview.env.EXPO_PUBLIC_API_URL}`);
console.log(`\n  eas build --platform android --profile preview\n`);
