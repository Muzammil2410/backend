const mongoose = require('mongoose');

const paymentDetailSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['jazzcash', 'easypaisa', 'bank']
  },
  accountNumber: {
    type: String,
    required: true
  },
  accountHolderName: {
    type: String,
    required: true
  },
  branchCode: {
    type: String,
    default: ''
  },
  ibanNumber: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for quick lookup
paymentDetailSchema.index({ userId: 1 });

module.exports = mongoose.model('PaymentDetail', paymentDetailSchema);

