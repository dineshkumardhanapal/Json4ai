const crypto = require('crypto');
const validator = require('validator');

// Enterprise-grade password policy configuration
const PASSWORD_POLICY = {
  // Length requirements
  MIN_LENGTH: 12,                    // Increased minimum length
  MAX_LENGTH: 128,                   // Maximum length limit
  
  // Character requirements
  REQUIRE_UPPERCASE: true,           // Must contain uppercase letters
  REQUIRE_LOWERCASE: true,           // Must contain lowercase letters
  REQUIRE_NUMBERS: true,             // Must contain numbers
  REQUIRE_SPECIAL_CHARS: true,       // Must contain special characters
  MIN_UPPERCASE: 2,                  // Minimum uppercase letters
  MIN_LOWERCASE: 2,                  // Minimum lowercase letters
  MIN_NUMBERS: 2,                    // Minimum numbers
  MIN_SPECIAL_CHARS: 2,              // Minimum special characters
  
  // Allowed special characters (restricted set for security)
  ALLOWED_SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  
  // Complexity requirements
  MAX_REPEATED_CHARS: 2,             // Maximum consecutive repeated characters
  MAX_SEQUENTIAL_CHARS: 3,           // Maximum sequential characters (abc, 123)
  MIN_UNIQUE_CHARS: 8,               // Minimum unique characters
  
  // Security requirements
  REQUIRE_NO_COMMON_WORDS: true,     // No common dictionary words
  REQUIRE_NO_PERSONAL_INFO: true,    // No personal information
  REQUIRE_NO_KEYBOARD_PATTERNS: true, // No keyboard patterns (qwerty, asdf)
  
  // Password history
  PASSWORD_HISTORY_COUNT: 12,        // Remember last 12 passwords
  
  // Expiration policy
  PASSWORD_EXPIRY_DAYS: 90,          // Password expires every 90 days
  WARNING_DAYS: 14,                  // Warning 14 days before expiry
  
  // Account lockout
  MAX_FAILED_ATTEMPTS: 3,            // Reduced from 5 for stricter security
  LOCKOUT_DURATION_MINUTES: 30,      // Increased lockout duration
  PROGRESSIVE_DELAY: true,           // Progressive delays between attempts
  
  // Advanced security
  REQUIRE_NO_LEET_SPEAK: true,       // No leet speak substitutions (4 for A, @ for a)
  REQUIRE_NO_REVERSED_WORDS: true,   // No reversed dictionary words
  REQUIRE_NO_PHONE_PATTERNS: true,   // No phone number patterns
  REQUIRE_NO_DATE_PATTERNS: true,    // No date patterns (MM/DD/YYYY)
};

// Comprehensive password validation class
class PasswordPolicyEnforcer {
  // Main password validation method
  static validatePassword(password, userInfo = {}, passwordHistory = []) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      strength: 0,
      compliance: {},
      recommendations: []
    };
    
    // Basic type validation
    if (typeof password !== 'string') {
      validation.errors.push('Password must be a string');
      validation.isValid = false;
      return validation;
    }
    
    // Length validation
    this.validateLength(password, validation);
    
    // Character requirements validation
    this.validateCharacterRequirements(password, validation);
    
    // Complexity validation
    this.validateComplexity(password, validation);
    
    // Security pattern validation
    this.validateSecurityPatterns(password, validation);
    
    // Personal information validation
    if (PASSWORD_POLICY.REQUIRE_NO_PERSONAL_INFO) {
      this.validatePersonalInfo(password, userInfo, validation);
    }
    
    // Password history validation
    if (passwordHistory.length > 0) {
      this.validatePasswordHistory(password, passwordHistory, validation);
    }
    
    // Calculate strength and compliance
    validation.strength = this.calculateAdvancedStrength(password);
    validation.compliance = this.calculateCompliance(password);
    
    // Generate recommendations
    validation.recommendations = this.generateRecommendations(password, validation);
    
    // Final validation
    validation.isValid = validation.errors.length === 0;
    
    return validation;
  }
  
  // Length validation
  static validateLength(password, validation) {
    if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
      validation.errors.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`);
    }
    
    if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
      validation.errors.push(`Password must be no more than ${PASSWORD_POLICY.MAX_LENGTH} characters long`);
    }
    
    // Optimal length recommendation
    if (password.length < 16) {
      validation.warnings.push('Consider using a password with at least 16 characters for better security');
    }
  }
  
  // Character requirements validation
  static validateCharacterRequirements(password, validation) {
    const upperCount = (password.match(/[A-Z]/g) || []).length;
    const lowerCount = (password.match(/[a-z]/g) || []).length;
    const numberCount = (password.match(/\d/g) || []).length;
    const specialCount = (password.match(new RegExp(`[${PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g')) || []).length;
    
    if (PASSWORD_POLICY.REQUIRE_UPPERCASE && upperCount < PASSWORD_POLICY.MIN_UPPERCASE) {
      validation.errors.push(`Password must contain at least ${PASSWORD_POLICY.MIN_UPPERCASE} uppercase letters`);
    }
    
    if (PASSWORD_POLICY.REQUIRE_LOWERCASE && lowerCount < PASSWORD_POLICY.MIN_LOWERCASE) {
      validation.errors.push(`Password must contain at least ${PASSWORD_POLICY.MIN_LOWERCASE} lowercase letters`);
    }
    
    if (PASSWORD_POLICY.REQUIRE_NUMBERS && numberCount < PASSWORD_POLICY.MIN_NUMBERS) {
      validation.errors.push(`Password must contain at least ${PASSWORD_POLICY.MIN_NUMBERS} numbers`);
    }
    
    if (PASSWORD_POLICY.REQUIRE_SPECIAL_CHARS && specialCount < PASSWORD_POLICY.MIN_SPECIAL_CHARS) {
      validation.errors.push(`Password must contain at least ${PASSWORD_POLICY.MIN_SPECIAL_CHARS} special characters`);
    }
  }
  
  // Complexity validation
  static validateComplexity(password, validation) {
    // Check for repeated characters
    const repeatedPattern = new RegExp(`(.)\\1{${PASSWORD_POLICY.MAX_REPEATED_CHARS},}`, 'g');
    if (repeatedPattern.test(password)) {
      validation.errors.push(`Password cannot contain more than ${PASSWORD_POLICY.MAX_REPEATED_CHARS} consecutive repeated characters`);
    }
    
    // Check for sequential characters
    if (this.hasSequentialPattern(password, PASSWORD_POLICY.MAX_SEQUENTIAL_CHARS)) {
      validation.errors.push(`Password cannot contain more than ${PASSWORD_POLICY.MAX_SEQUENTIAL_CHARS} sequential characters`);
    }
    
    // Check unique character count
    const uniqueChars = new Set(password).size;
    if (uniqueChars < PASSWORD_POLICY.MIN_UNIQUE_CHARS) {
      validation.errors.push(`Password must contain at least ${PASSWORD_POLICY.MIN_UNIQUE_CHARS} unique characters`);
    }
  }
  
  // Security pattern validation
  static validateSecurityPatterns(password, validation) {
    const lowerPassword = password.toLowerCase();
    
    // Check for common words
    if (PASSWORD_POLICY.REQUIRE_NO_COMMON_WORDS) {
      const commonWords = this.getCommonWords();
      for (const word of commonWords) {
        if (lowerPassword.includes(word.toLowerCase())) {
          validation.errors.push(`Password cannot contain common words like "${word}"`);
          break;
        }
      }
    }
    
    // Check for keyboard patterns
    if (PASSWORD_POLICY.REQUIRE_NO_KEYBOARD_PATTERNS) {
      const keyboardPatterns = this.getKeyboardPatterns();
      for (const pattern of keyboardPatterns) {
        if (lowerPassword.includes(pattern.toLowerCase())) {
          validation.errors.push(`Password cannot contain keyboard patterns like "${pattern}"`);
          break;
        }
      }
    }
    
    // Check for leet speak
    if (PASSWORD_POLICY.REQUIRE_NO_LEET_SPEAK) {
      const leetPatterns = this.getLeetSpeakPatterns();
      for (const pattern of leetPatterns) {
        if (lowerPassword.includes(pattern.toLowerCase())) {
          validation.errors.push(`Password cannot contain leet speak patterns like "${pattern}"`);
          break;
        }
      }
    }
    
    // Check for phone patterns
    if (PASSWORD_POLICY.REQUIRE_NO_PHONE_PATTERNS) {
      const phonePattern = /(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/;
      if (phonePattern.test(password)) {
        validation.errors.push('Password cannot contain phone number patterns');
      }
    }
    
    // Check for date patterns
    if (PASSWORD_POLICY.REQUIRE_NO_DATE_PATTERNS) {
      const datePatterns = [
        /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,  // MM/DD/YYYY
        /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,   // YYYY/MM/DD
        /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}/   // MM/DD/YY
      ];
      
      for (const pattern of datePatterns) {
        if (pattern.test(password)) {
          validation.errors.push('Password cannot contain date patterns');
          break;
        }
      }
    }
  }
  
  // Personal information validation
  static validatePersonalInfo(password, userInfo, validation) {
    const lowerPassword = password.toLowerCase();
    
    // Check for name patterns
    if (userInfo.firstName && lowerPassword.includes(userInfo.firstName.toLowerCase())) {
      validation.errors.push('Password cannot contain your first name');
    }
    
    if (userInfo.lastName && lowerPassword.includes(userInfo.lastName.toLowerCase())) {
      validation.errors.push('Password cannot contain your last name');
    }
    
    // Check for email patterns
    if (userInfo.email) {
      const emailParts = userInfo.email.split('@');
      if (emailParts[0] && lowerPassword.includes(emailParts[0].toLowerCase())) {
        validation.errors.push('Password cannot contain your email username');
      }
    }
    
    // Check for common personal patterns
    const personalPatterns = ['birthday', 'birth', 'anniversary', 'wedding', 'graduation'];
    for (const pattern of personalPatterns) {
      if (lowerPassword.includes(pattern)) {
        validation.errors.push(`Password cannot contain personal information like "${pattern}"`);
        break;
      }
    }
  }
  
  // Password history validation
  static validatePasswordHistory(password, passwordHistory, validation) {
    for (let i = 0; i < Math.min(passwordHistory.length, PASSWORD_POLICY.PASSWORD_HISTORY_COUNT); i++) {
      if (password === passwordHistory[i]) {
        validation.errors.push('Password cannot be the same as any of your last passwords');
        break;
      }
      
      // Check for similarity (80% similarity threshold)
      if (this.calculateSimilarity(password, passwordHistory[i]) > 0.8) {
        validation.errors.push('Password is too similar to a previous password');
        break;
      }
    }
  }
  
  // Advanced strength calculation
  static calculateAdvancedStrength(password) {
    let score = 0;
    
    // Length score (0-30 points)
    if (password.length >= 12) score += 15;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;
    
    // Character variety score (0-40 points)
    const upperCount = (password.match(/[A-Z]/g) || []).length;
    const lowerCount = (password.match(/[a-z]/g) || []).length;
    const numberCount = (password.match(/\d/g) || []).length;
    const specialCount = (password.match(new RegExp(`[${PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g')) || []).length;
    
    score += Math.min(upperCount * 2, 10);
    score += Math.min(lowerCount * 2, 10);
    score += Math.min(numberCount * 2, 10);
    score += Math.min(specialCount * 2, 10);
    
    // Complexity score (0-30 points)
    const uniqueChars = new Set(password).size;
    const complexityRatio = uniqueChars / password.length;
    
    if (complexityRatio > 0.8) score += 15;
    if (complexityRatio > 0.9) score += 10;
    if (complexityRatio > 0.95) score += 5;
    
    return Math.min(score, 100);
  }
  
  // Calculate compliance score
  static calculateCompliance(password) {
    const compliance = {
      length: password.length >= PASSWORD_POLICY.MIN_LENGTH,
      uppercase: (password.match(/[A-Z]/g) || []).length >= PASSWORD_POLICY.MIN_UPPERCASE,
      lowercase: (password.match(/[a-z]/g) || []).length >= PASSWORD_POLICY.MIN_LOWERCASE,
      numbers: (password.match(/\d/g) || []).length >= PASSWORD_POLICY.MIN_NUMBERS,
      special: (password.match(new RegExp(`[${PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g')) || []).length >= PASSWORD_POLICY.MIN_SPECIAL_CHARS,
      complexity: new Set(password).size >= PASSWORD_POLICY.MIN_UNIQUE_CHARS,
      noPatterns: !this.hasSequentialPattern(password, PASSWORD_POLICY.MAX_SEQUENTIAL_CHARS)
    };
    
    const totalChecks = Object.keys(compliance).length;
    const passedChecks = Object.values(compliance).filter(Boolean).length;
    
    compliance.score = (passedChecks / totalChecks) * 100;
    
    return compliance;
  }
  
  // Generate recommendations
  static generateRecommendations(password, validation) {
    const recommendations = [];
    
    if (password.length < 16) {
      recommendations.push('Use a longer password (16+ characters) for better security');
    }
    
    const uniqueChars = new Set(password).size;
    if (uniqueChars < 12) {
      recommendations.push('Include more unique characters to increase complexity');
    }
    
    if (!validation.compliance.uppercase) {
      recommendations.push('Add more uppercase letters');
    }
    
    if (!validation.compliance.lowercase) {
      recommendations.push('Add more lowercase letters');
    }
    
    if (!validation.compliance.numbers) {
      recommendations.push('Add more numbers');
    }
    
    if (!validation.compliance.special) {
      recommendations.push('Add more special characters');
    }
    
    if (validation.strength < 80) {
      recommendations.push('Consider using a passphrase with random words for better memorability and security');
    }
    
    return recommendations;
  }
  
  // Helper methods
  static hasSequentialPattern(password, maxLength) {
    const sequences = this.getSequentialPatterns(maxLength);
    const lowerPassword = password.toLowerCase();
    
    for (const seq of sequences) {
      if (lowerPassword.includes(seq.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  static getSequentialPatterns(maxLength) {
    const patterns = [];
    
    // Alphabetical sequences
    for (let i = 0; i < 26 - maxLength; i++) {
      let seq = '';
      for (let j = 0; j <= maxLength; j++) {
        seq += String.fromCharCode(97 + i + j);
      }
      patterns.push(seq);
    }
    
    // Numerical sequences
    for (let i = 0; i < 10 - maxLength; i++) {
      let seq = '';
      for (let j = 0; j <= maxLength; j++) {
        seq += (i + j).toString();
      }
      patterns.push(seq);
    }
    
    return patterns;
  }
  
  static getCommonWords() {
    return [
      'password', 'admin', 'user', 'login', 'welcome', 'hello', 'world',
      'computer', 'internet', 'website', 'email', 'phone', 'mobile',
      'security', 'privacy', 'account', 'profile', 'settings', 'system',
      'database', 'server', 'network', 'application', 'software', 'hardware'
    ];
  }
  
  static getKeyboardPatterns() {
    return [
      'qwerty', 'asdfgh', 'zxcvbn', 'qwertyuiop', 'asdfghjkl',
      'zxcvbnm', '123456', 'abcdef', 'qwerty123', 'password123'
    ];
  }
  
  static getLeetSpeakPatterns() {
    return [
      '4dm1n', 'p4ssw0rd', 'u53r', 'l0g1n', 'w3lc0m3',
      'h3ll0', 'w0rld', 'c0mput3r', '1nt3rn3t', 'w3bs1t3'
    ];
  }
  
  static calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  // Generate secure password based on policy
  static generateSecurePassword(length = 16) {
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS
    };
    
    let password = '';
    
    // Ensure minimum requirements
    password += this.getRandomChar(charset.uppercase, PASSWORD_POLICY.MIN_UPPERCASE);
    password += this.getRandomChar(charset.lowercase, PASSWORD_POLICY.MIN_LOWERCASE);
    password += this.getRandomChar(charset.numbers, PASSWORD_POLICY.MIN_NUMBERS);
    password += this.getRandomChar(charset.special, PASSWORD_POLICY.MIN_SPECIAL_CHARS);
    
    // Fill remaining length
    const allChars = charset.uppercase + charset.lowercase + charset.numbers + charset.special;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  static getRandomChar(charset, count) {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
  }
  
  // Check password expiry
  static checkPasswordExpiry(passwordCreatedAt) {
    const now = new Date();
    const created = new Date(passwordCreatedAt);
    const daysSinceCreation = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    
    return {
      isExpired: daysSinceCreation > PASSWORD_POLICY.PASSWORD_EXPIRY_DAYS,
      daysUntilExpiry: PASSWORD_POLICY.PASSWORD_EXPIRY_DAYS - daysSinceCreation,
      needsWarning: daysSinceCreation > (PASSWORD_POLICY.PASSWORD_EXPIRY_DAYS - PASSWORD_POLICY.WARNING_DAYS),
      daysSinceCreation
    };
  }
}

module.exports = {
  PasswordPolicyEnforcer,
  PASSWORD_POLICY
};
