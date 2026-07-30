const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, getProfile, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Rate limit khusus login, lebih ketat dari limiter global,
// untuk memperlambat percobaan tebak password (brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getProfile);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
