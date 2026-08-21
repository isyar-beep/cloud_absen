const express = require('express');
const router = express.Router();
const { getAllShifts, createShift, updateShift, deleteShift } = require('../controllers/shiftController');
const { authenticate, authorize } = require('../middleware/auth');

// Semua pengguna login boleh lihat daftar shift (dipakai utk tampilkan info shift sendiri).
// Kelola (buat/ubah/hapus) hanya admin.
router.get('/', authenticate, getAllShifts);
router.post('/', authenticate, authorize('admin'), createShift);
router.put('/:id', authenticate, authorize('admin'), updateShift);
router.delete('/:id', authenticate, authorize('admin'), deleteShift);

module.exports = router;
