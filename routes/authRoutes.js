const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  checkUsernameAvailability,
  changePassword
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/username/:username', checkUsernameAvailability);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, changePassword);

module.exports = router;

