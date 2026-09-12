const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');

dotenv.config();

console.log('==========================================================');
console.log('🚀  Medionic Backend Server Starting...');
console.log('==========================================================');
console.log(`📌  NODE_ENV     : ${process.env.NODE_ENV || 'development'}`);
console.log(`📌  PORT         : ${process.env.PORT || 5001}`);
console.log(`📌  CLIENT_URL   : ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
console.log('==========================================================');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const mrRoutes = require('./routes/mrRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const razorpayRoutes = require('./routes/razorpayRoutes');
const aiRoutes = require('./routes/aiRoutes');
const labRoutes = require('./routes/labRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const appDataRoutes = require('./routes/appDataRoutes');

// Pharmacy Subsystem (Unified)
const pharmacyRouter = require('./routes/pharmacy');
const { initSocket: initPharmacySocket } = require('./socket/pharmacyEvents');


const doctorAuthRoutes = require('./routes/auth/doctor/doctorRoutes');
const patientAuthRoutes = require('./routes/auth/patient/patientRoutes');
const mrAuthRoutes = require('./routes/auth/mr/mrRoutes');


const { initializeFirebase } = require('./config/firebase');
initializeFirebase();


const initSocket = require('./socket');

console.log('✅  All routes imported successfully');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
console.log('✅  Helmet security middleware applied');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
console.log('✅  Rate limiter applied on /api/');


app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'mediclbackend/uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✅  Body parser & uploads middleware applied');


app.use(cors({
  origin: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(origin => origin.trim()),
  credentials: true
}));
console.log(`✅  CORS enabled for origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log('✅  Morgan HTTP request logger enabled (dev mode)');
}

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


app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const start = Date.now();
  console.log(`\n📥  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusIcon = res.statusCode < 400 ? '✅' : '❌';
    console.log(`📤  [${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${statusIcon} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

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
    port: process.env.PORT || 5001,
    requestId: req.requestId
  });
});

app.get('/api/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { database: ready ? 'connected' : 'unavailable' },
    requestId: req.requestId
  });
});

app.use('/api/auth/doctor', doctorAuthRoutes);
app.use('/api/auth/patient', patientAuthRoutes);
app.use('/api/auth/mr', mrAuthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/mr', mrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', razorpayRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/app_data', appDataRoutes);

// Mount Pharmacy Subsystem routes (/api/v1)
app.use(process.env.API_PREFIX || '/api/v1', pharmacyRouter);

console.log('\n✅  All API routes registered:');
console.log('    POST /api/auth/patient/register');
console.log('    POST /api/auth/patient/login');
console.log('    POST /api/auth/doctor/register');
console.log('    POST /api/auth/doctor/login');
console.log('    POST /api/auth/mr/register');
console.log('    POST /api/auth/mr/login');
console.log('    POST /api/admin/register  ← Admin self-registration (secret key required)');
console.log('    POST /api/admin/login     ← Admin login');
console.log('    GET  /api/admin/dashboard');
console.log('    GET  /api/admin/doctors   ← Admin: all doctors');
console.log('    GET  /api/admin/mr        ← Admin: all MRs');
console.log('    GET  /api/admin/patients  ← Admin: all patients');
console.log('    GET  /api/admin/pharmacy-owners  ← Admin: all pharmacy owners');
console.log('    PUT  /api/admin/pharmacy-owners/:id/approve');
console.log('    PUT  /api/admin/pharmacy-owners/:id/reject');
console.log('    POST /api/ai/symptom-checker');
console.log('    POST /api/ai/analyze-report');
console.log('    GET  /api/lab/tests');
console.log('    POST /api/lab/bookings');
console.log('    GET  /api/pharmacy/products');
console.log('    POST /api/payments/create-order');
console.log('    POST /api/create-order');
console.log('    POST /api/verify-payment');
console.log('    POST /api/emergency/sos');
console.log('    POST /api/app_data/send_call_notification');
console.log('    GET  /api/health');
console.log('    [*]  /api/v1/auth (Pharmacy Auth)');
console.log('    [*]  /api/v1/inventory (Pharmacy Inventory)');
console.log('    [*]  /api/v1/orders (Pharmacy Orders)');
console.log('    [*]  /api/v1/pos (Pharmacy POS & Billing)');
console.log('    [*]  /api/v1/prescriptions (Pharmacy Prescriptions)');
console.log('    [*]  /api/v1/staff (Pharmacy Staff)');
console.log('    [*]  /api/v1/branch (Pharmacy Branches)');
console.log('    [*]  /api/v1/customers (Pharmacy Customers)');
console.log('    [*]  /api/v1/reports (Pharmacy Reports)');
console.log('    [*]  /api/v1/notifications (Pharmacy Alerts)');



app.use(errorHandler);

app.use('*', (req, res) => {
  console.warn(`⚠️   404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5001;
  const server = http.createServer(app);
  const io = initSocket(server);
  initPharmacySocket(io);
  console.log('✅  Socket.io initialized on HTTP server (Calling & Pharmacy Subsystems)');


  server.listen(PORT, () => {
    console.log('\n==========================================================');
    console.log(`🟢  Server is LIVE on port ${PORT}`);
    console.log(`🌐  Base URL   : http://localhost:${PORT}`);
    console.log(`❤️   Health URL : http://localhost:${PORT}/api/health`);
    console.log(`🔌  Socket.io  : ws://localhost:${PORT}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('==========================================================\n');
  });


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