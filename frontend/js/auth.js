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
      
      // Update navigation UI if available
      if (window.sessionManager) {
        window.sessionManager.updateNavigationUI();
      }
      
      location.href = 'dashboard.html';
    } else {
      showError(data.message || 'Google authentication failed');
    }
  } catch (error) {
    console.error('Google auth error:', error);
    showError('Network error during Google authentication');
  }
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
          
          // Update navigation UI if available
          if (window.sessionManager) {
            window.sessionManager.updateNavigationUI();
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
    
    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
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
                console.error('Resend error:', error);
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
          console.error('Success message element not found, using fallback');
          // Fallback if success message element not found
          showSuccess(data.message);
          setTimeout(() => {
            location.href = 'login.html';
          }, 3000);
        }
      } else {
        console.error('Registration failed:', data.message);
        showError(data.message || 'Registration failed');
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    } catch (error) {
      console.error('Registration error:', error);
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
      console.warn('Google Auth initialization failed:', error);
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
