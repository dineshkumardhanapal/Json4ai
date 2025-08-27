// shared by login.html & register.html
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const API = path => `https://json4ai.onrender.com/api${path}`;

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
        alert('Please enter your email first');
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
          showSuccess(data.message);
          verificationSection.style.display = 'none';
        } else {
          showError(data.message || 'Failed to resend verification email');
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
    const body = {
      firstName: fd.get('firstName'),
      lastName:  fd.get('lastName'),
      email:     fd.get('email'),
      password:  fd.get('password')
    };
    
    // Registration data prepared
    
    try {
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';
      
      const res = await fetch(API('/register'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      
      console.log('Registration response:', { status: res.status, data });
      
      if (res.ok) {
        // Hide the form and show success message
        console.log('Registration successful, hiding form and showing success message');
        registerForm.style.display = 'none';
        
        if (successMessage) {
          successMessage.style.display = 'block';
          // Scroll to top to show the success message
          window.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('Success message displayed');
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