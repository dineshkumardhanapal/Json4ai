const { body, validationResult, sanitizeBody } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

// Comprehensive input sanitization functions
const sanitizeInput = {
  // Sanitize text input - remove HTML tags and escape special characters
  text: (input) => {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  },
  
  // Sanitize HTML input - allow safe HTML tags only
  html: (input) => {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: []
    });
  },
  
  // Sanitize email input
  email: (input) => {
    if (typeof input !== 'string') return input;
    return validator.normalizeEmail(input) || '';
  },
  
  // Sanitize URL input
  url: (input) => {
    if (typeof input !== 'string') return input;
    return validator.escape(input);
  },
  
  // Sanitize MongoDB ObjectId
  objectId: (input) => {
    if (typeof input !== 'string') return input;
    return validator.isMongoId(input) ? input : null;
  },
  
  // Sanitize numeric input
  number: (input) => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
      const num = parseFloat(input);
      return isNaN(num) ? null : num;
    }
    return null;
  },
  
  // Sanitize boolean input
  boolean: (input) => {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true';
    }
    return false;
  }
};

// Enhanced validation middleware with sanitization
const createSanitizedValidator = (field, rules) => {
  const validators = [];
  
  // Add sanitization first
  validators.push(
    body(field).customSanitizer((value) => {
      if (value === undefined || value === null) return value;
      return sanitizeInput.text(value);
    })
  );
  
  // Add validation rules
  rules.forEach(rule => validators.push(rule));
  
  return validators;
};

// Validation middleware for user registration
const validateRegistration = [
  // First name validation with sanitization
  body('firstName')
    .customSanitizer((value) => sanitizeInput.text(value))
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  // Last name validation with sanitization
  body('lastName')
    .customSanitizer((value) => sanitizeInput.text(value))
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  // Email validation with sanitization
  body('email')
    .customSanitizer((value) => sanitizeInput.email(value))
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),
  
  // Password validation (no sanitization needed for passwords)
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_+=()\[\]{}|\\:;"'<>,.\/`~])[A-Za-z\d@$!%*?&\-_+=()\[\]{}|\\:;"'<>,.\/`~]+$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Registration validation errors:', errors.array());
      console.log('Registration request body:', req.body);
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    console.log('Registration validation passed');
    next();
  }
];

// Validation middleware for user login
const validateLogin = [
  // Email validation with sanitization
  body('email')
    .customSanitizer((value) => sanitizeInput.email(value))
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation (no sanitization needed for passwords)
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password length must be between 1 and 128 characters'),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation middleware for prompt generation
const validatePromptGeneration = [
  // Comment validation with comprehensive sanitization
  body('comment')
    .customSanitizer((value) => sanitizeInput.text(value))
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .matches(/^[a-zA-Z0-9\s.,!?@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/~`]*$/)
    .withMessage('Comment contains invalid characters')
    .escape(),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation middleware for profile updates
const validateProfileUpdate = [
  // First name validation with sanitization
  body('firstName')
    .customSanitizer((value) => sanitizeInput.text(value))
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  // Last name validation with sanitization
  body('lastName')
    .customSanitizer((value) => sanitizeInput.text(value))
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation middleware for payment subscription
const validatePaymentSubscription = [
  // Plan type validation with sanitization
  body('planType')
    .customSanitizer((value) => sanitizeInput.text(value))
    .isIn(['starter', 'premium'])
    .withMessage('Plan type must be either starter or premium')
    .escape(),
  
  // Billing period validation with sanitization
  body('billingPeriod')
    .optional()
    .customSanitizer((value) => sanitizeInput.text(value))
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing period must be either monthly or yearly')
    .escape(),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation middleware for password reset
const validatePasswordReset = [
  // Email validation with sanitization
  body('email')
    .customSanitizer((value) => sanitizeInput.email(value))
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation middleware for password update
const validatePasswordUpdate = [
  // Current password validation
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Current password length must be between 1 and 128 characters'),
  
  // New password validation
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_+=()\[\]{}|\\:;"'<>,.\/`~])[A-Za-z\d@$!%*?&\-_+=()\[\]{}|\\:;"'<>,.\/`~]+$/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Enhanced ObjectId sanitization
const sanitizeObjectId = (req, res, next) => {
  if (req.params.id && !/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  next();
};

// General input sanitization middleware
const sanitizeAllInputs = (req, res, next) => {
  // Sanitize all string inputs in req.body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Don't sanitize passwords
        if (key.toLowerCase().includes('password')) {
          return;
        }
        req.body[key] = sanitizeInput.text(req.body[key]);
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput.text(req.query[key]);
      }
    });
  }
  
  next();
};

// Rate limiting for sensitive operations
const sensitiveOperationLimiter = (req, res, next) => {
  // This would be used with express-rate-limit for sensitive operations
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validatePromptGeneration,
  validateProfileUpdate,
  validatePaymentSubscription,
  validatePasswordReset,
  validatePasswordUpdate,
  sanitizeObjectId,
  sanitizeAllInputs,
  sanitizeInput,
  sensitiveOperationLimiter
};
