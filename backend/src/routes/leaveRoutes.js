const express = require('express');
const router = express.Router();
const { createLeave, getMyLeaves, getAllLeaves, reviewLeave } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');
const uploadDocument = require('../middleware/uploadDocument');
const periksaBerkas = require('../middleware/periksaBerkas');

// Endpoint pegawai
// Lampiran opsional (PDF/JPG/PNG maks. 5MB) dikirim sebagai multipart
router.post('/', authenticate, uploadDocument.single('document'), periksaBerkas, createLeave);
router.get('/me', authenticate, getMyLeaves);

// Endpoint khusus admin
router.get('/', authenticate, authorize('admin', 'konsultan'), getAllLeaves);
router.put('/:id/review', authenticate, authorize('admin', 'konsultan'), reviewLeave);

module.exports = router;
