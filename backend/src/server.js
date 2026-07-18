require('dotenv').config();

// Validasi env wajib saat startup -- lebih baik gagal cepat dengan pesan jelas
// daripada error membingungkan saat request pertama masuk
const wajib = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const kosong = wajib.filter((key) => !process.env[key]);
if (kosong.length > 0) {
  console.error('Konfigurasi .env belum lengkap. Variabel berikut wajib diisi:');
  kosong.forEach((key) => console.error(`  - ${key}`));
  console.error('Salin .env.example ke .env lalu isi nilainya.');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server cloud_absen berjalan di port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Zona waktu: ${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone}`);
});
