const Gig = require('../models/Gig');
const Order = require('../models/Order');

// Create a new gig
exports.createGig = async (req, res) => {
  try {
    // Log request size for debugging
    const requestSize = JSON.stringify(req.body).length;
    const requestSizeMB = requestSize / (1024 * 1024);
    console.log(`📥 Received request size: ${requestSizeMB.toFixed(2)} MB`);
    
    const {
      title,
      description,
      price,
      deliveryTime,
      category,
      skills,
      coverImage,
      images,
      packages,
      requirements,
      seller
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !coverImage) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and cover image are required'
      });
    }

    // Validate packages
    if (!packages || packages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one package is required'
      });
    }

    // Get seller ID from token or request body
    let sellerId = req.userId || seller?.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Seller ID is required. Please ensure you are logged in.'
      });
    }

    // Convert string ID to ObjectId if needed (for MongoDB)
    if (typeof sellerId === 'string' && !sellerId.match(/^[0-9a-fA-F]{24}$/)) {
      // If it's not a valid MongoDB ObjectId, we'll use it as is
      // In production, you'd want to look up the user and get their MongoDB _id
    }

    // Create gig
    const gig = new Gig({
      title,
      description,
      price: price || (packages[0]?.price || 0),
      deliveryTime: deliveryTime || (packages[0]?.deliveryTime || 1),
      category,
      skills: skills || [],
      coverImage,
      images: images || [],
      packages: packages || [],
      requirements: requirements || [],
      sellerId,
      seller: seller || {
        id: sellerId,
        name: 'Unknown Seller',
        level: 'Expert'
      },
      active: true
    });

    await gig.save();

    res.status(201).json({
      success: true,
      message: 'Gig created successfully',
      data: gig
    });
  } catch (error) {
    console.error('Error creating gig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create gig',
      error: error.message
    });
  }
};

// Get all gigs with filters
exports.getAllGigs = async (req, res) => {
  try {
    const {
      q, // search query
      category,
      minPrice,
      maxPrice,
      sort = 'createdAt',
      deliveryTime,
      level,
      page = 1,
      limit = 20,
      sellerId // for seller's own gigs
    } = req.query;

    // Build filter object
    const filter = { active: true };

    // Filter by seller if provided
    if (sellerId) {
      filter.sellerId = sellerId;
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Note: Price filtering with packages is handled after fetching
    // We don't add price filter to the DB query here because we need to check
    // the minimum package price, not just the base price

    // Filter by delivery time
    if (deliveryTime) {
      filter.deliveryTime = { $lte: parseInt(deliveryTime) };
    }
    
    // Filter by seller level (experience level)
    if (level) {
      // Map level values to match seller.level field
      const levelMap = {
        'beginner': ['Beginner', 'Level 1'],
        'intermediate': ['Intermediate', 'Level 2'],
        'expert': ['Expert', 'Top Rated']
      };
      
      const levelValues = levelMap[level.toLowerCase()] || [level];
      filter['seller.level'] = { $in: levelValues };
    }

    // Search query
    if (q) {
      filter.$text = { $search: q };
    }

    // Sort options
    let sortOption = {};
    switch (sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { rating: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Execute query - handle price filtering with packages
    let query = Gig.find(filter);
    
    // If price filtering is needed, fetch more results to account for package-based filtering
    const fetchLimit = (minPrice || maxPrice) ? limitNum * 5 : limitNum;
    
    let gigs = await query
      .sort(sortOption)
      .skip(skip)
      .limit(fetchLimit)
      .lean();
    
    // Filter by package prices if minPrice or maxPrice is set
    // This ensures we check the minimum package price (what users see), not just base price
    if (minPrice || maxPrice) {
      const minPriceNum = minPrice ? parseInt(minPrice) : null;
      const maxPriceNum = maxPrice ? parseInt(maxPrice) : null;
      
      gigs = gigs.filter(gig => {
        // Get the minimum price from packages or use base price
        let minGigPrice = gig.price || 0;
        if (gig.packages && gig.packages.length > 0) {
          const packagePrices = gig.packages.map(p => p.price || 0).filter(p => p > 0);
          if (packagePrices.length > 0) {
            minGigPrice = Math.min(...packagePrices);
          }
        }
        
        // Check if price is in range
        if (minPriceNum !== null && minGigPrice < minPriceNum) {
          return false;
        }
        if (maxPriceNum !== null && minGigPrice > maxPriceNum) {
          return false;
        }
        return true;
      });
      
      // Limit to requested page size after filtering
      gigs = gigs.slice(0, limitNum);
    }
    
    // Add order count for each gig
    // Use Promise.all to count orders for all gigs in parallel
    const gigsWithOrderCount = await Promise.all(
      gigs.map(async (gig) => {
        const gigId = gig._id?.toString() || gig.id?.toString();
        let orderCount = 0;
        
        if (gigId) {
          // Count orders for this gig - handle both string and ObjectId
          try {
            orderCount = await Order.countDocuments({
              $or: [
                { gigId: gigId },
                { gigId: gig._id }
              ]
            });
          } catch (error) {
            console.error(`Error counting orders for gig ${gigId}:`, error);
            orderCount = 0;
          }
        }
        
        return {
          ...gig,
          orderCount
        };
      })
    );
    
    gigs = gigsWithOrderCount;
    
    // Get total count
    // Note: For accurate count with package price filtering, we'd need aggregation
    // For now, this is an approximation
    const total = await Gig.countDocuments(filter);

    res.json({
      success: true,
      data: {
        gigs,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          hasMore: skip + gigs.length < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gigs',
      error: error.message
    });
  }
};

// Get single gig by ID
exports.getGigById = async (req, res) => {
  try {
    const { id } = req.params;

    const gig = await Gig.findById(id)
      .lean();

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Add order count
    const gigId = gig._id?.toString() || gig.id?.toString();
    const orderCount = await Order.countDocuments({ gigId });
    
    res.json({
      success: true,
      data: {
        ...gig,
        orderCount
      }
    });
  } catch (error) {
    console.error('Error fetching gig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gig',
      error: error.message
    });
  }
};

// Update gig
exports.updateGig = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const sellerId = req.userId;

    // Find gig
    const gig = await Gig.findById(id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check if user owns the gig (handle both string and ObjectId)
    const gigSellerId = gig.sellerId?.toString() || gig.sellerId;
    if (gigSellerId !== sellerId && gig.seller?.id !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this gig'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        gig[key] = updateData[key];
      }
    });

    gig.updatedAt = Date.now();
    await gig.save();

    res.json({
      success: true,
      message: 'Gig updated successfully',
      data: gig
    });
  } catch (error) {
    console.error('Error updating gig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update gig',
      error: error.message
    });
  }
};

// Delete gig
exports.deleteGig = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.userId;

    const gig = await Gig.findById(id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check if user owns the gig (handle both string and ObjectId)
    const gigSellerId = gig.sellerId?.toString() || gig.sellerId;
    if (gigSellerId !== sellerId && gig.seller?.id !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this gig'
      });
    }

    await Gig.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Gig deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete gig',
      error: error.message
    });
  }
};

// Toggle gig active status
exports.toggleGigStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.userId;

    const gig = await Gig.findById(id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check if user owns the gig (handle both string and ObjectId)
    const gigSellerId = gig.sellerId?.toString() || gig.sellerId;
    if (gigSellerId !== sellerId && gig.seller?.id !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this gig'
      });
    }

    gig.active = !gig.active;
    await gig.save();

    res.json({
      success: true,
      message: `Gig ${gig.active ? 'activated' : 'deactivated'} successfully`,
      data: gig
    });
  } catch (error) {
    console.error('Error toggling gig status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle gig status',
      error: error.message
    });
  }
};

