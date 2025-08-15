const token = localStorage.getItem('token');
if (!token) location.href = 'login.html';

const logoutBtn = document.getElementById('logout');
logoutBtn && logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  location.href = 'index.html';
});

// Populate profile
fetch('https://json4ai.onrender.com/api/user/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
})
  .then(r => r.ok ? r.json() : Promise.reject(r))
  .then(user => {
    const first = document.getElementById('firstName');
    const last  = document.getElementById('lastName');
    const email = document.getElementById('email');
    const plan  = document.getElementById('plan');
    if (first) first.value = user.firstName || '';
    if (last)  last.value  = user.lastName  || '';
    if (email) email.value = user.email     || '';
    if (plan)  plan.textContent = user.plan || 'Free';
  })
  .catch(() => { /* optionally surface error UI */ });

// Update profile
document.getElementById('profile-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    firstName: document.getElementById('firstName').value,
    lastName:  document.getElementById('lastName').value
  };
  const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  alert(res.ok ? 'Saved' : 'Error');
});