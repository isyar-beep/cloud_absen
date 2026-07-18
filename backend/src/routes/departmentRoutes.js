const express = require('express');
const router = express.Router();
const { getDepartments } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// Daftar departemen -- dipakai dropdown filter/form, cukup login (semua role)
router.get('/', authenticate, getDepartments);

module.exports = router;
