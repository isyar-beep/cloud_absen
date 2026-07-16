const express = require('express');
const router = express.Router();
const {
  getMyStats,
  getMyTrend,
  getOverview,
  getDepartmentStats,
  getRanking,
} = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

// Statistik personal (bisa diakses semua pengguna login)
router.get('/me', authenticate, getMyStats);
router.get('/me/trend', authenticate, getMyTrend);

// Statistik perusahaan (khusus admin)
router.get('/overview', authenticate, authorize('admin'), getOverview);
router.get('/department', authenticate, authorize('admin'), getDepartmentStats);
router.get('/ranking', authenticate, authorize('admin'), getRanking);

module.exports = router;
