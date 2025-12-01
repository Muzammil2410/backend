const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Authorization required.'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authorization required.'
    });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID to request
    req.userId = decoded.userId;
    req.token = token;
    
    // Fetch and attach user info
    try {
      const user = await User.findById(decoded.userId);
      req.user = user;
    } catch (userError) {
      // If user fetch fails, continue without user object
      console.error('Error fetching user:', userError);
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Authorization required.'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Server error during token verification.'
      });
    }
  }
};

// Optional middleware - doesn't require auth but adds user info if available
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (token) {
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.token = token;
      } catch (error) {
        // Silently fail for optional auth - just don't set userId
        // Token might be expired or invalid, but that's okay for optional auth
      }
    }
  }
  
  next();
};

module.exports = {
  authMiddleware,
  optionalAuth
};

