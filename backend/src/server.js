require('dotenv').config();

// Validasi env wajib saat startup -- lebih baik gagal cepat dengan pesan jelas
// daripada error membingungkan saat request pertama masuk.
//
// Sengaja masih console.error dan bukan pencatat: pada titik ini
// konfigurasinya memang belum tentu sah, dan pesan ini ditujukan kepada
// orang yang sedang memasang, bukan untuk disaring nanti.
const wajib = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const kosong = wajib.filter((key) => !process.env[key]);
if (kosong.length > 0) {
  console.error('Konfigurasi .env belum lengkap. Variabel berikut wajib diisi:');
  kosong.forEach((key) => console.error(`  - ${key}`));
  console.error('Salin .env.example ke .env lalu isi nilainya.');
  process.exit(1);
}

// JWT_SECRET yang lemah = seluruh sistem token bisa ditembus.
//
// Sebelumnya yang diperiksa hanya "ada isinya", sehingga JWT_SECRET=asdf
// lolos tanpa keberatan apa pun. deployment.md memang menyuruh memakai
// `openssl rand -hex 32`, tapi itu instruksi yang bisa dilewatkan orang
// yang sedang buru-buru memasang -- dan kalau dilewatkan, tidak ada satu
// pun gejala yang menunjukkannya. Sistemnya berjalan normal sambil
// tokennya bisa dipalsukan siapa saja yang menebak kuncinya.
//
// Karena itu diperiksa di sini, bukan diserahkan pada kedisiplinan orang.
const RAHASIA_MINIMAL = 32;
const rahasia = process.env.JWT_SECRET;
const rahasiaContoh = ['rahasia', 'secret', 'changeme', 'testsecret1234567890'];

if (process.env.NODE_ENV === 'production') {
  const keluhan = [];
  if (rahasia.length < RAHASIA_MINIMAL) {
    keluhan.push(`panjangnya hanya ${rahasia.length} karakter, minimal ${RAHASIA_MINIMAL}`);
  }
  // Nilai contoh yang tersalin apa adanya dari dokumentasi atau berkas uji.
  if (rahasiaContoh.some((c) => rahasia.toLowerCase().includes(c))) {
    keluhan.push('isinya memuat kata yang lazim dipakai sebagai contoh');
  }
  // Satu huruf diulang, atau variasi karakternya terlalu sedikit untuk
  // bisa disebut acak.
  if (new Set(rahasia).size < 8) {
    keluhan.push('variasi karakternya terlalu sedikit untuk nilai acak');
  }

  if (keluhan.length > 0) {
    console.error('JWT_SECRET tidak layak dipakai di produksi:');
    keluhan.forEach((k) => console.error(`  - ${k}`));
    console.error('');
    console.error('Buat yang baru:  openssl rand -hex 32');
    console.error('');
    console.error('CATATAN: mengganti JWT_SECRET membuat seluruh sesi yang');
    console.error('sedang berjalan berakhir. Semua orang perlu login ulang.');
    process.exit(1);
  }
}

const app = require('./app');
const { catatan, dariGalat } = require('./utils/catatan');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  catatan.info('Server cloud_absen menyala', {
    port: Number(PORT),
    mode: process.env.NODE_ENV || 'development',
    zona_waktu: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
    versi: require('../package.json').version,
  });
});

// ============================================================
// Kematian proses yang tidak dicatat adalah keadaan terburuk yang bisa
// dialami sistem ini: PM2 menyalakannya kembali dalam sedetik, pemantauan
// tetap hijau, dan tidak ada satu pun jejak mengapa ia mati. Sistemnya
// tampak sehat sambil terus jatuh berkali-kali sehari.
//
// Keduanya di bawah ini dicatat lalu SENGAJA dibiarkan mematikan proses.
// Melanjutkan hidup setelah galat yang tak tertangani berarti berjalan
// dengan keadaan yang sudah tidak diketahui benar-tidaknya -- dan pada
// sistem yang menentukan pembayaran orang, data yang salah lebih buruk
// daripada layanan yang mati sebentar.
// ============================================================

function matiRapi(alasan, err) {
  catatan.galat(alasan, dariGalat(err));
  // Diberi waktu supaya barisnya sempat tertulis sebelum proses hilang.
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('uncaughtException', (err) => matiRapi('Galat tak tertangani, proses dihentikan', err));
process.on('unhandledRejection', (err) => matiRapi('Promise ditolak tanpa penangan, proses dihentikan', err));

// SIGTERM datang dari PM2/systemd saat menyalakan ulang. Ditutup rapi
// supaya permintaan yang sedang berjalan -- misalnya unggahan foto absen
// yang belum selesai tersimpan -- tidak terputus di tengah.
process.on('SIGTERM', () => {
  catatan.info('SIGTERM diterima, server ditutup rapi');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
});
