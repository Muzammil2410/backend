const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['Basic', 'Standard', 'Premium']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  deliveryTime: {
    type: Number,
    required: true,
    min: 1
  },
  revisions: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const gigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  deliveryTime: {
    type: Number,
    required: true,
    min: 1
  },
  category: {
    type: String,
    required: true,
    enum: [
      'social-media-management',
      'video-editing',
      'logo-designing',
      'seo-expert',
      'website-development',
      'web-designer',
      'wordpress-developer'
    ]
  },
  skills: [{
    type: String,
    trim: true
  }],
  coverImage: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  packages: [packageSchema],
  requirements: [{
    type: String,
    trim: true
  }],
  sellerId: {
    type: String, // Using String to support both MongoDB ObjectId and custom IDs
    required: true
  },
  seller: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    avatar: String,
    level: {
      type: String,
      default: 'Expert'
    },
    title: String
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt before saving
gigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for search and filtering - optimized for performance
gigSchema.index({ title: 'text', description: 'text', skills: 'text' });
gigSchema.index({ category: 1, active: 1 });
gigSchema.index({ sellerId: 1, active: 1 }); // Compound index for seller queries
gigSchema.index({ active: 1, createdAt: -1 }); // For default sorting
gigSchema.index({ active: 1, price: 1 }); // For price sorting
gigSchema.index({ active: 1, rating: -1 }); // For rating sorting

module.exports = mongoose.model('Gig', gigSchema);

