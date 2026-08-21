const express = require('express');
const router = express.Router();
const { sendLowAttendanceWarning, sendCheckinReminder } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// Kirim peringatan attendance rendah -- hanya admin
router.post('/low-attendance', authenticate, authorize('admin'), sendLowAttendanceWarning);

// Kirim push reminder ke pegawai yang belum check-in hari ini -- hanya admin
router.post('/checkin-reminder', authenticate, authorize('admin'), sendCheckinReminder);

module.exports = router;
