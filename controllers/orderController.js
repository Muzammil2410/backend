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

    // Get gig details (you might want to fetch from Gig model)
    // For now, we'll use the data from request body or fetch it
    // In production, you should fetch gig details from database
    
    const orderData = {
      gigId,
      gigTitle: req.body.gigTitle || 'Gig Order',
      buyerId,
      buyerName: req.body.buyerName || user?.name || 'Buyer',
      sellerId: req.body.sellerId || '',
      sellerName: req.body.sellerName || 'Seller',
      package: packageName || 'standard',
      amount: parseFloat(amount),
      requirements: requirements || '',
      deliveryTime: deliveryTime ? parseInt(deliveryTime) : 0,
      status: paymentScreenshot ? 'Payment pending verify' : 'Pending payment',
      paymentScreenshot: paymentScreenshot || null,
      paymentUploadedAt: paymentScreenshot ? new Date() : null
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

// Get seller's orders
exports.getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.userId;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    const orders = await Order.find({ sellerId })
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

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
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

