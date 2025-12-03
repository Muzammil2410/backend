const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, otpEnabled } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone is required'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    if (!role || !['client', 'freelancer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "client" or "freelancer"'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email or phone already exists'
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : null,
      phone: phone ? phone.trim() : null,
      password,
      role,
      otpEnabled: otpEnabled || false
    });

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data without password
    const userData = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, phone, password, role } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if role matches (if role is provided)
    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Invalid credentials or you are not registered as a ${role === 'client' ? 'client' : 'seller'}`
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
    const token = generateToken(user._id.toString());

    // Return user data without password
    const userData = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Check username availability
// @route   GET /api/auth/username/:username
// @access  Public
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({
      username: username.trim().toLowerCase()
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'This name already exists. Choose a different name.'
      });
    }

    res.status(200).json({
      success: true,
      available: true,
      message: 'Username is available'
    });
  } catch (error) {
    console.error('Check username availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      username, 
      avatar, 
      otpEnabled,
      // Seller profile fields
      title,
      skills,
      bio,
      portfolio,
      languages,
      experienceLevel
    } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If username is being updated, check if it's available
    if (username !== undefined && username !== user.username) {
      const trimmedUsername = username ? username.trim() : null;
      if (trimmedUsername) {
        const existingUser = await User.findOne({
          username: trimmedUsername.toLowerCase(),
          _id: { $ne: req.userId } // Exclude current user
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'This name already exists. Choose a different name.'
          });
        }
      }
    }

    // Update basic fields
    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email ? email.toLowerCase().trim() : null;
    if (phone !== undefined) user.phone = phone ? phone.trim() : null;
    if (username !== undefined) user.username = username ? username.trim().toLowerCase() : null;
    if (avatar !== undefined) user.avatar = avatar;
    if (otpEnabled !== undefined) user.otpEnabled = otpEnabled;
    
    // Update seller profile fields (only for freelancers)
    if (user.role === 'freelancer') {
      if (title !== undefined) user.title = title ? title.trim() : null;
      if (skills !== undefined) {
        user.skills = Array.isArray(skills) 
          ? skills.filter(s => s && s.trim()).map(s => s.trim())
          : [];
      }
      if (bio !== undefined) user.bio = bio ? bio.trim() : null;
      if (portfolio !== undefined) {
        user.portfolio = {
          images: Array.isArray(portfolio.images) ? portfolio.images : [],
          links: Array.isArray(portfolio.links) 
            ? portfolio.links.filter(l => l && l.trim()).map(l => l.trim())
            : []
        };
      }
      if (languages !== undefined) {
        user.languages = Array.isArray(languages)
          ? languages.filter(l => l && l.trim()).map(l => l.trim())
          : [];
      }
      if (experienceLevel !== undefined) {
        user.experienceLevel = experienceLevel || null;
      }
    }
    
    user.updatedAt = new Date();

    await user.save();

    const userData = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userData
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle duplicate username error from MongoDB
    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({
        success: false,
        message: 'This name already exists. Choose a different name.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during profile update',
      error: error.message
    });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is same as current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password
    user.password = newPassword;
    user.updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change',
      error: error.message
    });
  }
};

