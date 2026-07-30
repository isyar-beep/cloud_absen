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
const departmentRoutes = require('./routes/departmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Di belakang Nginx reverse proxy, IP asli client ada di header X-Forwarded-For.
// Tanpa ini, rate limiter menghitung semua user sebagai satu IP (IP milik Nginx).
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Header keamanan standar (X-Content-Type-Options, HSTS, dll.)
app.use(helmet());

// Keamanan dasar: batasi jumlah request untuk mencegah brute-force / spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  message: { message: 'Terlalu banyak permintaan, coba lagi nanti.' },
});
app.use(limiter);

// CORS: hanya domain frontend yang terdaftar yang boleh akses API
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Error handler harus di paling akhir
app.use(errorHandler);

module.exports = app;
