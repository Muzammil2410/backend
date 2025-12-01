const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  gigId: {
    type: String, // Can be MongoDB ObjectId or string ID
    required: true
  },
  gigTitle: {
    type: String,
    required: true
  },
  buyerId: {
    type: String,
    required: true
  },
  buyerName: {
    type: String,
    required: true
  },
  sellerId: {
    type: String,
    required: true
  },
  sellerName: {
    type: String,
    required: true
  },
  package: {
    type: String,
    default: 'standard'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  requirements: {
    type: String,
    default: ''
  },
  deliveryTime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: [
      'Pending payment',
      'Payment pending verify',
      'Payment confirmed',
      'Active',
      'In progress',
      'Delivered',
      'Completed',
      'Dispute',
      'Cancelled'
    ],
    default: 'Pending payment'
  },
  paymentScreenshot: {
    type: String, // Base64 image
    default: null
  },
  paymentUploadedAt: {
    type: Date,
    default: null
  },
  paymentVerifiedAt: {
    type: Date,
    default: null
  },
  workStartedAt: {
    type: Date,
    default: null
  },
  deliverySubmittedAt: {
    type: Date,
    default: null
  },
  clientAcceptedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
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
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
orderSchema.index({ buyerId: 1 });
orderSchema.index({ sellerId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);

