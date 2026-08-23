const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyHistory,
  getMyHistorySummary,
  getTodayAll,
  getUserHistory,
  getAllHistory,
  updateStatus,
  markAlpha,
} = require('../controllers/attendanceController');
const { adminEditAbsensi, getRiwayatEdit } = require('../controllers/correctionController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Endpoint untuk pengguna biasa (staff)
router.post('/check-in', authenticate, upload.single('photo'), checkIn);
router.post('/check-out', authenticate, upload.single('photo'), checkOut);
router.get('/today', authenticate, getTodayStatus);
router.get('/history', authenticate, getMyHistory);
router.get('/history/summary', authenticate, getMyHistorySummary);

// Endpoint khusus admin
router.get('/today-all', authenticate, authorize('admin'), getTodayAll);
router.get('/all', authenticate, authorize('admin'), getAllHistory);
router.get('/user/:userId', authenticate, authorize('admin'), getUserHistory);
router.put('/:id/status', authenticate, authorize('admin'), updateStatus);
router.put('/:id/edit', authenticate, authorize('admin'), adminEditAbsensi);
router.get('/:id/edits', authenticate, authorize('admin'), getRiwayatEdit);
router.post('/mark-alpha', authenticate, authorize('admin'), markAlpha);

module.exports = router;
