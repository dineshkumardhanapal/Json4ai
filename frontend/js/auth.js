// shared by login.html & register.html
const registerForm = document.getElementById('register-form');
const API = path => 'https://json4ai.onrender.com/api' + path;

if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    const body = {
      firstName: fd.get('firstName'),
      lastName:  fd.get('lastName'),
      email:     fd.get('email'),
      password:  fd.get('password')
    };

    try {
      const res = await fetch(API('/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        // Hide form, show message
        registerForm.style.display = 'none';
        document.getElementById('success-message').style.display = 'block';
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (_) {
      alert('Network error. Please try again.');
    }
  });
}