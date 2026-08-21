const express = require('express');
const router = express.Router();
const { getAllHolidays, createHoliday, deleteHoliday } = require('../controllers/holidayController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllHolidays);
router.post('/', authenticate, authorize('admin'), createHoliday);
router.delete('/:id', authenticate, authorize('admin'), deleteHoliday);

module.exports = router;
