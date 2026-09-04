const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  login, getProfile, changePassword, registerPushToken, uploadAvatar, deleteAvatar,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Pembatasan per ALAMAT IP: menahan satu mesin yang menembak membabi buta
// ke banyak akun sekaligus.
//
// skipSuccessfulRequests: hanya login GAGAL yang dihitung. Tanpa ini, satu
// kantor yang berbagi satu IP publik akan saling mengunci di jam masuk --
// 10 pegawai login normal sudah cukup memblokir sisanya.
//
// Ambangnya sengaja longgar justru karena alasan itu, dan itulah yang
// membuatnya tidak cukup sendirian: satu akun yang ditebak pelan-pelan
// dari banyak IP tidak akan pernah menyalakannya. Yang menahan hal itu
// adalah gembok per akun di utils/gemboklogin.js. Keduanya menjaga
// serangan yang berbeda, jadi keduanya dipasang.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' },
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getProfile);
router.post('/change-password', authenticate, changePassword);
router.put('/push-token', authenticate, registerPushToken);
router.put('/avatar', authenticate, upload.single('photo'), uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);

module.exports = router;
