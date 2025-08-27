require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Add CSP headers for PayPal integration
app.use((req, res, next) => {
  // Only apply CSP headers to PayPal-related routes
  if (req.path.startsWith('/api/paypal')) {
    res.set({
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://*.paypalobjects.com",
        "style-src 'self' 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com",
        "img-src 'self' data: https: blob: https://*.paypal.com https://*.paypalobjects.com",
        "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://api-m.sandbox.paypal.com https://api-m.paypal.com",
        "frame-src 'self' https://*.paypal.com https://*.paypalobjects.com",
        "frame-ancestors 'self'",
        "form-action 'self' https://*.paypal.com"
      ].join('; ')
    });
  }
  next();
});

// Raw body parsing for PayPal webhooks (if needed)
app.use('/api/paypal/webhook', express.raw({ type: 'application/json' }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/prompt', require('./routes/prompt'));
app.use('/api/paypal', require('./routes/paypal'));

// Start subscription renewal jobs
const subscriptionJobs = require('./jobs/subscriptionRenewal');
subscriptionJobs.startJobs();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  subscriptionJobs.stopJobs();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  subscriptionJobs.stopJobs();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Subscription renewal jobs started');
});