const express = require('express');
const router = express.Router();
const {
  sendLowAttendanceWarning,
  sendCheckinReminder,
  getBelumCheckin,
} = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// Kirim peringatan attendance rendah -- hanya admin
router.post('/low-attendance', authenticate, authorize('admin'), sendLowAttendanceWarning);

// Daftar pegawai yang belum absen masuk hari ini -- hanya admin
router.get('/pending-checkin', authenticate, authorize('admin', 'konsultan'), getBelumCheckin);

// Kirim push reminder ke pegawai yang belum check-in hari ini -- hanya admin.
// Tanpa body: ke semua yang belum absen (bentuk yang dipakai cron harian).
// Dengan { user_ids: [...] }: hanya ke pegawai tertentu.
router.post('/checkin-reminder', authenticate, authorize('admin'), sendCheckinReminder);

module.exports = router;
