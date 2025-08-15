// shared by login.html & register.html
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const API = path => `https://yourbackend.com/api${path}`;

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const body = { email: fd.get('email'), password: fd.get('password') };
    const res = await fetch(API('/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      location.href = 'dashboard.html';
    } else {
      alert(data.message || 'Login failed');
    }
  });
}

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
    const res = await fetch(API('/register'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      location.href = 'dashboard.html';
    } else {
      alert(data.message || 'Registration failed');
    }
  });
}