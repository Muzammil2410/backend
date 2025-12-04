const Order = require('../models/Order');

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const {
      gigId,
      package: packageName,
      amount,
      paymentScreenshot,
      requirements,
      deliveryTime
    } = req.body;

    const buyerId = req.userId;
    const user = req.user; // If available from auth middleware

    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: 'Buyer ID is required'
      });
    }

    if (!gigId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Gig ID and amount are required'
      });
    }

    // Validate sellerId is provided
    const sellerId = req.body.sellerId;
    if (!sellerId || sellerId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Seller ID is required. Please ensure the gig has a valid seller.'
      });
    }

    // Get gig details (you might want to fetch from Gig model)
    // For now, we'll use the data from request body or fetch it
    // In production, you should fetch gig details from database
    
    const orderData = {
      gigId,
      gigTitle: req.body.gigTitle || 'Gig Order',
      buyerId,
      buyerName: req.body.buyerName || user?.name || 'Buyer',
      sellerId: sellerId.toString().trim(),
      sellerName: req.body.sellerName || 'Seller',
      package: packageName || 'standard',
      amount: parseFloat(amount),
      requirements: requirements || '',
      deliveryTime: deliveryTime ? parseInt(deliveryTime) : 0,
      status: paymentScreenshot ? 'Payment pending verify' : 'Pending payment',
      paymentScreenshot: paymentScreenshot || null,
      paymentUploadedAt: paymentScreenshot ? new Date() : null,
      paymentVerifiedAt: null // Will be set when admin verifies
    };

    const order = new Order(orderData);
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors || {}).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Get all orders (filtered by user role)
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { role } = req.query; // 'buyer' or 'seller'

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const filter = {};
    if (role === 'buyer') {
      filter.buyerId = userId;
    } else if (role === 'seller') {
      filter.sellerId = userId;
    } else {
      // Get orders for both buyer and seller
      filter.$or = [
        { buyerId: userId },
        { sellerId: userId }
      ];
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get seller's orders (only show orders after admin verification)
exports.getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.userId;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    // Only show orders that have been verified by admin (status is not "Payment pending verify")
    const orders = await Order.find({ 
      sellerId,
      status: { $ne: 'Payment pending verify' } // Exclude orders pending admin verification
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch seller orders',
      error: error.message
    });
  }
};

// Get single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const order = await Order.findById(id).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user has access to this order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.userId;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this order'
      });
    }

    // Handle client confirmation of completion
    if (updateData.confirmCompletion === true && order.buyerId === userId) {
      // Only allow client to confirm if order is already completed by seller
      if (order.status !== 'Completed') {
        return res.status(400).json({
          success: false,
          message: 'Order must be completed by seller before client can confirm'
        });
      }
      // Set client confirmation timestamp
      order.clientConfirmedCompletionAt = new Date();
      updateData.clientConfirmedCompletionAt = order.clientConfirmedCompletionAt;
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'confirmCompletion') {
        order[key] = updateData[key];
      }
    });

    order.updatedAt = Date.now();
    await order.save();

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};

// Request withdrawal for an order
exports.requestWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.userId;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization - only seller can request withdrawal
    if (order.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to request withdrawal for this order'
      });
    }

    // Check if order is completed
    if (order.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed orders can have withdrawal requests'
      });
    }

    // Check if withdrawal already requested
    if (order.withdrawalRequested) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal already requested for this order'
      });
    }

    // Request withdrawal
    order.withdrawalRequested = true;
    order.withdrawalRequestedAt = new Date();
    order.withdrawalStatus = 'pending';
    order.updatedAt = Date.now();
    await order.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: order
    });
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request withdrawal',
      error: error.message
    });
  }
};

// Get orders eligible for withdrawal (completed orders without withdrawal request)
exports.getWithdrawalEligibleOrders = async (req, res) => {
  try {
    const sellerId = req.userId;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    // Get completed orders that haven't requested withdrawal yet
    const orders = await Order.find({
      sellerId,
      status: 'Completed',
      withdrawalRequested: { $ne: true }
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    console.error('Error fetching withdrawal eligible orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

