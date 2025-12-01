const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// Apply body parser with increased limit for order routes (payment screenshots)
router.use(express.json({ limit: '100mb', parameterLimit: 50000 }));
router.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 50000 }));

// Create order (requires authentication)
router.post('/', authMiddleware, orderController.createOrder);

// Get all orders (requires authentication)
router.get('/', authMiddleware, orderController.getAllOrders);

// Get seller's orders (requires authentication)
router.get('/seller', authMiddleware, orderController.getSellerOrders);

// Get single order by ID (requires authentication)
router.get('/:id', authMiddleware, orderController.getOrderById);

// Update order (requires authentication)
router.put('/:id', authMiddleware, orderController.updateOrder);

module.exports = router;

