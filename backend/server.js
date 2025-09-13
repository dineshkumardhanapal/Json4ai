require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { validateEnvironment } = require('./config/envValidation');
const { 
  securityHeaders, 
  generalLimiter, 
  authLimiter, 
  promptLimiter, 
  paymentLimiter,
  preventNoSQLInjection,
  requestSizeLimiter,
  securityLogger
} = require('./middleware/security');
const { sanitizeAllInputs } = require('./middleware/validation');
const { zeroTrustMiddleware } = require('./middleware/zeroTrust');
const { accessControlMiddleware } = require('./middleware/accessControl');

// Validate environment variables before starting
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();

// Trust proxy for Render deployment (fixes rate limiter X-Forwarded-For issue)
app.set('trust proxy', 1);

// Enhanced security middleware
app.use(securityHeaders);
app.use(requestSizeLimiter);
app.use(preventNoSQLInjection);
app.use(securityLogger);

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Handle CORS preflight requests
app.options('*', cors());

// Apply specific rate limiting to different route types
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use('/api/prompt/generate', promptLimiter);
app.use('/api/payment', paymentLimiter);

// CORS configuration - more flexible for production
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.FRONTEND_URL, 
      'https://json4ai.netlify.app',
      'https://json4ai.onrender.com',
      'https://rainbow-squirrel-4fcfd6.netlify.app',
      'https://*.netlify.app',
      /^https:\/\/.*\.netlify\.app$/,  // Allow any Netlify subdomain
      /^https:\/\/.*\.onrender\.com$/  // Allow any Render subdomain
    ]
  : ['http://localhost:3000', 'http://localhost:5000'];

// Log CORS configuration for debugging
console.log('🔧 CORS Configuration:');
console.log('Environment:', process.env.NODE_ENV);
console.log('Frontend URL:', process.env.FRONTEND_URL);
console.log('Allowed origins:', corsOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    const isAllowed = corsOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
app.use(sanitizeAllInputs);

// Zero Trust Security Middleware (applied to all routes)
app.use(zeroTrustMiddleware);

// MongoDB connection with security options
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Test endpoint for CORS debugging
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/prompt', require('./routes/prompt'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/admin-monitoring'));

// Start subscription renewal jobs (disabled by default for one-time plans)
// const subscriptionJobs = require('./legacy/subscriptionRenewal');
// subscriptionJobs.startJobs();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // if (subscriptionJobs) subscriptionJobs.stopJobs();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  // if (subscriptionJobs) subscriptionJobs.stopJobs();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Auto-create super admin if environment variable is set
// Wait for MongoDB connection before creating super admin
mongoose.connection.once('open', async () => {
  if (process.env.CREATE_SUPER_ADMIN === 'true') {
    console.log('🔧 Auto-creating super admin from environment variables...');
    const { createSuperAdmin } = require('./scripts/create-super-admin');
    try {
      await createSuperAdmin();
      console.log('✅ Super admin creation completed');
    } catch (error) {
      console.error('❌ Error creating Super Admin:', error);
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Subscription renewal jobs started');
});