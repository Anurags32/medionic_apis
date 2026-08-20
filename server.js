const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('==========================================================');
console.log('🚀  Medionic Backend Server Starting...');
console.log('==========================================================');
console.log(`📌  NODE_ENV     : ${process.env.NODE_ENV || 'development'}`);
console.log(`📌  PORT         : ${process.env.PORT || 5001}`);
console.log(`📌  MONGODB_URI  : ${process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db'}`);
console.log(`📌  CLIENT_URL   : ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
console.log('==========================================================');

// Import routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const mrRoutes = require('./routes/mrRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const labRoutes = require('./routes/labRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const appDataRoutes = require('./routes/appDataRoutes');

const doctorAuthRoutes = require('./routes/auth/doctor/doctorRoutes');
const patientAuthRoutes = require('./routes/auth/patient/patientRoutes');
const mrAuthRoutes = require('./routes/auth/mr/mrRoutes');

// Initialize Firebase Admin SDK
const { initializeFirebase } = require('./config/firebase');
initializeFirebase();

// Import Socket.io service
const { initSocket } = require('./services/socketService');

console.log('✅  All routes imported successfully');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());
console.log('✅  Helmet security middleware applied');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
console.log('✅  Rate limiter applied on /api/');

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
console.log('✅  Body parser middleware applied');

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://medonic-admin-kmfw.vercel.app',
    'https://medonic-admin-yer9.vercel.app'
  ],
  credentials: true
}));
console.log(`✅  CORS enabled for origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log('✅  Morgan HTTP request logger enabled (dev mode)');
}

// Database connection
if (process.env.NODE_ENV !== 'test') {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db';
  console.log(`\n🔌  Connecting to MongoDB at: ${mongoURI}`);

  mongoose.connection.on('connecting', () => {
    console.log('⏳  MongoDB: connecting...');
  });

  mongoose.connection.on('connected', () => {
    console.log('✅  MongoDB: connected successfully!');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️   MongoDB: disconnected!');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌  MongoDB connection error:', err.message);
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄  MongoDB: reconnected!');
  });

  mongoose
    .connect(mongoURI)
    .then(() => {
      console.log('✅  MongoDB initial connection promise resolved');
      console.log(`📦  Database Name: ${mongoose.connection.name}`);
      console.log(`📡  DB Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    })
    .catch((err) => {
      console.error('❌  MongoDB initial connection FAILED:', err.message);
      console.error('💡  Options to fix:');
      console.error('    1. Install & start MongoDB locally: brew install mongodb-community && brew services start mongodb-community');
      console.error('    2. Use MongoDB Atlas: update MONGODB_URI in .env with your Atlas connection string');
      console.error('    ⚠️  Server will still run but all DB operations will fail until MongoDB is connected');
    });
}

// Request logger middleware (log all incoming API requests)
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`\n📥  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body || {}).length > 0) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '****';
    console.log(`    Body:`, JSON.stringify(safeBody));
  }
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusIcon = res.statusCode < 400 ? '✅' : '❌';
    console.log(`📤  [${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${statusIcon} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbStateMap[dbState] || 'unknown';

  console.log(`\n🏥  Health check requested — DB Status: ${dbStatus}`);

  res.status(200).json({
    success: true,
    message: 'HealthCare+ Backend is running',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5001
  });
});

// API Routes — specific auth routes MUST come before generic /api/auth
// Otherwise /api/auth's router.use(protect) will intercept /api/auth/doctor/register etc.
app.use('/api/auth/doctor', doctorAuthRoutes);
app.use('/api/auth/patient', patientAuthRoutes);
app.use('/api/auth/mr', mrAuthRoutes);

// Generic auth routes (register, login, refresh-token etc.)
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/mr', mrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/app_data', appDataRoutes);

console.log('\n✅  All API routes registered:');
console.log('    POST /api/auth/patient/register');
console.log('    POST /api/auth/patient/login');
console.log('    POST /api/auth/doctor/register');
console.log('    POST /api/auth/doctor/login');
console.log('    POST /api/auth/mr/register');
console.log('    POST /api/auth/mr/login');
console.log('    POST /api/ai/symptom-checker');
console.log('    POST /api/ai/analyze-report');
console.log('    GET  /api/lab/tests');
console.log('    POST /api/lab/bookings');
console.log('    GET  /api/pharmacy/products');
console.log('    POST /api/payments/create-order');
console.log('    POST /api/emergency/sos');
console.log('    POST /api/app_data/send_call_notification');
console.log('    GET  /api/health');

// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  console.warn(`⚠️   404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Server configuration
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5001;
  const server = http.createServer(app);

  // Initialize Socket.io on the HTTP server
  initSocket(server);
  console.log('✅  Socket.io initialized on HTTP server');

  server.listen(PORT, () => {
    console.log('\n==========================================================');
    console.log(`🟢  Server is LIVE on port ${PORT}`);
    console.log(`🌐  Base URL   : http://localhost:${PORT}`);
    console.log(`❤️   Health URL : http://localhost:${PORT}/api/health`);
    console.log(`🔌  Socket.io  : ws://localhost:${PORT}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('==========================================================\n');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⚠️   SIGTERM received: closing HTTP server gracefully...');
    server.close(() => {
      console.log('✅  HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('✅  MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️   SIGINT received (Ctrl+C): closing HTTP server gracefully...');
    server.close(() => {
      console.log('✅  HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('✅  MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

module.exports = app;