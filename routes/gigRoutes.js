const express = require('express');
const router = express.Router();
const gigController = require('../controllers/gigController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// Apply body parser with increased limit specifically for gig routes
router.use(express.json({ limit: '100mb', parameterLimit: 50000 }));
router.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 50000 }));

// Create gig (requires authentication)
router.post('/', authMiddleware, gigController.createGig);

// Get all gigs (optional auth - for filtering seller's own gigs)
router.get('/', optionalAuth, gigController.getAllGigs);

// Get single gig by ID
router.get('/:id', optionalAuth, gigController.getGigById);

// Update gig (requires authentication)
router.put('/:id', authMiddleware, gigController.updateGig);

// Delete gig (requires authentication)
router.delete('/:id', authMiddleware, gigController.deleteGig);

// Toggle gig active status (requires authentication)
router.patch('/:id/toggle', authMiddleware, gigController.toggleGigStatus);

module.exports = router;

