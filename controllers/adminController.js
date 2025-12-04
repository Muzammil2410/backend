const User = require('../models/User');
const Order = require('../models/Order');
const Gig = require('../models/Gig');
const PaymentDetail = require('../models/PaymentDetail');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    
    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Return user data without password
    const userData = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard-stats
// @access  Admin
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalSellers = await User.countDocuments({ role: 'freelancer' });
    const totalGigs = await Gig.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    res.json({
      success: true,
      data: {
        totalClients,
        totalSellers,
        totalGigs,
        totalOrders
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Get all payment details with seller information
// @route   GET /api/admin/payment-details
// @access  Admin
exports.getAllPaymentDetails = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Get all payment details
    const paymentDetails = await PaymentDetail.find().lean().sort({ updatedAt: -1 });
    
    // Get seller information for each payment detail
    const paymentDetailsWithSellers = await Promise.all(
      paymentDetails.map(async (payment) => {
        let seller = null;
        
        try {
          // Check if userId is a valid ObjectId before querying
          if (payment.userId && mongoose.Types.ObjectId.isValid(payment.userId)) {
            // Only try to find by ObjectId if it's valid
            seller = await User.findById(payment.userId).select('name email phone avatar role').lean();
          }
        } catch (err) {
          // If there's an error finding the user, seller will remain null
          // Log the error but don't throw - we'll show "Unknown Seller" instead
          console.error(`Error finding seller for userId ${payment.userId}:`, err.message);
        }
        
        return {
          ...payment,
          seller: seller || {
            name: 'Unknown Seller',
            email: 'N/A',
            phone: 'N/A',
            avatar: null,
            role: 'N/A'
          }
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        paymentDetails: paymentDetailsWithSellers,
        total: paymentDetailsWithSellers.length
      }
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

// @desc    Get orders pending payment verification
// @route   GET /api/admin/orders/pending-verification
// @access  Admin
exports.getPendingVerificationOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'Payment pending verify' })
      .sort({ paymentUploadedAt: -1, createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: {
        orders,
        total: orders.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending verification orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending verification orders',
      error: error.message
    });
  }
};

// @desc    Get all clients with their information
// @route   GET /api/admin/clients
// @access  Admin
exports.getAllClients = async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' })
      .select('name email phone avatar createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: {
        clients,
        total: clients.length
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
};

// @desc    Get order history with completion and confirmation details
// @route   GET /api/admin/orders/history
// @access  Admin
exports.getOrderHistory = async (req, res) => {
  try {
    // Get orders that have been completed by seller or confirmed by client
    const orders = await Order.find({
      $or: [
        { status: 'Completed' },
        { completedAt: { $ne: null } },
        { clientConfirmedCompletionAt: { $ne: null } }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
    
    // Format orders with completion and confirmation details
    const orderHistory = orders.map(order => ({
      ...order,
      sellerCompleted: !!order.completedAt,
      sellerCompletedAt: order.completedAt,
      clientConfirmed: !!order.clientConfirmedCompletionAt,
      clientConfirmedAt: order.clientConfirmedCompletionAt,
    }));
    
    res.json({
      success: true,
      data: {
        orders: orderHistory,
        total: orderHistory.length
      }
    });
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history',
      error: error.message
    });
  }
};

// @desc    Verify payment for an order
// @route   POST /api/admin/orders/:orderId/verify-payment
// @access  Admin
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { verified } = req.body; // true to verify, false to reject

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'Payment pending verify') {
      return res.status(400).json({
        success: false,
        message: 'Order is not pending verification'
      });
    }

    if (verified === true) {
      // Verify payment - change status to Payment confirmed
      order.status = 'Payment confirmed';
      order.paymentVerifiedAt = new Date();
      await order.save();

      res.json({
        success: true,
        message: 'Payment verified successfully. Order is now visible to seller.',
        data: order
      });
    } else {
      // Reject payment - keep as pending or set to cancelled
      // For now, we'll keep it as pending so admin can review again
      res.json({
        success: true,
        message: 'Payment verification rejected. Order remains pending.',
        data: order
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

// @desc    Get all withdrawal requests
// @route   GET /api/admin/withdrawals
// @access  Admin
exports.getWithdrawalRequests = async (req, res) => {
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');

    // Get all orders with pending withdrawal requests
    const orders = await Order.find({
      withdrawalRequested: true,
      withdrawalStatus: 'pending'
    })
      .sort({ withdrawalRequestedAt: -1 })
      .lean();

    // Populate seller information and payment details
    const PaymentDetail = require('../models/PaymentDetail');
    const ordersWithSellerInfo = await Promise.all(
      orders.map(async (order) => {
        try {
          const seller = await User.findById(order.sellerId).select('name email phone').lean();
          
          // Fetch seller's payment details
          let paymentDetails = null;
          try {
            paymentDetails = await PaymentDetail.findOne({ userId: order.sellerId }).lean();
          } catch (paymentError) {
            console.error('Error fetching payment details for seller:', order.sellerId, paymentError);
          }
          
          return {
            ...order,
            seller: seller || { name: 'Unknown Seller', email: 'N/A', phone: 'N/A' },
            paymentDetails: paymentDetails || null
          };
        } catch (error) {
          return {
            ...order,
            seller: { name: 'Unknown Seller', email: 'N/A', phone: 'N/A' },
            paymentDetails: null
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        withdrawalRequests: ordersWithSellerInfo
      }
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal requests',
      error: error.message
    });
  }
};

// @desc    Process withdrawal request (approve or reject)
// @route   POST /api/admin/withdrawals/:orderId/process
// @access  Admin
exports.processWithdrawal = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const Order = require('../models/Order');
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.withdrawalRequested) {
      return res.status(400).json({
        success: false,
        message: 'This order does not have a withdrawal request'
      });
    }

    if (order.withdrawalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This withdrawal request has already been processed'
      });
    }

    if (action === 'approve') {
      order.withdrawalStatus = 'approved';
      order.withdrawalProcessedAt = new Date();
      await order.save();

      res.json({
        success: true,
        message: 'Withdrawal request approved successfully',
        data: order
      });
    } else if (action === 'reject') {
      order.withdrawalStatus = 'rejected';
      order.withdrawalRequested = false; // Reset so seller can request again
      order.withdrawalProcessedAt = new Date();
      await order.save();

      res.json({
        success: true,
        message: 'Withdrawal request rejected',
        data: order
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal',
      error: error.message
    });
  }
};

