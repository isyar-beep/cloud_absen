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

// Semua endpoint di sini hanya bisa diakses admin
router.use(authenticate, authorize('admin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/reset-password', resetPassword);
router.delete('/:id', deactivateUser);

module.exports = router;
