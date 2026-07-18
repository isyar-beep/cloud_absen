const express = require('express');
const router = express.Router();
const { exportExcel, exportPdf } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// Export laporan hanya untuk admin
router.get('/attendance/excel', authenticate, authorize('admin'), exportExcel);
router.get('/attendance/pdf', authenticate, authorize('admin'), exportPdf);

module.exports = router;
