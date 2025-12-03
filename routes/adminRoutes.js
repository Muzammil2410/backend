const express = require('express');
const router = express.Router();
const {
  adminLogin,
  getDashboardStats
} = require('../controllers/adminController');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

// Admin login (public route)
router.post('/login', adminLogin);

// Protected admin routes
router.get('/dashboard-stats', adminAuthMiddleware, getDashboardStats);

module.exports = router;

