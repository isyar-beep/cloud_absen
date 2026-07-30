const express = require('express');
const router = express.Router();
const { sendLowAttendanceWarning } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// Kirim peringatan attendance rendah -- hanya admin
router.post('/low-attendance', authenticate, authorize('admin'), sendLowAttendanceWarning);

module.exports = router;
