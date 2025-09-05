// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication using session manager - wait for session manager to initialize
  setTimeout(() => {
    if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
      location.href = 'login.html';
      return;
    }
    
    // Initialize loading spinner
    addLoadingSpinner();
    
    // Load profile data
    loadProfile();
  }, 100);

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Logout button clicked');
      
      if (window.sessionManager) {
        await window.sessionManager.logout();
      } else {
        localStorage.clear();
        location.href = 'index.html';
      }
    });
  }
});

// Populate profile
const loadProfile = async () => {
  console.log('🔄 Starting to load profile...');
  
  // Hide any existing error messages
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) errorMessage.style.display = 'none';
  
  // Show loading state
  showLoadingState();
  
  try {
    console.log('📡 Fetching profile and usage data...');
    
    // Load both profile and usage information in parallel with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Get current token from session manager
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      console.log('🔒 No access token available, redirecting to login...');
      location.href = 'login.html';
      return;
    }
    
    const [profileRes, usageRes] = await Promise.all([
      fetch('https://json4ai.onrender.com/api/user/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: controller.signal
      }),
      fetch('https://json4ai.onrender.com/api/user/usage', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: controller.signal
      })
    ]);
    
    clearTimeout(timeoutId);
    
    console.log('📊 API responses received:', {
      profileStatus: profileRes.status,
      usageStatus: usageRes.status,
      profileOk: profileRes.ok,
      usageOk: usageRes.ok
    });
    
    if (!profileRes.ok || !usageRes.ok) {
      if (profileRes.status === 401 || usageRes.status === 401) {
        console.log('🔒 Token expired or invalid, redirecting to login...');
        // Token expired or invalid - let session manager handle this
        window.sessionManager.forceLogout('Token expired');
        return;
      }
      throw new Error(`Failed to load profile or usage information. Status: ${profileRes.status}, ${usageRes.status}`);
    }
    
    const user = await profileRes.json();
    const usage = await usageRes.json();
    
    console.log('✅ Profile and usage data loaded successfully:', { user, usage });
    
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
    
    console.log('✅ Profile loaded successfully:', user);
    
    // Load recent activity
    loadRecentActivity();
    
    // Hide loading state
    hideLoadingState();
    
  } catch (error) {
    console.error('❌ Error loading profile:', error);
    
    // Hide loading state
    hideLoadingState();
    
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
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      console.log('🔒 No access token available for activity history');
      return;
    }
    
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
      activityList.innerHTML = prompts.slice(0, 5).map(prompt => {
        const qualityTier = prompt.qualityTier || 'free';
        const tierLabels = {
          'free': 'Basic',
          'standard': 'Standard',
          'premium': 'Premium'
        };
        const tierIcons = {
          'free': '📝',
          'standard': '✨',
          'premium': '⭐'
        };
        
        return `
          <div class="activity-item">
            <div class="activity-icon">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
            <div class="activity-content">
              <h4>Prompt Generated</h4>
              <p>${prompt.comment || 'JSON prompt generated'}</p>
              <div class="activity-meta">
                <span class="quality-indicator quality-${qualityTier}">
                  ${tierIcons[qualityTier]} ${tierLabels[qualityTier]} Quality
                </span>
                <span class="activity-time">${formatTimeAgo(new Date(prompt.createdAt))}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
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

// Loading state management
const showLoadingState = () => {
  console.log('🔄 Showing loading state...');
  
  // Show loading spinner
  const loadingSpinner = document.getElementById('loading-spinner');
  if (loadingSpinner) {
    loadingSpinner.style.display = 'block';
    console.log('✅ Loading spinner shown');
  } else {
    console.warn('⚠️ Loading spinner element not found');
  }
  
  // Disable inputs and buttons but keep Logout usable
  const inputs = document.querySelectorAll('input, button');
  inputs.forEach(el => {
    if (el.id === 'logout') return; // keep logout clickable
    el.disabled = true;
  });
  const logoutBtnPersist = document.getElementById('logout');
  if (logoutBtnPersist) logoutBtnPersist.disabled = false;
  
  // Show loading message
  const dashboardSubtitle = document.getElementById('dashboard-subtitle');
  if (dashboardSubtitle) {
    dashboardSubtitle.textContent = 'Loading your dashboard...';
    dashboardSubtitle.style.opacity = '0.7';
  }
};

const hideLoadingState = () => {
  console.log('✅ Hiding loading state...');
  
  // Hide loading spinner
  const loadingSpinner = document.getElementById('loading-spinner');
  if (loadingSpinner) {
    loadingSpinner.style.display = 'none';
    console.log('✅ Loading spinner hidden');
  } else {
    console.warn('⚠️ Loading spinner element not found');
  }
  
  // Enable inputs and buttons
  const enableEls = document.querySelectorAll('input, button');
  enableEls.forEach(el => el.disabled = false);
  
  // Restore dashboard subtitle
  const dashboardSubtitle = document.getElementById('dashboard-subtitle');
  if (dashboardSubtitle) {
    dashboardSubtitle.style.opacity = '1';
  }
};

// Add loading spinner to dashboard if it doesn't exist
const addLoadingSpinner = () => {
  if (!document.getElementById('loading-spinner')) {
    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.innerHTML = `
      <div style="display: none; text-align: center; padding: 2rem;">
        <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <p style="color: #6b7280;">Loading your dashboard...</p>
      </div>
    `;
    
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
      dashboardHeader.appendChild(spinner);
    }
  }
};

// Notification functions
const showSuccess = (message) => {
  if (window.showNotification) {
    window.showNotification(message, 'success');
  } else {
    // Fallback notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: #10b981;
      color: white;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10001;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
};

const showError = (message) => {
  if (window.showNotification) {
    window.showNotification(message, 'error');
  } else {
    // Fallback notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: #ef4444;
      color: white;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10001;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
};

// Load profile when page loads
// loadProfile(); // Removed duplicate call - already called in DOMContentLoaded

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
    
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      showError('No access token available. Please log in again.');
      return;
    }
    
    const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        window.sessionManager.forceLogout('Token expired during profile update');
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