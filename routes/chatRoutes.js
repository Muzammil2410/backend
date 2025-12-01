const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');

// All chat routes require authentication
router.use(authMiddleware);

// Get messages for an order
router.get('/orders/:orderId/messages', chatController.getMessages);

// Create a new message
router.post('/messages', chatController.createMessage);

module.exports = router;

