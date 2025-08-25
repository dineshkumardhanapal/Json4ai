// pricing.js — PayPal subscription + error handling
const API = path => `https://json4ai.onrender.com${path}`;

// Map plan → PayPal Plan ID you created in PayPal Dashboard
const PAYPAL_PLAN_IDS = {
  starter: 'P-XXXXXXXXXX', // 30 prompts / month
  premium: 'P-XXXXXXXXXX'  // 100 prompts / month
};

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePricingPage();
});

// Initialize the pricing page
async function initializePricingPage() {
  // Check if user is logged in
  const sessionManager = window.sessionManager;
  if (sessionManager && sessionManager.isLoggedIn()) {
    // User is logged in, update UI
    updateUIForLoggedInUser();
    
    // Get user's current plan and update UI accordingly
    await loadUserPlan();
  } else {
    // User is not logged in, show login prompt
    updateUIForGuestUser();
  }
  
  // Attach listeners to plan buttons
  attachPlanButtonListeners();
}

// Update UI for logged-in users
function updateUIForLoggedInUser() {
  const loginLink = document.getElementById('login-link');
  const dashboardLink = document.getElementById('dashboard-link');
  const logoutLink = document.getElementById('logout-link');
  
  if (loginLink) loginLink.style.display = 'none';
  if (dashboardLink) dashboardLink.style.display = 'inline';
  if (logoutLink) logoutLink.style.display = 'inline';
  
  // Add logout functionality
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      if (window.sessionManager) {
        await window.sessionManager.logout();
        location.reload();
      }
    });
  }
}

// Update UI for guest users
function updateUIForGuestUser() {
  // Show login prompt for subscription buttons
  document.querySelectorAll('[data-plan]').forEach(btn => {
    if (btn.dataset.plan !== 'free') {
      btn.textContent = 'Login to Subscribe';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showError('Please log in to subscribe to a plan.');
        setTimeout(() => {
          location.href = 'login.html';
        }, 1500);
      });
    }
  });
}

// Load user's current plan and update UI
async function loadUserPlan() {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    
    const response = await fetch(API('/api/user/profile'), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      updatePlanButtons(user.plan);
    }
  } catch (error) {
    console.error('Error loading user plan:', error);
  }
}

// Update plan buttons based on user's current plan
function updatePlanButtons(currentPlan) {
  document.querySelectorAll('[data-plan]').forEach(btn => {
    const planType = btn.dataset.plan;
    
    if (planType === currentPlan) {
      btn.textContent = 'Current Plan';
      btn.disabled = true;
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
    } else if (planType === 'free') {
      // Free plan button should always be disabled for logged-in users
      btn.textContent = 'Current Plan';
      btn.disabled = true;
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
    } else {
      // Upgrade options
      btn.textContent = 'Upgrade';
      btn.disabled = false;
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
    }
  });
}

// Attach event listeners to plan buttons
function attachPlanButtonListeners() {
  document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', handleUpgrade);
  });
}

async function handleUpgrade(e) {
  const plan = e.target.dataset.plan;
  
  // Don't allow upgrading to free plan
  if (plan === 'free') {
    return;
  }
  
  // Check if user is logged in
  const sessionManager = window.sessionManager;
  if (!sessionManager || !sessionManager.isLoggedIn()) {
    showError('Please log in to subscribe to a plan.');
    setTimeout(() => {
      location.href = 'login.html';
    }, 1500);
    return;
  }

  try {
    e.target.disabled = true;
    e.target.textContent = 'Creating Subscription…';

    const res = await fetch(API('/api/paypal/create-subscription'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionManager.getAccessToken()}`
      },
      body: JSON.stringify({ planType: plan })
    });

    const data = await res.json();
    if (res.ok && data.approvalUrl) {
      // Redirect to PayPal for subscription approval
      location.href = data.approvalUrl;
    } else {
      showError(data.error || 'Unable to create subscription.');
    }
  } catch (err) {
    console.error(err);
    showError('Network error. Please try again later.');
  } finally {
    e.target.disabled = false;
    e.target.textContent = 'Upgrade';
  }
}

// Handle return from PayPal (add this to your dashboard or success page)
function handlePayPalReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const canceled = urlParams.get('canceled');

  if (success === 'true') {
    showSuccess('Subscription activated successfully! Welcome to JSON4AI!');
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      location.href = 'dashboard.html';
    }, 2000);
  } else if (canceled === 'true') {
    showInfo('Subscription was canceled. You can try again anytime.');
  }
}

// Check if user is returning from PayPal
if (window.location.search.includes('success') || window.location.search.includes('canceled')) {
  handlePayPalReturn();
}

// Notification functions
function showError(message) {
  if (window.showError) {
    window.showError(message);
  } else {
    alert('Error: ' + message);
  }
}

function showSuccess(message) {
  if (window.showSuccess) {
    window.showSuccess(message);
  } else {
    alert('Success: ' + message);
  }
}

function showInfo(message) {
  if (window.showInfo) {
    window.showInfo(message);
  } else {
    alert('Info: ' + message);
  }
}