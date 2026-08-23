const express = require('express');
const router = express.Router();
const { getSemuaWfa, getWfaSaya, buatWfa, hapusWfa } = require('../controllers/wfaController');
const { authenticate, authorize } = require('../middleware/auth');

// Endpoint pegawai -- hanya melihat penetapan miliknya sendiri
router.get('/me', authenticate, getWfaSaya);

// Endpoint khusus admin. WFA ditetapkan admin, tidak diajukan pegawai.
router.get('/', authenticate, authorize('admin'), getSemuaWfa);
router.post('/', authenticate, authorize('admin'), buatWfa);
router.delete('/:id', authenticate, authorize('admin'), hapusWfa);

module.exports = router;
