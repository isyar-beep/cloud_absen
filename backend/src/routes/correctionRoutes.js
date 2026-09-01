const express = require('express');
const router = express.Router();
const {
  ajukanKoreksi,
  getKoreksiSaya,
  getSemuaKoreksi,
  reviewKoreksi,
} = require('../controllers/correctionController');
const { authenticate, authorize } = require('../middleware/auth');

// Endpoint pegawai
router.post('/', authenticate, ajukanKoreksi);
router.get('/me', authenticate, getKoreksiSaya);

// Endpoint khusus admin
router.get('/', authenticate, authorize('admin', 'konsultan'), getSemuaKoreksi);
router.put('/:id/review', authenticate, authorize('admin', 'konsultan'), reviewKoreksi);

module.exports = router;
