const Message = require('../models/Message');

// Get all messages for an order
exports.getMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Fetch messages for this order
    const messages = await Message.find({ orderId })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages as read if they're not from the current user
    await Message.updateMany(
      {
        orderId,
        senderId: { $ne: userId },
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      data: {
        messages
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Create a new message
exports.createMessage = async (req, res) => {
  try {
    const { orderId, text, attachments } = req.body;
    const userId = req.userId;

    if (!orderId || !text) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and message text are required'
      });
    }

    // Get order to determine sender type
    const Order = require('../models/Order');
    const User = require('../models/User');
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify user has access to this order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this order'
      });
    }

    // Determine sender type
    const senderType = order.buyerId === userId ? 'buyer' : 'seller';

    // Get user info (use from request if available, otherwise fetch)
    const user = req.user || await User.findById(userId);

    const messageData = {
      orderId,
      senderId: userId,
      senderName: user?.name || (senderType === 'buyer' ? order.buyerName : order.sellerName),
      senderType,
      senderAvatar: user?.avatar || null,
      text: text.trim(),
      attachments: attachments || []
    };

    const message = new Message(messageData);
    await message.save();

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create message',
      error: error.message
    });
  }
};

