const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();


const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const statsRoutes = require('./routes/statsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const correctionRoutes = require('./routes/correctionRoutes');
const wfaRoutes = require('./routes/wfaRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const photoRoutes = require('./routes/photoRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Di belakang Nginx reverse proxy, IP asli client ada di header X-Forwarded-For.
// Tanpa ini, rate limiter menghitung semua user sebagai satu IP (IP milik Nginx).
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Header keamanan standar (X-Content-Type-Options, HSTS, dll.)
// crossOriginResourcePolicy dilonggarkan supaya foto absensi bisa ditampilkan
// dari domain frontend yang berbeda (mis. app.domain.com vs api.domain.com).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS harus didaftarkan SEBELUM rate limiter. Kalau urutannya terbalik,
// balasan 429 dari limiter tidak membawa header CORS, sehingga browser
// melaporkannya sebagai "blocked by CORS policy" dan pesan asli
// ("Terlalu banyak permintaan") tidak pernah sampai ke pengguna.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Keamanan dasar: batasi jumlah request untuk mencegah spam.
// Batas dihitung per IP, dan di kantor SEMUA pegawai berbagi satu IP publik --
// jadi angkanya harus cukup longgar untuk absensi massal di jam masuk,
// ditambah dashboard admin yang menyegarkan data tiap 30 detik.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 2000,
  message: { message: 'Terlalu banyak permintaan, coba lagi nanti.' },
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CATATAN: folder uploads TIDAK lagi dilayani sebagai berkas statis terbuka.
// Foto wajah adalah data pribadi -- sekarang disajikan lewat /api/photos yang
// memeriksa token dan kepemilikan. Lihat controllers/photoController.js

// Health check -- untuk memastikan server hidup (dipakai monitoring/Hostinger)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes utama
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/corrections', correctionRoutes);
app.use('/api/wfa', wfaRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/photos', photoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Error handler harus di paling akhir
app.use(errorHandler);

module.exports = app;
