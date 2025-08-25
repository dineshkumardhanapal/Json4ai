// pricing.js — PayPal subscription + error handling
const API = path => `https://json4ai.onrender.com${path}`;

// Map plan → PayPal Plan ID you created in PayPal Dashboard
const PAYPAL_PLAN_IDS = {
  starter: 'P-XXXXXXXXXX', // 30 prompts / month
  premium: 'P-XXXXXXXXXX'  // 100 prompts / month
};

// Attach listeners to every plan button
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', handleUpgrade);
  });
});

async function handleUpgrade(e) {
  const plan = e.target.dataset.plan;
  
  // Map frontend plan names to backend plan types
  const planTypeMap = {
    'starter': 'starter',
    'pro': 'premium',
    'enterprise': 'premium'
  };
  
  const planType = planTypeMap[plan];
  
  if (!planType) {
    showError('Unknown plan selected.');
    return;
  }

  const token = localStorage.getItem('accessToken');
  if (!token) {
    showError('Please log in first.');
    setTimeout(() => (location.href = 'login.html'), 1500);
    return;
  }

  try {
    e.target.disabled = true;
    e.target.textContent = 'Creating Subscription…';

    const res = await fetch(API('/api/paypal/create-subscription'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ planType })
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
    e.target.textContent = 'Get Started';
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