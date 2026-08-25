const express = require('express');
const router = express.Router();
const { createLeave, getMyLeaves, getAllLeaves, reviewLeave } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');
const uploadDocument = require('../middleware/uploadDocument');

// Endpoint pegawai
// Lampiran opsional (PDF/JPG/PNG maks. 5MB) dikirim sebagai multipart
router.post('/', authenticate, uploadDocument.single('document'), createLeave);
router.get('/me', authenticate, getMyLeaves);

// Endpoint khusus admin
router.get('/', authenticate, authorize('admin'), getAllLeaves);
router.put('/:id/review', authenticate, authorize('admin'), reviewLeave);

module.exports = router;
