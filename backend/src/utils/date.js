// Utilitas tanggal berbasis zona waktu lokal server (env TZ, mis. Asia/Makassar).
// PENTING: jangan pakai new Date().toISOString() untuk tanggal absensi --
// toISOString() selalu UTC, sehingga absensi dini hari (sebelum pukul 07.00
// di WITA, 08.00 di WIB) akan tercatat di tanggal yang salah.
function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "2026-08-26 08:33:41" -- jam dinding kantor menurut jam API, siap
// dimasukkan ke kolom TIMESTAMP tanpa zona waktu.
//
// Kenapa tidak memakai NOW() milik Postgres: jam absensi diputuskan di
// tiga tempat sekaligus -- status terlambat, nama berkas foto, dan cap
// yang ditanam di gambar -- dan ketiganya memakai jam API. Kalau kolom
// waktunya diisi NOW(), jamnya datang dari proses lain yang zona waktunya
// disetel terpisah (container database). Begitu keduanya tidak sama,
// foto bercap 08.33 WITA bisa tersimpan sebagai catatan pukul 00.33 --
// bertengkar dengan buktinya sendiri. Satu sumber jam, tidak ada selisih.
function sekarangLokalSql(waktu = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${waktu.getFullYear()}-${p(waktu.getMonth() + 1)}-${p(waktu.getDate())} `
    + `${p(waktu.getHours())}:${p(waktu.getMinutes())}:${p(waktu.getSeconds())}`;
}

// Zona waktu kantor. Default WITA karena itu lokasi pemakai pertama;
// diubah lewat TZ di .env kalau kantornya di zona lain.
const ZONA_DEFAULT = 'Asia/Makassar';

function zonaWaktu() {
  return process.env.TZ || ZONA_DEFAULT;
}

// Singkatan zona untuk ditampilkan ke orang: "WITA", "WIB", "WIT".
//
// Indonesia sengaja dipetakan manual. Intl memang bisa memberi nama zona,
// tapi untuk locale id-ID hasilnya "GMT+8" -- bukan istilah yang dikenali
// pegawai, dan cap di foto absensi harus terbaca seperti jam dinding kantor.
const LABEL_ZONA = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
};

function labelZona() {
  const zona = zonaWaktu();
  if (LABEL_ZONA[zona]) return LABEL_ZONA[zona];
  // Zona di luar Indonesia: pakai selisih UTC-nya, mis. "UTC+7".
  const menit = -new Date().getTimezoneOffset();
  const tanda = menit < 0 ? '-' : '+';
  const jam = Math.floor(Math.abs(menit) / 60);
  const sisa = Math.abs(menit) % 60;
  return `UTC${tanda}${jam}${sisa ? `.${String(sisa).padStart(2, '0')}` : ''}`;
}

module.exports = { todayLocal, sekarangLokalSql, zonaWaktu, labelZona };
