const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');
if (!accessToken || !refreshToken) location.href = 'login.html';

const logoutBtn = document.getElementById('logout');
logoutBtn && logoutBtn.addEventListener('click', async () => {
  if (window.sessionManager) {
    await window.sessionManager.logout();
  } else {
    localStorage.clear();
    location.href = 'index.html';
  }
});

// Populate profile
const loadProfile = async () => {
  // Hide any existing error messages
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) errorMessage.style.display = 'none';
  
  try {
    // Load both profile and usage information
    const [profileRes, usageRes] = await Promise.all([
      fetch('https://json4ai.onrender.com/api/user/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      fetch('https://json4ai.onrender.com/api/user/usage', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ]);
    
    if (!profileRes.ok || !usageRes.ok) {
      if (profileRes.status === 401 || usageRes.status === 401) {
        // Token expired or invalid
        localStorage.clear();
        location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load profile or usage information');
    }
    
    const user = await profileRes.json();
    const usage = await usageRes.json();
    
    const first = document.getElementById('firstName');
    const last  = document.getElementById('lastName');
    const email = document.getElementById('email');
    const planBadge = document.getElementById('plan-badge');
    const planDescription = document.getElementById('plan-description');
    const usageProgress = document.getElementById('usage-progress');
    const usageText = document.getElementById('usage-text');
    const planFeaturesList = document.getElementById('plan-features-list');
    const dashboardSubtitle = document.getElementById('dashboard-subtitle');
    
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
    
    // Update dashboard subtitle
    if (dashboardSubtitle) {
      dashboardSubtitle.textContent = `Welcome back, ${user.firstName}! You're on the ${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan.`;
    }
    
    // Update plan information
    if (planBadge) {
      planBadge.textContent = user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free';
      planBadge.className = `plan-badge plan-${user.plan || 'free'}`;
    }
    
    if (planDescription) {
      const descriptions = {
        free: '3 prompts per day',
        starter: '30 prompts per day',
        premium: 'Unlimited prompts'
      };
      planDescription.textContent = descriptions[user.plan] || descriptions.free;
    }
    
    // Update usage information
    if (usageProgress && usageText) {
      const dailyLimit = usage.dailyLimit || 3;
      const remainingCredits = usage.remainingCredits || 0;
      
      if (user.plan === 'premium') {
        usageProgress.style.width = '100%';
        usageProgress.style.backgroundColor = '#10b981';
        usageText.textContent = 'Unlimited access - No daily limits';
      } else {
        const used = dailyLimit - remainingCredits;
        const percentage = Math.min((used / dailyLimit) * 100, 100);
        usageProgress.style.width = `${percentage}%`;
        usageProgress.style.backgroundColor = percentage > 80 ? '#ef4444' : percentage > 60 ? '#f59e0b' : '#10b981';
        usageText.textContent = `${used} of ${dailyLimit} prompts used today (${remainingCredits} remaining)`;
      }
    }
    
    // Update credit status display
    const creditBadge = document.getElementById('credit-badge');
    const creditText = document.getElementById('credit-text');
    
    if (creditBadge && creditText) {
      if (user.plan === 'premium') {
        creditBadge.textContent = 'Unlimited';
        creditBadge.className = 'credit-badge credit-unlimited';
        creditText.textContent = 'You have unlimited access to JSON prompt generation.';
      } else {
        creditBadge.textContent = `${usage.remainingCredits} Credits`;
        creditBadge.className = `credit-badge credit-${usage.remainingCredits > 0 ? 'available' : 'depleted'}`;
        creditText.textContent = `You have ${usage.remainingCredits} credits remaining today.`;
      }
    }
    
    // Update plan features
    if (planFeaturesList) {
      const features = {
        free: [
          '3 prompts per day',
          'Basic JSON templates',
          'Community support',
          'Standard response time'
        ],
        starter: [
          '30 prompts per day',
          'Advanced JSON templates',
          'Priority support',
          'Faster response time',
          'Custom prompt history'
        ],
        premium: [
          'Unlimited prompts',
          'All JSON templates',
          'Premium support',
          'Fastest response time',
          'Full prompt history',
          'API access',
          'Custom integrations'
        ]
      };
      
      const currentFeatures = features[user.plan] || features.free;
      planFeaturesList.innerHTML = currentFeatures.map(feature => `<li>${feature}</li>`).join('');
    }
    
    // Enable the update button
    const updateBtn = document.querySelector('#profile-form button[type="submit"]');
    if (updateBtn) updateBtn.disabled = false;
    
    // Update dashboard subtitle
    const subtitle = document.getElementById('dashboard-subtitle');
    if (subtitle) subtitle.textContent = `Welcome back, ${user.firstName || 'User'}! Manage your profile, view usage, and upgrade your plan`;
    
    console.log('Profile loaded successfully:', user);
    
    // Load recent activity
    loadRecentActivity();
    
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

// Load recent activity
const loadRecentActivity = async () => {
  try {
    const res = await fetch('https://json4ai.onrender.com/api/prompt/history', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!res.ok) {
      console.error('Failed to load activity history');
      return;
    }
    
    const prompts = await res.json();
    const activityList = document.getElementById('activity-list');
    
    if (activityList && prompts.length > 0) {
      activityList.innerHTML = prompts.slice(0, 5).map(prompt => `
        <div class="activity-item">
          <div class="activity-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
          <div class="activity-content">
            <h4>Prompt Generated</h4>
            <p>${prompt.comment || 'JSON prompt generated'}</p>
            <span class="activity-time">${formatTimeAgo(new Date(prompt.createdAt))}</span>
          </div>
        </div>
      `).join('');
    } else if (activityList) {
      activityList.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
          <div class="activity-content">
            <h4>No Activity Yet</h4>
            <p>Start generating prompts to see your activity here</p>
            <span class="activity-time">Just now</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading activity:', error);
  }
};

// Format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
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
              headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}` },
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
    
    // Reload profile to get updated information
    loadProfile();
    
  } catch (error) {
    console.error('Error updating profile:', error);
    showError('Failed to update profile. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});