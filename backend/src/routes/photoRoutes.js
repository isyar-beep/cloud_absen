const express = require('express');
const router = express.Router();
const { terbitkanTokenFoto, sajikanFoto } = require('../controllers/photoController');
const { authenticate } = require('../middleware/auth');

// Menerbitkan token butuh sesi login yang sah
router.get('/token', authenticate, terbitkanTokenFoto);

// Penyajian berkas memakai token di query string, karena tag <img>
// tidak bisa mengirim header Authorization
router.get('/*', sajikanFoto);

module.exports = router;
