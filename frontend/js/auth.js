// shared by login.html & register.html
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const API = path => `https://json4ai.onrender.com/api${path}`;

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
        localStorage.setItem('token', data.token);
        location.href = 'dashboard.html';
      } else {
        if (data.message === 'Please verify your email') {
          // Show resend verification section
          verificationSection.style.display = 'block';
        }
        alert(data.message || 'Login failed');
      }
    } catch (_) {
      alert('Network error. Please try again.');
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
          alert(data.message);
          verificationSection.style.display = 'none';
        } else {
          alert(data.message || 'Failed to resend verification email');
        }
      } catch (_) {
        alert('Network error. Please try again.');
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
      alert('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    
    const fd = new FormData(registerForm);
    const body = {
      firstName: fd.get('firstName'),
      lastName:  fd.get('lastName'),
      email:     fd.get('email'),
      password:  fd.get('password')
    };
    
    try {
      const res = await fetch(API('/register'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        // Show success message
        const form = document.getElementById('register-form');
        const successMessage = document.getElementById('success-message');
        if (form && successMessage) {
          form.style.display = 'none';
          successMessage.style.display = 'block';
        } else {
          // Fallback to alert and redirect
          alert(data.message);
          location.href = 'login.html';
        }
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (_) {
      alert('Network error. Please try again.');
    }
  });
}