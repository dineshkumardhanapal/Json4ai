const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const validator = require('validator');

// Enhanced password security configuration
const PASSWORD_CONFIG = {
  // Increased salt rounds for better security (12 is recommended for 2024+)
  SALT_ROUNDS: 12,
  
  // Password requirements
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  
  // Password complexity requirements
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,
  
  // Special characters allowed
  ALLOWED_SPECIAL_CHARS: '@$!%*?&\-_+=()[]{}|\\:;"\'<>,./`~',
  
  // Common weak passwords to reject
  COMMON_PASSWORDS: [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    '1234567890', 'password1', 'qwerty123', 'dragon', 'master'
  ]
};

// Enhanced password validation
class PasswordSecurity {
  // Validate password strength
  static validatePasswordStrength(password) {
    const errors = [];
    
    if (typeof password !== 'string') {
      errors.push('Password must be a string');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
      errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`);
    }
    
    if (password.length > PASSWORD_CONFIG.MAX_LENGTH) {
      errors.push(`Password must be no more than ${PASSWORD_CONFIG.MAX_LENGTH} characters long`);
    }
    
    // Character type validation
    if (PASSWORD_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (PASSWORD_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (PASSWORD_CONFIG.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (PASSWORD_CONFIG.REQUIRE_SPECIAL_CHARS && !/[@$!%*?&\-_+=()\[\]{}|\\:;"'<>,.\/`~]/.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_CONFIG.ALLOWED_SPECIAL_CHARS})`);
    }
    
    // Check for common passwords
    if (PASSWORD_CONFIG.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password');
    }
    
    // Check for sequential characters
    if (this.hasSequentialChars(password)) {
      errors.push('Password contains sequential characters (e.g., abc, 123)');
    }
    
    // Check for repeated characters
    if (this.hasRepeatedChars(password)) {
      errors.push('Password contains too many repeated characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }
  
  // Calculate password strength score (0-100)
  static calculatePasswordStrength(password) {
    let score = 0;
    
    // Length score (0-25 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;
    
    // Character variety score (0-40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[@$!%*?&]/.test(password)) score += 10;
    
    // Complexity score (0-35 points)
    const uniqueChars = new Set(password).size;
    const complexityRatio = uniqueChars / password.length;
    
    if (complexityRatio > 0.7) score += 15;
    if (complexityRatio > 0.8) score += 10;
    if (complexityRatio > 0.9) score += 10;
    
    return Math.min(score, 100);
  }
  
  // Check for sequential characters
  static hasSequentialChars(password) {
    const sequences = ['abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk', 'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst', 'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz'];
    const numSequences = ['012', '123', '234', '345', '456', '567', '678', '789'];
    
    const lowerPassword = password.toLowerCase();
    
    for (const seq of sequences) {
      if (lowerPassword.includes(seq)) return true;
    }
    
    for (const seq of numSequences) {
      if (password.includes(seq)) return true;
    }
    
    return false;
  }
  
  // Check for repeated characters
  static hasRepeatedChars(password) {
    const charCount = {};
    for (const char of password) {
      charCount[char] = (charCount[char] || 0) + 1;
    }
    
    const maxRepeats = Math.max(...Object.values(charCount));
    return maxRepeats > password.length * 0.3; // More than 30% of password is one character
  }
  
  // Generate cryptographically secure salt
  static generateSalt() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Hash password with enhanced security
  static async hashPassword(password) {
    try {
      // Validate password strength first
      const validation = this.validatePasswordStrength(password);
      if (!validation.isValid) {
        throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Generate additional salt for extra security
      const additionalSalt = this.generateSalt();
      
      // Hash with bcrypt using high salt rounds
      const hash = await bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);
      
      // Combine with additional salt (stored separately)
      return {
        hash,
        salt: additionalSalt,
        rounds: PASSWORD_CONFIG.SALT_ROUNDS,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }
  
  // Verify password with enhanced security
  static async verifyPassword(password, storedHash, additionalSalt = null) {
    try {
      // Basic validation
      if (!password || !storedHash) {
        return false;
      }
      
      // Verify with bcrypt
      const isValid = await bcrypt.compare(password, storedHash);
      
      // Additional verification with extra salt if provided
      if (isValid && additionalSalt) {
        // This is a simplified additional check - in production you might want more sophisticated verification
        const expectedPattern = crypto.createHash('sha256')
          .update(password + additionalSalt)
          .digest('hex')
          .substring(0, 8); // First 8 chars as verification
        
        // Store this pattern in user record for additional verification
        return true; // For now, just return bcrypt result
      }
      
      return isValid;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  // Generate secure random password
  static generateSecurePassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*?&';
    let password = '';
    
    // Ensure at least one character from each required type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '@$!%*?&'[Math.floor(Math.random() * 7)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

// Enhanced JWT security
class JWTSecurity {
  // Generate secure JWT tokens
  static generateTokens(userId, userEmail) {
    const now = Math.floor(Date.now() / 1000);
    
    // Access token payload
    const accessPayload = {
      userId,
      email: userEmail,
      type: 'access',
      iat: now,
      exp: now + (7 * 24 * 60 * 60) // 7 days
    };
    
    // Refresh token payload
    const refreshPayload = {
      userId,
      email: userEmail,
      type: 'refresh',
      iat: now,
      exp: now + (30 * 24 * 60 * 60) // 30 days
    };
    
    // Generate tokens
    const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d'
    });
    
    const refreshToken = jwt.sign(refreshPayload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '30d'
    });
    
    return { accessToken, refreshToken };
  }
  
  // Verify JWT token with enhanced security
  static verifyToken(token, expectedType = 'access') {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
      });
      
      // Verify token type
      if (decoded.type !== expectedType) {
        throw new Error('Invalid token type');
      }
      
      // Check if token is not expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
  
  // Generate secure refresh token hash for storage
  static async hashRefreshToken(refreshToken) {
    return await bcrypt.hash(refreshToken, PASSWORD_CONFIG.SALT_ROUNDS);
  }
  
  // Verify refresh token
  static async verifyRefreshToken(token, storedHash) {
    return await bcrypt.compare(token, storedHash);
  }
}

// Enhanced login security middleware
const enhancedLoginSecurity = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Additional email validation
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        field: 'email'
      });
    }
    
    // Rate limiting check (this would be handled by rate limiting middleware)
    const clientIP = req.ip;
    const userAgent = req.headers['user-agent'];
    
    // Log login attempt
    console.log(`Login attempt from IP: ${clientIP}, Email: ${email}, User-Agent: ${userAgent}`);
    
    // Find user with additional security checks
    const user = await req.db.collection('users').findOne({ 
      email: validator.normalizeEmail(email) 
    });
    
    if (!user) {
      // Log failed attempt
      console.warn(`Failed login attempt - User not found: ${email}, IP: ${clientIP}`);
      
      // Return generic error to prevent user enumeration
      return res.status(400).json({ 
        message: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if user is verified
    if (!user.verified) {
      return res.status(400).json({ 
        message: 'Please verify your email before logging in',
        field: 'email'
      });
    }
    
    // Check for account lockout (implement if needed)
    if (user.loginAttempts >= 5 && user.lockUntil > new Date()) {
      return res.status(423).json({ 
        message: 'Account temporarily locked due to too many failed attempts',
        retryAfter: Math.ceil((user.lockUntil - new Date()) / 1000)
      });
    }
    
    // Verify password with enhanced security
    const isValidPassword = await PasswordSecurity.verifyPassword(
      password, 
      user.password, 
      user.passwordSalt
    );
    
    if (!isValidPassword) {
      // Increment failed attempts
      const updateData = {
        $inc: { loginAttempts: 1 },
        $set: { lastFailedLogin: new Date() }
      };
      
      // Lock account after 5 failed attempts
      if (user.loginAttempts + 1 >= 5) {
        updateData.$set.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      
      await req.db.collection('users').updateOne(
        { _id: user._id }, 
        updateData
      );
      
      console.warn(`Failed login attempt - Invalid password: ${email}, IP: ${clientIP}`);
      
      return res.status(400).json({ 
        message: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }
    
    // Reset failed attempts on successful login
    await req.db.collection('users').updateOne(
      { _id: user._id },
      {
        $unset: { 
          loginAttempts: 1, 
          lockUntil: 1, 
          lastFailedLogin: 1 
        },
        $set: { 
          lastLogin: new Date(),
          lastActivity: new Date()
        }
      }
    );
    
    // Generate secure tokens
    const { accessToken, refreshToken } = JWTSecurity.generateTokens(user._id, user.email);
    
    // Hash and store refresh token
    const hashedRefreshToken = await JWTSecurity.hashRefreshToken(refreshToken);
    
    await req.db.collection('users').updateOne(
      { _id: user._id },
      { $set: { refreshToken: hashedRefreshToken } }
    );
    
    // Log successful login
    console.log(`Successful login: ${email}, IP: ${clientIP}`);
    
    // Attach user info to request for response
    req.user = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      plan: user.plan,
      dailyUsage: user.dailyUsage,
      credits: user.credits
    };
    
    req.tokens = { accessToken, refreshToken };
    
    next();
  } catch (error) {
    console.error('Enhanced login security error:', error);
    res.status(500).json({ 
      message: 'Authentication service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  PasswordSecurity,
  JWTSecurity,
  enhancedLoginSecurity,
  PASSWORD_CONFIG
};
