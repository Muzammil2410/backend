const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());

// Increase body size limit for JSON and URL-encoded data
app.use(express.json({ limit: '100mb', parameterLimit: 50000 }));
app.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 50000 }));

// Add middleware to log request size (for debugging)
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentLength = req.get('content-length');
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      console.log(`📦 Request size: ${sizeInMB.toFixed(2)} MB`);
    }
  }
  next();
});

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('Error: MONGO_URI is not defined in .env file');
  process.exit(1);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Server is running!',
    status: 'connected',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/gigs', require('./routes/gigRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment-details', require('./routes/paymentDetailRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io connection handling
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Order = require('./models/Order');
const User = require('./models/User');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.userId;
    
    // Fetch user details
    const user = await User.findById(decoded.userId);
    socket.user = user ? { name: user.name, avatar: user.avatar } : { name: 'User' };
    
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.userId}`);

  // Join order room
  socket.on('join_order', async (orderId) => {
    try {
      // Verify user has access to this order
      const order = await Order.findById(orderId);
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      if (order.buyerId !== socket.userId && order.sellerId !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized access to this order' });
        return;
      }

      socket.join(`order_${orderId}`);
      console.log(`User ${socket.userId} joined order ${orderId}`);
    } catch (error) {
      console.error('Error joining order room:', error);
      socket.emit('error', { message: 'Failed to join order room' });
    }
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const { orderId, text, attachments } = data;

      if (!orderId || !text) {
        socket.emit('error', { message: 'Order ID and message text are required' });
        return;
      }

      // Verify order access
      const order = await Order.findById(orderId);
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      if (order.buyerId !== socket.userId && order.sellerId !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Determine sender type
      const senderType = order.buyerId === socket.userId ? 'buyer' : 'seller';

      // Create message
      const message = new Message({
        orderId,
        senderId: socket.userId,
        senderName: socket.user.name || 'User',
        senderType,
        senderAvatar: socket.user.avatar || null,
        text: text.trim(),
        attachments: attachments || []
      });

      await message.save();

      // Emit to all users in the order room
      io.to(`order_${orderId}`).emit('new_message', message);

      console.log(`Message sent in order ${orderId} by ${socket.userId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
  });
});

// Server port
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Socket.io server is ready`);
});

