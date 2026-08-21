const express = require('express');
const router = express.Router();
const {
  getMyStats,
  getMyTrend,
  getOverview,
  getDepartmentStats,
  getRanking,
  getBreakdown,
  getMonthlySeries,
} = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

// Statistik personal (bisa diakses semua pengguna login)
router.get('/me', authenticate, getMyStats);
router.get('/me/trend', authenticate, getMyTrend);

// Statistik perusahaan (khusus admin)
router.get('/overview', authenticate, authorize('admin'), getOverview);
router.get('/department', authenticate, authorize('admin'), getDepartmentStats);
router.get('/ranking', authenticate, authorize('admin'), getRanking);
router.get('/breakdown', authenticate, authorize('admin'), getBreakdown);
router.get('/monthly-series', authenticate, authorize('admin'), getMonthlySeries);

module.exports = router;
