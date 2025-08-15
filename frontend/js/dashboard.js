const token = localStorage.getItem('token');
if (!token) location.href = 'login.html';

const logoutBtn = document.getElementById('logout');
logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  location.href = 'index.html';
});

// Populate profile
fetch('https://yourbackend.com/api/user/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
})
  .then(r => r.json())
  .then(user => {
    document.getElementById('firstName').value = user.firstName;
    document.getElementById('lastName').value  = user.lastName;
    document.getElementById('email').value     = user.email;
    document.getElementById('plan').textContent = user.plan || 'Free';
  });

// Update profile
document.getElementById('profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    firstName: document.getElementById('firstName').value,
    lastName:  document.getElementById('lastName').value
  };
  const res = await fetch('https://yourbackend.com/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  alert(res.ok ? 'Saved' : 'Error');
});