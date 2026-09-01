const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetPassword,
  deactivateUser,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Membaca daftar pegawai: admin dan konsultan. Konsultan hanya menerima
// pegawai di proyeknya -- lingkupnya dipersempit di dalam controller.
router.get('/', authorize('admin', 'konsultan'), getAllUsers);
router.get('/:id', authorize('admin', 'konsultan'), getUserById);

// Membuat, mengubah, dan menonaktifkan akun: admin saja.
//
// Dalam kontrak konsultansi, daftar personel adalah bagian dari kontrak --
// yang dijanjikan dalam penawaran itulah yang harus hadir di lapangan.
// Kalau konsultan boleh menambah nama sendiri, daftar personel berhenti
// mencerminkan kontrak dan verifikasi dinas kehilangan artinya.
router.post('/', authorize('admin'), createUser);
router.put('/:id', authorize('admin'), updateUser);
router.put('/:id/reset-password', authorize('admin'), resetPassword);
router.delete('/:id', authorize('admin'), deactivateUser);

module.exports = router;
