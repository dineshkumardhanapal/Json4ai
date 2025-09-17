// shared by login.html & register.html
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const API = path => `https://json4ai.onrender.com/api${path}`;

// Google OAuth Configuration
// Google OAuth Configuration - Update this with your actual Client ID
const GOOGLE_CLIENT_ID = '733569001730-13r9etrbf22uf2nmrjj1upqp5o4nm1uu.apps.googleusercontent.com'; // Replace with your actual Google Client ID

// Initialize Google Sign-In
function initializeGoogleAuth() {
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn
    });
  }
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
  try {
    const res = await fetch(API('/auth/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: response.credential })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      // Update session manager with new tokens
      if (window.sessionManager) {
        window.sessionManager.refreshTokensFromStorage();
        // Wait a moment for the session manager to update
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      location.href = 'dashboard.html';
    } else {
      showError(data.message || 'Google authentication failed');
    }
    } catch (error) {
      showError('Network error during Google authentication');
  }
}

// Initialize Google OAuth when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Google API to load
  const initGoogleAuth = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      initializeGoogleAuth();
      setupGoogleButton();
    } else {
      // Retry after a short delay
      setTimeout(initGoogleAuth, 100);
    }
  };
  
  initGoogleAuth();
});

// Setup Google Sign-In/Sign-Up buttons
function setupGoogleButton() {
  // Handle login page button
  const googleSignInBtn = document.getElementById('google-signin');
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', function() {
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
      } else {
        showError('Google Sign-In is not available. Please try again.');
      }
    });
  }
  
  // Handle register page button
  const googleSignUpBtn = document.getElementById('google-signup');
  if (googleSignUpBtn) {
    googleSignUpBtn.addEventListener('click', function() {
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
      } else {
        showError('Google Sign-Up is not available. Please try again.');
      }
    });
  }
}

// Password validation function for form submission
function validatePasswordForSubmission(password) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: []
  };
  
  // Check minimum length
  if (password.length < 8) {
    validation.isValid = false;
    validation.errors.push('Password must be at least 8 characters long');
  }
  
  // Check maximum length
  if (password.length > 128) {
    validation.isValid = false;
    validation.errors.push('Password cannot exceed 128 characters');
  }
  
  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    validation.isValid = false;
    validation.errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    validation.isValid = false;
    validation.errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check for numbers
  if (!/[0-9]/.test(password)) {
    validation.isValid = false;
    validation.errors.push('Password must contain at least one number');
  }
  
  // Check for consecutive repeated characters (max 2)
  if (/(.)\1{2,}/.test(password)) {
    validation.isValid = false;
    validation.errors.push('Password cannot contain more than 2 consecutive repeated characters');
  }
  
  // Check for sequential characters (max 3)
  if (/123|234|345|456|567|678|789|012|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm/i.test(password)) {
    validation.isValid = false;
    validation.errors.push('Password cannot contain sequential characters (like abc, 123)');
  }
  
  // Check for common words
  const commonWords = ['password', 'admin', 'user', 'login', 'welcome', 'hello', 'test', 'demo', 'sample', 'guest', 'public', 'private', 'secret', 'key', 'code', 'name', 'email', 'phone', 'address'];
  const lowerPassword = password.toLowerCase();
  for (const word of commonWords) {
    if (lowerPassword.includes(word)) {
      validation.isValid = false;
      validation.errors.push(`Password cannot contain common words like "${word}"`);
      break;
    }
  }
  
  // Check for keyboard patterns
  const keyboardPatterns = ['qwerty', 'asdf', 'zxcv', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const pattern of keyboardPatterns) {
    if (lowerPassword.includes(pattern)) {
      validation.isValid = false;
      validation.errors.push(`Password cannot contain keyboard patterns like "${pattern}"`);
      break;
    }
  }
  
  // Check minimum unique characters (8)
  const uniqueChars = new Set(password).size;
  if (uniqueChars < 8) {
    validation.isValid = false;
    validation.errors.push('Password must contain at least 8 unique characters');
  }
  
  return validation;
}

// Auth.js loaded

if (loginForm) {
  const verificationSection = document.querySelector('.verification-section');
  const resendBtn = document.getElementById('resend-verification');
  let currentEmail = '';
  
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const body = { email: fd.get('email'), password: fd.get('password') };
    currentEmail = fd.get('email');
    
    try {
      const res = await fetch(API('/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
              if (res.ok) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('userData', JSON.stringify(data.user));
          
          // Update session manager with new tokens
          if (window.sessionManager) {
            window.sessionManager.refreshTokensFromStorage();
            // Wait longer for the session manager to fully update
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify session manager is properly updated
            if (!window.sessionManager.isLoggedIn()) {
              showError('Authentication system error. Please try again.');
              return;
            }
          }
          
          location.href = 'dashboard.html';
        } else {
          if (data.message === 'Please verify your email') {
            // Show resend verification section
            verificationSection.style.display = 'block';
          }
          showError(data.message || 'Login failed');
        }
      } catch (_) {
        showError('Network error. Please try again.');
      }
  });
  
  // Handle resend verification
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      if (!currentEmail) {
        showNotification('Please enter your email first', 'warning');
        return;
      }
      
      try {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';
        
        const res = await fetch(API('/resend-verification'), { 
          method:'POST', 
          headers:{'Content-Type':'application/json'}, 
          body:JSON.stringify({ email: currentEmail }) 
        });
        const data = await res.json();
        
        if (res.ok) {
          showSuccess('Verification email sent! Please check your inbox and spam folder.');
          verificationSection.style.display = 'none';
        } else {
          showError(data.message || 'Failed to resend verification email. Please try again.');
        }
      } catch (_) {
        showError('Network error. Please try again.');
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Verification Email';
      }
    });
  }
}

if (registerForm) {
  const termsCheckbox = document.getElementById('terms');
  const submitBtn = document.getElementById('submit-btn');
  const successMessage = document.getElementById('success-message');
  
  // Register form elements found
  
  // Enable/disable submit button based on terms checkbox
  if (termsCheckbox && submitBtn) {
    termsCheckbox.addEventListener('change', () => {
      submitBtn.disabled = !termsCheckbox.checked;
    });
  }
  
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    
    // Check if terms are accepted
    if (!termsCheckbox.checked) {
      showError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    
    const fd = new FormData(registerForm);
    
    // Basic form validation
    const firstName = fd.get('firstName')?.trim();
    const lastName = fd.get('lastName')?.trim();
    const email = fd.get('email')?.trim();
    const password = fd.get('password');
    
    if (!firstName || !lastName || !email || !password) {
      showError('Please fill in all required fields.');
      return;
    }
    
    // Comprehensive password validation using the same logic as the real-time validator
    const passwordValidation = validatePasswordForSubmission(password);
    if (!passwordValidation.isValid) {
      showError(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      showError('Please enter a valid email address.');
      return;
    }
    
    const body = {
      firstName: firstName,
      lastName:  lastName,
      email:     email,
      password:  password
    };
    
    // Registration data prepared
    
    try {
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';
      
      const res = await fetch(API('/register'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      
      
      if (res.ok) {
        // Hide the form and show success message
        registerForm.style.display = 'none';
        
        if (successMessage) {
          successMessage.style.display = 'block';
          // Scroll to top to show the success message
          window.scrollTo({ top: 0, behavior: 'smooth' });
          
          // Add a note about email delivery
          const emailNote = document.createElement('div');
          emailNote.style.cssText = `
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: var(--radius-sm);
            font-size: 0.9rem;
            color: var(--text-secondary);
          `;
          emailNote.innerHTML = `
            <strong>📧 Email Delivery Note:</strong><br>
            If you don't receive the verification email within 5 minutes, please check your spam folder or contact support.
          `;
          successMessage.appendChild(emailNote);
          
          // Add resend email functionality
          const resendBtn = document.getElementById('resend-verification-btn');
          if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
              try {
                resendBtn.disabled = true;
                resendBtn.innerHTML = `
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 0.5rem;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Sending...
                `;
                
                const res = await fetch(API('/resend-verification'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: email })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                  showSuccess('Verification email sent! Please check your inbox.');
                } else {
                  showError(data.message || 'Failed to resend verification email');
                }
              } catch (error) {
                showError('Network error. Please try again.');
              } finally {
                resendBtn.disabled = false;
                resendBtn.innerHTML = `
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 0.5rem;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Resend Email
                `;
              }
            });
          }
        } else {
          // Fallback if success message element not found
          showSuccess(data.message);
          setTimeout(() => {
            location.href = 'login.html';
          }, 3000);
        }
      } else {
        // Handle validation errors with detailed messages
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join('\n');
          showError(`Validation failed:\n${errorMessages}`);
        } else if (data.message) {
          showError(data.message);
        } else {
          showError('Registration failed. Please check your information and try again.');
        }
        
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    } catch (error) {
      showError('Network error. Please try again.');
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}

// Initialize Google Auth when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Google Auth with better error handling
  setTimeout(() => {
    try {
      initializeGoogleAuth();
    } catch (error) {
      // Google Auth initialization failed silently
    }
  }, 1000); // Delay to ensure Google SDK is loaded
  
  // Handle Google Sign-In button clicks
  const googleSignInBtn = document.getElementById('google-signin');
  const googleSignUpBtn = document.getElementById('google-signup');
  
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', function() {
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
      } else {
        showError('Google Sign-In is not available. Please try again later.');
      }
    });
  }
  
  if (googleSignUpBtn) {
    googleSignUpBtn.addEventListener('click', function() {
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
      } else {
        showError('Google Sign-Up is not available. Please try again later.');
      }
    });
  }
});
