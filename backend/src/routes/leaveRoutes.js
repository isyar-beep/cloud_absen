const express = require('express');
const router = express.Router();
const { createLeave, getMyLeaves, getAllLeaves, reviewLeave } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');

// Endpoint pegawai
router.post('/', authenticate, createLeave);
router.get('/me', authenticate, getMyLeaves);

// Endpoint khusus admin
router.get('/', authenticate, authorize('admin'), getAllLeaves);
router.put('/:id/review', authenticate, authorize('admin'), reviewLeave);

module.exports = router;
