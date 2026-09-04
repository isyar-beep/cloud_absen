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
