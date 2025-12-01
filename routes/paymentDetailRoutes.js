const express = require('express');
const router = express.Router();
const paymentDetailController = require('../controllers/paymentDetailController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// Get payment details by user ID (optional auth - for clients to see seller's payment details)
router.get('/user/:userId', optionalAuth, paymentDetailController.getPaymentDetailsByUserId);

// Save payment details (requires authentication)
router.post('/', authMiddleware, paymentDetailController.savePaymentDetails);

// Update payment details (requires authentication)
router.put('/', authMiddleware, paymentDetailController.savePaymentDetails);

module.exports = router;

