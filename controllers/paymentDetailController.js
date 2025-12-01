const PaymentDetail = require('../models/PaymentDetail');

// Get payment details by user ID
exports.getPaymentDetailsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const paymentDetails = await PaymentDetail.findOne({ userId }).lean();

    if (!paymentDetails) {
      return res.status(404).json({
        success: false,
        message: 'Payment details not found'
      });
    }

    res.json({
      success: true,
      data: paymentDetails
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

// Create or update payment details
exports.savePaymentDetails = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      paymentMethod,
      accountNumber,
      accountHolderName,
      branchCode,
      ibanNumber
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!paymentMethod || !accountNumber || !accountHolderName) {
      return res.status(400).json({
        success: false,
        message: 'Payment method, account number, and account holder name are required'
      });
    }

    const paymentDetails = await PaymentDetail.findOneAndUpdate(
      { userId },
      {
        paymentMethod,
        accountNumber,
        accountHolderName,
        branchCode: branchCode || '',
        ibanNumber: ibanNumber || '',
        updatedAt: Date.now()
      },
      {
        new: true,
        upsert: true
      }
    );

    res.json({
      success: true,
      message: 'Payment details saved successfully',
      data: paymentDetails
    });
  } catch (error) {
    console.error('Error saving payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save payment details',
      error: error.message
    });
  }
};

