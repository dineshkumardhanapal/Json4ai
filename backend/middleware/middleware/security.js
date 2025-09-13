const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const crypto = require('crypto');

// Enhanced security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://*.onrender.com", "https://json4ai.onrender.com", "https://*.netlify.app"],
      frameSrc: ["'self'", "https://checkout.razorpay.com"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  hidePoweredBy: true
});

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different operations
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later.'
);

const promptLimiter = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 prompts per minute
  'Too many prompt generation requests, please slow down.'
);

const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

const paymentLimiter = createRateLimit(
  60 * 1000, // 1 minute
  3, // 3 payment attempts per minute
  'Too many payment attempts, please try again later.'
);

// Input validation and sanitization
const validateAndSanitize = {
  // Validate email format
  email: (email) => {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }
    return validator.normalizeEmail(email);
  },

  // Validate and sanitize text input
  text: (text, maxLength = 1000) => {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }
    if (text.length > maxLength) {
      throw new Error(`Input too long. Maximum ${maxLength} characters allowed.`);
    }
    return validator.escape(text.trim());
  },

  // Validate MongoDB ObjectId
  objectId: (id) => {
    if (!validator.isMongoId(id)) {
      throw new Error('Invalid ID format');
    }
    return id;
  },

  // Validate URL
  url: (url) => {
    if (!validator.isURL(url, { protocols: ['http', 'https'] })) {
      throw new Error('Invalid URL format');
    }
    return validator.escape(url);
  },

  // Validate numeric input
  number: (num, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = parseFloat(num);
    if (isNaN(parsed)) {
      throw new Error('Invalid number format');
    }
    if (parsed < min || parsed > max) {
      throw new Error(`Number must be between ${min} and ${max}`);
    }
    return parsed;
  }
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests and API endpoints that don't need it
  if (req.method === 'GET' || req.path.startsWith('/api/')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
};

// SQL injection prevention (for MongoDB, this is mainly about proper query construction)
const preventNoSQLInjection = (req, res, next) => {
  // Sanitize query parameters to prevent NoSQL injection
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        req.query[key] = value.replace(/[$]/g, '');
      }
    });
  }

  // Sanitize body parameters
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      const value = req.body[key];
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        req.body[key] = value.replace(/[$]/g, '');
      }
    });
  }

  next();
};

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({ error: 'Request too large' });
  }

  next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      statusCode: res.statusCode,
      duration: duration
    };

    // Log suspicious activities
    if (res.statusCode >= 400) {
      console.warn('Security Warning:', logData);
    }

    // Log slow requests
    if (duration > 5000) {
      console.warn('Slow Request:', logData);
    }
  });

  next();
};

// Generate secure random tokens
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Validate JWT token format
const validateJWTFormat = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  return parts.length === 3;
};

module.exports = {
  securityHeaders,
  authLimiter,
  promptLimiter,
  generalLimiter,
  paymentLimiter,
  validateAndSanitize,
  csrfProtection,
  preventNoSQLInjection,
  requestSizeLimiter,
  securityLogger,
  generateSecureToken,
  validateJWTFormat
};

