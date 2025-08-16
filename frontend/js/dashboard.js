const token = localStorage.getItem('token');
if (!token) location.href = 'login.html';

const logoutBtn = document.getElementById('logout');
logoutBtn && logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  location.href = 'index.html';
});

// Populate profile
const loadProfile = async () => {
  // Hide any existing error messages
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) errorMessage.style.display = 'none';
  
  try {
    const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid
        localStorage.clear();
        location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load profile');
    }
    
    const user = await res.json();
    
    const first = document.getElementById('firstName');
    const last  = document.getElementById('lastName');
    const email = document.getElementById('email');
    const plan  = document.getElementById('plan');
    
    if (first) {
      first.value = user.firstName || '';
      first.disabled = false;
      first.placeholder = 'Enter your first name';
    }
    if (last) {
      last.value = user.lastName || '';
      last.disabled = false;
      last.placeholder = 'Enter your last name';
    }
    if (email) {
      email.value = user.email || '';
      email.placeholder = 'your@email.com';
    }
    if (plan) plan.textContent = user.plan || 'Free';
    
    // Enable the update button
    const updateBtn = document.querySelector('#profile-form button[type="submit"]');
    if (updateBtn) updateBtn.disabled = false;
    
    // Update dashboard subtitle
    const subtitle = document.getElementById('dashboard-subtitle');
    if (subtitle) subtitle.textContent = `Welcome back, ${user.firstName || 'User'}! Manage your profile, view usage, and upgrade your plan`;
    
    console.log('Profile loaded successfully:', user);
  } catch (error) {
    console.error('Error loading profile:', error);
    
    // Show error message
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorMessage && errorText) {
      errorText.textContent = error.message || 'Failed to load profile. Please refresh the page.';
      errorMessage.style.display = 'block';
            } else {
          showError('Failed to load profile. Please refresh the page.');
        }
  }
};

// Load profile when page loads
loadProfile();

// Update profile
document.getElementById('profile-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    const body = {
      firstName: document.getElementById('firstName').value,
      lastName:  document.getElementById('lastName').value
    };
    
    const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.clear();
        location.href = 'login.html';
        return;
      }
      throw new Error('Failed to update profile');
    }
    
            showSuccess('Profile updated successfully!');
      } catch (error) {
        console.error('Error updating profile:', error);
        showError('Failed to update profile. Please try again.');
      } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});