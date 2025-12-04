const express = require('express');
const router = express.Router();
const {
  adminLogin,
  getDashboardStats,
  getAllPaymentDetails,
  getAllClients,
  getPendingVerificationOrders,
  getOrderHistory,
  verifyPayment
} = require('../controllers/adminController');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

// Admin login (public route)
router.post('/login', adminLogin);

// Protected admin routes
router.get('/dashboard-stats', adminAuthMiddleware, getDashboardStats);
router.get('/payment-details', adminAuthMiddleware, getAllPaymentDetails);
router.get('/clients', adminAuthMiddleware, getAllClients);
router.get('/orders/pending-verification', adminAuthMiddleware, getPendingVerificationOrders);
router.get('/orders/history', adminAuthMiddleware, getOrderHistory);
router.post('/orders/:orderId/verify-payment', adminAuthMiddleware, verifyPayment);

module.exports = router;

