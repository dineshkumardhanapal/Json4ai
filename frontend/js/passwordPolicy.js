// Enhanced Password Policy Frontend Implementation
// Note: API function is already declared in auth.js

class PasswordPolicyManager {
  constructor() {
    this.policy = null;
    this.strengthIndicator = null;
    this.validationResults = null;
  }
  
  // Initialize password policy manager
  async init() {
    try {
      await this.loadPasswordPolicy();
      this.setupEventListeners();
      this.createPasswordStrengthIndicator();
    } catch (error) {
      console.error('Password policy initialization failed:', error);
    }
  }
  
  // Load password policy from server
  async loadPasswordPolicy() {
    try {
      const response = await fetch(API('/password-policy'));
      if (response.ok) {
        this.policy = await response.json();
        console.log('Password policy loaded:', this.policy);
      } else {
        console.warn('Failed to load password policy, using defaults');
        this.setDefaultPolicy();
      }
    } catch (error) {
      console.error('Error loading password policy:', error);
      this.setDefaultPolicy();
    }
  }
  
  // Set default policy if server policy fails to load
  setDefaultPolicy() {
    this.policy = {
      policy: {
        minLength: 12,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        minUppercase: 2,
        minLowercase: 2,
        minNumbers: 2,
        minSpecialChars: 2,
        allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        passwordExpiryDays: 90,
        passwordHistoryCount: 12
      },
      requirements: [
        'Minimum 12 characters',
        'At least 2 uppercase letters',
        'At least 2 lowercase letters',
        'At least 2 numbers',
        'At least 2 special characters',
        'No common words or patterns',
        'No personal information',
        'No sequential characters',
        'No repeated characters',
        'Expires every 90 days'
      ]
    };
  }
  
  // Setup event listeners for password inputs
  setupEventListeners() {
    // Find all password inputs
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
      // Add real-time validation
      input.addEventListener('input', (e) => {
        this.validatePasswordRealTime(e.target.value, e.target);
      });
      
      // Add focus/blur events
      input.addEventListener('focus', (e) => {
        this.showPasswordRequirements(e.target);
      });
      
      input.addEventListener('blur', (e) => {
        this.hidePasswordRequirements(e.target);
      });
    });
    
    // Setup password generation buttons
    this.setupPasswordGenerationButtons();
  }
  
  // Create password strength indicator
  createPasswordStrengthIndicator() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
      if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('password-strength-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'password-strength-indicator';
        indicator.innerHTML = `
          <div class="strength-bar">
            <div class="strength-fill"></div>
          </div>
          <div class="strength-text"></div>
          <div class="strength-requirements"></div>
          <div class="policy-compliance"></div>
        `;
        
        input.parentNode.insertBefore(indicator, input.nextSibling);
      }
    });
  }
  
  // Real-time password validation
  async validatePasswordRealTime(password, inputElement) {
    if (!password) {
      this.clearPasswordIndicator(inputElement);
      return;
    }
    
    try {
      // Get user info if available
      const userInfo = this.getUserInfo();
      
      const response = await fetch(API('/check-password-strength'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: password,
          userInfo: userInfo
        })
      });
      
      if (response.ok) {
        const validation = await response.json();
        this.updatePasswordIndicator(inputElement, validation);
        this.validationResults = validation;
      } else {
        // Fallback to client-side validation
        const validation = this.validatePasswordClientSide(password);
        this.updatePasswordIndicator(inputElement, validation);
        this.validationResults = validation;
      }
    } catch (error) {
      console.error('Password validation error:', error);
      // Fallback to client-side validation
      const validation = this.validatePasswordClientSide(password);
      this.updatePasswordIndicator(inputElement, validation);
      this.validationResults = validation;
    }
  }
  
  // Client-side password validation fallback
  validatePasswordClientSide(password) {
    const errors = [];
    const warnings = [];
    let strength = 0;
    
    if (!this.policy) {
      this.setDefaultPolicy();
    }
    
    const policy = this.policy.policy;
    
    // Length validation
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }
    
    if (password.length > policy.maxLength) {
      errors.push(`Password must be no more than ${policy.maxLength} characters long`);
    }
    
    // Character requirements
    const upperCount = (password.match(/[A-Z]/g) || []).length;
    const lowerCount = (password.match(/[a-z]/g) || []).length;
    const numberCount = (password.match(/\d/g) || []).length;
    const specialCount = (password.match(new RegExp(`[${policy.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g')) || []).length;
    
    if (policy.requireUppercase && upperCount < policy.minUppercase) {
      errors.push(`Password must contain at least ${policy.minUppercase} uppercase letters`);
    }
    
    if (policy.requireLowercase && lowerCount < policy.minLowercase) {
      errors.push(`Password must contain at least ${policy.minLowercase} lowercase letters`);
    }
    
    if (policy.requireNumbers && numberCount < policy.minNumbers) {
      errors.push(`Password must contain at least ${policy.minNumbers} numbers`);
    }
    
    if (policy.requireSpecialChars && specialCount < policy.minSpecialChars) {
      errors.push(`Password must contain at least ${policy.minSpecialChars} special characters`);
    }
    
    // Calculate strength
    strength = this.calculatePasswordStrength(password, policy);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      strength,
      strengthLevel: strength >= 80 ? 'strong' : 
                    strength >= 60 ? 'medium' : 
                    strength >= 40 ? 'weak' : 'very weak'
    };
  }
  
  // Calculate password strength
  calculatePasswordStrength(password, policy) {
    let score = 0;
    
    // Length score (0-30 points)
    if (password.length >= policy.minLength) score += 15;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;
    
    // Character variety score (0-40 points)
    const upperCount = (password.match(/[A-Z]/g) || []).length;
    const lowerCount = (password.match(/[a-z]/g) || []).length;
    const numberCount = (password.match(/\d/g) || []).length;
    const specialCount = (password.match(new RegExp(`[${policy.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g')) || []).length;
    
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
  
  // Update password strength indicator
  updatePasswordIndicator(inputElement, validation) {
    const indicator = inputElement.nextElementSibling;
    if (!indicator || !indicator.classList.contains('password-strength-indicator')) {
      return;
    }
    
    const strengthFill = indicator.querySelector('.strength-fill');
    const strengthText = indicator.querySelector('.strength-text');
    const strengthRequirements = indicator.querySelector('.strength-requirements');
    const policyCompliance = indicator.querySelector('.policy-compliance');
    
    // Update strength bar
    strengthFill.style.width = `${validation.strength}%`;
    strengthFill.className = `strength-fill strength-${validation.strengthLevel}`;
    
    // Update strength text
    strengthText.textContent = `Password strength: ${validation.strengthLevel} (${validation.strength}%)`;
    strengthText.className = `strength-text strength-${validation.strengthLevel}`;
    
    // Update requirements
    if (validation.errors && validation.errors.length > 0) {
      strengthRequirements.innerHTML = `
        <div class="requirements-title">Requirements:</div>
        <ul class="requirements-list">
          ${validation.errors.map(error => `<li class="requirement-item">${error}</li>`).join('')}
        </ul>
      `;
    } else {
      strengthRequirements.innerHTML = '<div class="requirements-success">✓ All requirements met!</div>';
    }
    
    // Update policy compliance
    if (this.policy && this.policy.requirements) {
      policyCompliance.innerHTML = `
        <div class="policy-title">Policy Requirements:</div>
        <ul class="policy-list">
          ${this.policy.requirements.map(req => `<li class="policy-item">${req}</li>`).join('')}
        </ul>
      `;
    }
  }
  
  // Clear password indicator
  clearPasswordIndicator(inputElement) {
    const indicator = inputElement.nextElementSibling;
    if (!indicator || !indicator.classList.contains('password-strength-indicator')) {
      return;
    }
    
    const strengthFill = indicator.querySelector('.strength-fill');
    const strengthText = indicator.querySelector('.strength-text');
    const strengthRequirements = indicator.querySelector('.strength-requirements');
    const policyCompliance = indicator.querySelector('.policy-compliance');
    
    strengthFill.style.width = '0%';
    strengthFill.className = 'strength-fill';
    strengthText.textContent = '';
    strengthText.className = 'strength-text';
    strengthRequirements.innerHTML = '';
    policyCompliance.innerHTML = '';
  }
  
  // Show password requirements
  showPasswordRequirements(inputElement) {
    const indicator = inputElement.nextElementSibling;
    if (indicator && indicator.classList.contains('password-strength-indicator')) {
      indicator.style.display = 'block';
    }
  }
  
  // Hide password requirements
  hidePasswordRequirements(inputElement) {
    const indicator = inputElement.nextElementSibling;
    if (indicator && indicator.classList.contains('password-strength-indicator')) {
      // Keep indicator visible if there are validation errors
      if (!this.validationResults || this.validationResults.isValid) {
        indicator.style.display = 'none';
      }
    }
  }
  
  // Setup password generation buttons
  setupPasswordGenerationButtons() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
      if (!input.nextElementSibling || !input.nextElementSibling.querySelector('.generate-password-btn')) {
        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'generate-password-btn';
        generateBtn.textContent = 'Generate Secure Password';
        
        generateBtn.addEventListener('click', async () => {
          await this.generateSecurePassword(input);
        });
        
        input.parentNode.insertBefore(generateBtn, input.nextSibling);
      }
    });
  }
  
  // Generate secure password
  async generateSecurePassword(inputElement) {
    try {
      const response = await fetch(API('/generate-secure-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          length: 16
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        inputElement.value = result.password;
        
        // Trigger validation
        inputElement.dispatchEvent(new Event('input'));
        
        // Show success message
        this.showPasswordGeneratedMessage(inputElement, result.password);
      } else {
        throw new Error('Failed to generate password');
      }
    } catch (error) {
      console.error('Password generation error:', error);
      this.showErrorMessage(inputElement, 'Failed to generate secure password');
    }
  }
  
  // Show password generated message
  showPasswordGeneratedMessage(inputElement, password) {
    const message = document.createElement('div');
    message.className = 'password-generated-message';
    message.innerHTML = `
      <div class="message-content">
        <h4>Secure Password Generated!</h4>
        <p>Password: <code>${password}</code></p>
        <p><strong>Please save this password securely!</strong></p>
        <button type="button" class="copy-password-btn">Copy Password</button>
      </div>
    `;
    
    // Add copy functionality
    const copyBtn = message.querySelector('.copy-password-btn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(password).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Password';
        }, 2000);
      });
    });
    
    inputElement.parentNode.insertBefore(message, inputElement.nextSibling);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 10000);
  }
  
  // Show error message
  showErrorMessage(inputElement, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'password-error-message';
    errorDiv.textContent = message;
    
    inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
  
  // Get user info for validation
  getUserInfo() {
    // Try to get user info from various sources
    const userInfo = {};
    
    // Check if user info is available in global scope
    if (window.userInfo) {
      return window.userInfo;
    }
    
    // Check form fields
    const firstNameField = document.querySelector('input[name="firstName"]');
    const lastNameField = document.querySelector('input[name="lastName"]');
    const emailField = document.querySelector('input[name="email"]');
    
    if (firstNameField) userInfo.firstName = firstNameField.value;
    if (lastNameField) userInfo.lastName = lastNameField.value;
    if (emailField) userInfo.email = emailField.value;
    
    return userInfo;
  }
  
  // Validate form submission
  validateFormSubmission(form) {
    const passwordInputs = form.querySelectorAll('input[type="password"]');
    let isValid = true;
    const errors = [];
    
    passwordInputs.forEach(input => {
      if (this.validationResults && !this.validationResults.isValid) {
        isValid = false;
        errors.push(...this.validationResults.errors);
      }
    });
    
    if (!isValid) {
      this.showFormErrors(form, errors);
    }
    
    return isValid;
  }
  
  // Show form errors
  showFormErrors(form, errors) {
    // Remove existing error messages
    const existingErrors = form.querySelectorAll('.form-error-message');
    existingErrors.forEach(error => error.remove());
    
    // Add new error messages
    const errorContainer = document.createElement('div');
    errorContainer.className = 'form-error-message';
    errorContainer.innerHTML = `
      <h4>Password Requirements Not Met:</h4>
      <ul>
        ${errors.map(error => `<li>${error}</li>`).join('')}
      </ul>
    `;
    
    form.insertBefore(errorContainer, form.firstChild);
    
    // Scroll to error
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  // Get current validation results
  getValidationResults() {
    return this.validationResults;
  }
  
  // Check if password meets policy
  meetsPolicy(password) {
    if (!this.validationResults) {
      return false;
    }
    
    return this.validationResults.isValid && this.validationResults.strength >= 60;
  }
}

// Initialize password policy manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.passwordPolicyManager = new PasswordPolicyManager();
  window.passwordPolicyManager.init();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PasswordPolicyManager;
}
