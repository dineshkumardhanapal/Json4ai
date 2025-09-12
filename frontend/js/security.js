// Frontend Security Utilities
class SecurityUtils {
  // Sanitize HTML content to prevent XSS
  static sanitizeHTML(input) {
    if (typeof input !== 'string') return input;
    
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  // Sanitize text input (remove HTML tags)
  static sanitizeText(input) {
    if (typeof input !== 'string') return input;
    
    // Remove HTML tags and decode entities
    const div = document.createElement('div');
    div.innerHTML = input;
    return div.textContent || div.innerText || '';
  }

  // Validate email format
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Enhanced password strength validation
  static validatePassword(password) {
    const minLength = 8;
    const maxLength = 128;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    
    // Common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'password1', 'qwerty123', 'dragon', 'master'
    ];
    
    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    
    if (password.length > maxLength) {
      errors.push(`Password must be no more than ${maxLength} characters long`);
    }
    
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }
    
    if (commonPasswords.includes(password.toLowerCase())) {
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
    
    const strength = this.calculatePasswordStrength(password);
    
    return {
      isValid: errors.length === 0,
      errors,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      strength,
      strengthLevel: strength >= 80 ? 'strong' : 
                    strength >= 60 ? 'medium' : 
                    strength >= 40 ? 'weak' : 'very weak'
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

  // Escape special characters for HTML
  static escapeHTML(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, (s) => map[s]);
  }

  // Validate and sanitize form input
  static sanitizeFormInput(input, type = 'text') {
    if (typeof input !== 'string') return input;
    
    switch (type) {
      case 'email':
        return this.validateEmail(input) ? input.toLowerCase().trim() : '';
      case 'text':
        return this.sanitizeText(input).trim();
      case 'html':
        return this.sanitizeHTML(input);
      case 'url':
        try {
          new URL(input);
          return input.trim();
        } catch {
          return '';
        }
      default:
        return this.sanitizeText(input).trim();
    }
  }

  // Secure form submission with CSRF protection
  static async secureFormSubmit(url, data, options = {}) {
    try {
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(url, {
        method: options.method || 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Secure form submission error:', error);
      throw error;
    }
  }

  // Validate file upload
  static validateFileUpload(file, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    const errors = [];
    
    if (!file) {
      errors.push('No file selected');
      return { isValid: false, errors };
    }
    
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate secure random string
  static generateSecureString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    
    return result;
  }
  
  // Generate secure password
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
  
  // Create password strength indicator
  static createPasswordStrengthIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'password-strength-indicator';
    indicator.innerHTML = `
      <div class="strength-bar">
        <div class="strength-fill"></div>
      </div>
      <div class="strength-text"></div>
      <div class="strength-requirements"></div>
    `;
    
    container.appendChild(indicator);
    
    return indicator;
  }
  
  // Update password strength indicator
  static updatePasswordStrengthIndicator(password, indicatorElement) {
    if (!indicatorElement) return;
    
    const validation = this.validatePassword(password);
    const strengthFill = indicatorElement.querySelector('.strength-fill');
    const strengthText = indicatorElement.querySelector('.strength-text');
    const strengthRequirements = indicatorElement.querySelector('.strength-requirements');
    
    // Update strength bar
    strengthFill.style.width = `${validation.strength}%`;
    strengthFill.className = `strength-fill strength-${validation.strengthLevel}`;
    
    // Update strength text
    strengthText.textContent = `Password strength: ${validation.strengthLevel} (${validation.strength}%)`;
    strengthText.className = `strength-text strength-${validation.strengthLevel}`;
    
    // Update requirements
    if (validation.errors.length > 0) {
      strengthRequirements.innerHTML = `
        <div class="requirements-title">Requirements:</div>
        <ul class="requirements-list">
          ${validation.errors.map(error => `<li class="requirement-item">${error}</li>`).join('')}
        </ul>
      `;
    } else {
      strengthRequirements.innerHTML = '<div class="requirements-success">✓ All requirements met!</div>';
    }
  }

  // Check for suspicious patterns in input
  static detectSuspiciousInput(input) {
    if (typeof input !== 'string') return false;
    
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<link[^>]*>.*?<\/link>/gi,
      /<meta[^>]*>.*?<\/meta>/gi,
      /<style[^>]*>.*?<\/style>/gi,
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /@import/gi
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  // Sanitize user input for display
  static sanitizeForDisplay(input) {
    if (typeof input !== 'string') return input;
    
    // Check for suspicious patterns first
    if (this.detectSuspiciousInput(input)) {
      console.warn('Suspicious input detected and sanitized:', input);
      return this.sanitizeText(input);
    }
    
    return this.escapeHTML(input);
  }

  // Validate URL
  static validateURL(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // Secure localStorage operations
  static secureStorage = {
    setItem(key, value) {
      try {
        const sanitizedKey = SecurityUtils.sanitizeText(key);
        const sanitizedValue = SecurityUtils.sanitizeText(JSON.stringify(value));
        localStorage.setItem(sanitizedKey, sanitizedValue);
      } catch (error) {
        console.error('Error storing data securely:', error);
      }
    },
    
    getItem(key) {
      try {
        const sanitizedKey = SecurityUtils.sanitizeText(key);
        const value = localStorage.getItem(sanitizedKey);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('Error retrieving data securely:', error);
        return null;
      }
    },
    
    removeItem(key) {
      try {
        const sanitizedKey = SecurityUtils.sanitizeText(key);
        localStorage.removeItem(sanitizedKey);
      } catch (error) {
        console.error('Error removing data securely:', error);
      }
    }
  };
}

// Auto-sanitize form inputs on page load
document.addEventListener('DOMContentLoaded', function() {
  // Add input event listeners to sanitize inputs in real-time
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
  
  textInputs.forEach(input => {
    input.addEventListener('input', function() {
      const originalValue = this.value;
      const sanitizedValue = SecurityUtils.sanitizeFormInput(originalValue, this.type);
      
      if (originalValue !== sanitizedValue) {
        this.value = sanitizedValue;
        console.warn('Input sanitized:', originalValue, '->', sanitizedValue);
      }
    });
  });

  // Add form submission protection
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const inputs = this.querySelectorAll('input, textarea, select');
      let hasSuspiciousInput = false;
      
      inputs.forEach(input => {
        if (SecurityUtils.detectSuspiciousInput(input.value)) {
          hasSuspiciousInput = true;
          console.warn('Suspicious input detected in form:', input.name, input.value);
        }
      });
      
      if (hasSuspiciousInput) {
        e.preventDefault();
        alert('Suspicious input detected. Please check your input and try again.');
        return false;
      }
    });
  });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecurityUtils;
} else {
  window.SecurityUtils = SecurityUtils;
}
