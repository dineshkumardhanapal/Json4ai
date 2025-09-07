// pricing.js — PayPal subscription + error handling
// Version: 2.2 - Enhanced pricing UI with toggle and better UX
const API = path => `https://json4ai.onrender.com${path}`;

// Note: PayPal plan IDs removed. Razorpay is the active gateway.

// Force visibility immediately when script loads
(function() {
  console.log('Pricing script loaded - forcing immediate visibility');
  
  // Force visibility immediately
  function forceImmediateVisibility() {
    const planCards = document.querySelectorAll('.plan-card');
    console.log(`Found ${planCards.length} plan cards`);
    
    planCards.forEach((card, index) => {
      console.log(`Forcing visibility for card ${index}:`, card);
      card.style.setProperty('display', 'flex', 'important');
      card.style.setProperty('visibility', 'visible', 'important');
      card.style.setProperty('opacity', '1', 'important');
      card.classList.remove('hidden');
      
      // Force all child elements to be visible
      const children = card.querySelectorAll('*');
      children.forEach(child => {
        child.style.setProperty('display', '', 'important');
        child.style.setProperty('visibility', 'visible', 'important');
        child.style.setProperty('opacity', '1', 'important');
      });
    });
  }
  
  // Run immediately
  forceImmediateVisibility();
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceImmediateVisibility);
  } else {
    forceImmediateVisibility();
  }
})();

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Pricing page loaded');
  
  // Force immediate visibility
  forcePricingVisibility();
  
  ensurePlanContentVisible();
  initializePricingPage();
  initializePricingToggle();
  
  // Force visibility after a short delay
  setTimeout(() => {
    forcePricingVisibility();
    ensurePlanContentVisible();
    console.log('Plan content visibility forced');
  }, 100);
  
  // Additional force after longer delay
  setTimeout(() => {
    forcePricingVisibility();
    console.log('Final visibility check');
  }, 500);
  
  // Continuous monitoring to prevent content from disappearing
  setInterval(() => {
    const planCards = document.querySelectorAll('.plan-card');
    planCards.forEach(card => {
      if (card.classList.contains('hidden') || 
          card.style.display === 'none' || 
          card.style.visibility === 'hidden' || 
          card.style.opacity === '0') {
        console.log('Detected hidden plan card, forcing visibility');
        forcePricingVisibility();
      }
    });
  }, 1000);
  
  // MutationObserver to watch for changes that might hide content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || 
           mutation.attributeName === 'style')) {
        const target = mutation.target;
        if (target.classList.contains('plan-card') && 
            (target.classList.contains('hidden') || 
             target.style.display === 'none' || 
             target.style.visibility === 'hidden' || 
             target.style.opacity === '0')) {
          console.log('MutationObserver detected hidden plan card, forcing visibility');
          forcePricingVisibility();
        }
      }
    });
  });
  
  // Start observing
  const pricingGrid = document.querySelector('.pricing-grid');
  if (pricingGrid) {
    observer.observe(pricingGrid, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'style']
    });
  }
});

// Force pricing visibility with maximum priority
function forcePricingVisibility() {
  console.log('Forcing pricing visibility...');
  
  // Force all plan cards to be visible
  const planCards = document.querySelectorAll('.plan-card');
  console.log(`Found ${planCards.length} plan cards`);
  
  planCards.forEach((card, index) => {
    console.log(`Card ${index}:`, card);
    card.style.setProperty('display', 'flex', 'important');
    card.style.setProperty('visibility', 'visible', 'important');
    card.style.setProperty('opacity', '1', 'important');
    card.classList.remove('hidden');
    
    // Force all child elements to be visible
    const children = card.querySelectorAll('*');
    children.forEach(child => {
      child.style.setProperty('display', '', 'important');
      child.style.setProperty('visibility', 'visible', 'important');
      child.style.setProperty('opacity', '1', 'important');
    });
  });
  
  // Force pricing grid to be visible
  const pricingGrid = document.querySelector('.pricing-grid');
  if (pricingGrid) {
    pricingGrid.style.setProperty('display', 'grid', 'important');
    pricingGrid.style.setProperty('visibility', 'visible', 'important');
    pricingGrid.style.setProperty('opacity', '1', 'important');
  }
  
  console.log('Pricing visibility forced');
}

// Ensure all plan content is visible
function ensurePlanContentVisible() {
  document.querySelectorAll('.plan-card').forEach(card => {
    card.style.display = 'flex';
    card.style.visibility = 'visible';
    card.style.opacity = '1';
    card.classList.remove('hidden');
    
    // Ensure all plan content is visible
    const planHeader = card.querySelector('.plan-header');
    const planDescription = card.querySelector('.plan-description');
    const planFeatures = card.querySelector('.plan-features');
    const planPopularity = card.querySelector('.plan-popularity');
    
    if (planHeader) {
      planHeader.style.display = 'block';
      planHeader.style.visibility = 'visible';
      planHeader.style.opacity = '1';
    }
    if (planDescription) {
      planDescription.style.display = 'block';
      planDescription.style.visibility = 'visible';
      planDescription.style.opacity = '1';
    }
    if (planFeatures) {
      planFeatures.style.display = 'block';
      planFeatures.style.visibility = 'visible';
      planFeatures.style.opacity = '1';
    }
    if (planPopularity) {
      planPopularity.style.display = 'block';
      planPopularity.style.visibility = 'visible';
      planPopularity.style.opacity = '1';
    }
  });
  
  // Lottie players removed to prevent loading issues
}

// Lottie function removed to prevent loading issues

// Pricing toggle functionality
function initializePricingToggle() {
  const toggle = document.getElementById('pricing-toggle');
  if (!toggle) return;

  toggle.addEventListener('change', function() {
    const isYearly = this.checked;
    updatePricingDisplay(isYearly);
  });
}

function updatePricingDisplay(isYearly) {
  const monthlyPrices = document.querySelectorAll('.price:not(.yearly-price)');
  const yearlyPrices = document.querySelectorAll('.yearly-price');
  
  monthlyPrices.forEach(price => {
    price.style.display = isYearly ? 'none' : 'flex';
  });
  
  yearlyPrices.forEach(price => {
    price.style.display = isYearly ? 'flex' : 'none';
  });
  
  // Update plan cards with yearly pricing
  const planCards = document.querySelectorAll('.plan-card');
  planCards.forEach(card => {
    if (isYearly) {
      card.classList.add('yearly-pricing');
    } else {
      card.classList.remove('yearly-pricing');
    }
  });
}

// Initialize the pricing page
async function initializePricingPage() {
  console.log('Initializing pricing page - forcing all content visible');
  
  // Force all content to be visible immediately
  forcePricingVisibility();
  ensurePlanContentVisible();
  
  // Don't run any logic that might hide content
  console.log('Pricing page initialized - all content should be visible');
  
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

// Update UI for guest users - DISABLED to prevent content hiding
function updateUIForGuestUser() {
  console.log('Guest user function disabled - keeping all content visible');
  // This function is disabled to prevent any content from being hidden
  // All content should remain visible as defined in HTML
}

// Load user's current plan and update UI
async function loadUserPlan() {
  try {
    const sessionManager = window.sessionManager;
    if (!sessionManager || !sessionManager.isLoggedIn()) {
      console.log('User not logged in, skipping plan load');
      return;
    }
    
    const token = sessionManager.getAccessToken();
    if (!token) {
      console.log('No access token available');
      return;
    }
    
    const response = await fetch(API('/api/user/profile'), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      updatePlanButtons(user.plan);
    } else {
      console.error('Failed to load user plan:', response.status, response.statusText);
      // Fallback to free plan if API fails
      updatePlanButtons('free');
    }
  } catch (error) {
    console.error('Error loading user plan:', error);
    // Fallback to free plan if network fails
    updatePlanButtons('free');
  }
}

// Update plan buttons based on user's current plan
function updatePlanButtons(currentPlan) {
  document.querySelectorAll('[data-plan]').forEach(btn => {
    const planType = btn.dataset.plan;
    
    if (planType === currentPlan) {
      // This is the user's current plan
      btn.textContent = 'Current Plan';
      btn.disabled = true;
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
    } else {
      // This is not the user's current plan
      if (planType === 'free') {
        // Free plan - show as available option
        btn.textContent = 'Downgrade to Free';
        btn.disabled = false;
        btn.classList.add('btn-secondary');
        btn.classList.remove('btn-primary');
      } else {
        // Paid plans - show as upgrade options
        btn.textContent = 'Upgrade';
        btn.disabled = false;
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
      }
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
  
  // Handle free plan downgrade
  if (plan === 'free') {
    const confirmed = confirm('Are you sure you want to downgrade to the free plan? You will lose access to your current paid features.');
    if (confirmed) {
      // TODO: Implement downgrade to free plan
      showInfo('Downgrade to free plan feature coming soon. Please contact support for assistance.');
    }
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
    e.target.textContent = 'Creating Order…';

    const res = await fetch(API('/api/payment/create-order'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionManager.getAccessToken()}`
      },
      body: JSON.stringify({ planType: plan })
    });

    console.log('Payment order creation response:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error('Failed to parse response:', e);
      throw new Error('Invalid response from server');
    }
    if (res.ok && data.success) {
      // Store order details for tracking
      localStorage.setItem('pendingOrder', JSON.stringify({
        orderId: data.orderId,
        fullOrderId: data.fullOrderId,
        planType: plan,
        timestamp: Date.now()
      }));
      
      // Initialize Razorpay checkout
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.orderId,
        prefill: data.prefill,
        notes: data.notes,
        handler: function (response) {
          // Payment successful - verify with backend
          verifyPayment(response);
        },
        modal: {
          ondismiss: function() {
            // Payment modal dismissed
            e.target.disabled = false;
            e.target.textContent = 'Buy Now';
          }
        },
        onClose: function() {
          // Payment modal closed
          e.target.disabled = false;
          e.target.textContent = 'Buy Now';
        }
      };
      
      if (typeof Razorpay === 'undefined') {
        showError('Payment gateway not available. Please refresh the page and try again.');
        e.target.disabled = false;
        e.target.textContent = 'Buy Now';
        return;
      }
      
      const rzp = new Razorpay(options);
      rzp.open();
      
    } else {
      // Show appropriate error messages
      console.error('Payment order creation failed:', data);
      
      if (res.status === 401) {
        showError('Session expired. Please log in again.');
        setTimeout(() => {
          location.href = 'login.html';
        }, 2000);
      } else if (res.status === 404) {
        showError('Payment service not available. Please try again later.');
      } else if (res.status === 500) {
        showError('Server error occurred. Please try again later.');
      } else if (data.error && data.error.includes('You already have an active plan')) {
        showInfo(`${data.error}. ${data.details || ''}`);
      } else if (data.error && data.error.includes('Failed to create payment order')) {
        showError(`${data.error}. ${data.details || ''}`);
      } else {
        showError(data.error || `Unable to create payment order. (Status: ${res.status})`);
      }
    }
      } catch (err) {
      console.error('Payment order creation error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        showError('Network error. Please check your internet connection and try again.');
      } else {
        showError('Unable to create payment order. Please try again later.');
      }
    } finally {
      e.target.disabled = false;
      e.target.textContent = 'Buy Now';
    }
}

// Verify payment with backend
async function verifyPayment(response) {
  try {
    const sessionManager = window.sessionManager;
    if (!sessionManager || !sessionManager.isLoggedIn()) {
      showError('Session expired. Please log in again.');
      return;
    }

    const res = await fetch(API('/api/payment/verify-payment'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionManager.getAccessToken()}`
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showSuccess('Payment successful! Your plan has been activated.');
      // Clear pending order
      localStorage.removeItem('pendingOrder');
      
      // Force refresh user plan data
      await refreshUserPlan();
      
      // Update UI to show new plan
      updateUIForNewPlan();
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        location.href = 'dashboard.html';
      }, 2000);
    } else {
      showError(data.error || 'Payment verification failed. Please contact support.');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    showError('Payment verification failed. Please contact support.');
  }
}

// Handle return from payment gateway (Razorpay)
function handlePaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const canceled = urlParams.get('canceled');
  const orderId = urlParams.get('order_id');
  const orderStatus = urlParams.get('order_status');

  // Get pending order from localStorage
  const pendingOrder = localStorage.getItem('pendingOrder');
  let planName = 'Premium';
  
  if (pendingOrder) {
    try {
      const orderData = JSON.parse(pendingOrder);
      planName = orderData.planType ? orderData.planType.charAt(0).toUpperCase() + orderData.planType.slice(1) : 'Premium';
      // Clear pending order
      localStorage.removeItem('pendingOrder');
    } catch (e) {
      console.error('Error parsing pending order:', e);
    }
  }

  if (success === 'true' || orderStatus === 'PAID') {
    showSuccess(`${planName} plan payment successful! Your plan will be activated shortly.`);
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      location.href = 'dashboard.html';
    }, 3000);
  } else if (canceled === 'true' || orderStatus === 'CANCELLED') {
    showInfo('Payment was canceled. You can try again anytime.');
  } else if (orderStatus === 'FAILED') {
    showError('Payment failed. Please try again or contact support if the issue persists.');
  }
}

// Check if user is returning from payment gateway
if (window.location.search.includes('success') || 
    window.location.search.includes('canceled') || 
    window.location.search.includes('order_status') ||
    window.location.search.includes('order_id')) {
  handlePaymentReturn();
}

// Plan refresh and UI update functions
const refreshUserPlan = async () => {
  try {
    const sessionManager = window.sessionManager;
    if (!sessionManager || !sessionManager.isLoggedIn()) {
      console.log('User not logged in, skipping plan refresh');
      return;
    }
    
    // Force refresh user plan data
    const res = await fetch(API('/api/user/profile'), {
      headers: {
        'Authorization': `Bearer ${sessionManager.getAccessToken()}`,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (res.ok) {
      const user = await res.json();
      // Store updated plan info
      localStorage.setItem('userPlan', JSON.stringify({
        plan: user.plan,
        planEndDate: user.planEndDate,
        timestamp: Date.now()
      }));
      return user;
    } else {
      console.error('Plan refresh failed:', res.status, res.statusText);
    }
  } catch (error) {
    console.error('Error refreshing user plan:', error);
    // Don't throw error, just log it
  }
};

const updateUIForNewPlan = () => {
  // Update plan buttons to show current plan
  const userPlan = JSON.parse(localStorage.getItem('userPlan') || '{}');
  if (userPlan.plan) {
    updatePlanButtons(userPlan.plan);
  }
  
  // Show success notification
  showSuccess(`Plan updated successfully! You now have ${userPlan.plan} access.`);
};

// Auto-refresh plan data every 30 seconds if user is on pricing page
let planRefreshInterval;
let isRefreshing = false; // Prevent concurrent refreshes

const startPlanRefresh = () => {
  if (planRefreshInterval) clearInterval(planRefreshInterval);
  
  planRefreshInterval = setInterval(async () => {
    if (window.sessionManager && window.sessionManager.isLoggedIn() && !isRefreshing) {
      isRefreshing = true;
      try {
        await refreshUserPlan();
      } catch (error) {
        console.error('Error in plan refresh interval:', error);
      } finally {
        isRefreshing = false;
      }
    }
  }, 30000); // 30 seconds
};

// Start plan refresh when page loads
document.addEventListener('DOMContentLoaded', () => {
  startPlanRefresh();
});

// Notification functions with enhanced safety
function showError(message) {
  try {
    // Prevent infinite recursion by checking if this is already the global function
    if (window.showError && window.showError !== showError) {
      window.showError(message);
    } else {
      // Use a simple alert as fallback to prevent infinite loops
      showNotification(message, 'error');
    }
  } catch (error) {
    console.error('Error in showError:', error);
    // Ultimate fallback
    alert('Error: ' + message);
  }
}

function showSuccess(message) {
  try {
    if (window.showSuccess && window.showSuccess !== showSuccess) {
      window.showSuccess(message);
    } else {
      showNotification(message, 'success');
    }
  } catch (error) {
    console.error('Error in showSuccess:', error);
    // Ultimate fallback
    alert('Success: ' + message);
  }
}

function showInfo(message) {
  try {
    // Prevent infinite recursion by checking if this is already the global function
    if (window.showInfo && window.showInfo !== showInfo) {
      window.showInfo(message);
    } else {
      showNotification(message, 'info');
    }
  } catch (error) {
    console.error('Error in showInfo:', error);
    // Ultimate fallback
    alert('Info: ' + message);
  }
}

function showNotification(message, type = 'info') {
  // Prevent infinite recursion by not calling window.showNotification
  // Always use the fallback notification
  try {
    // Fallback notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10001;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    switch (type) {
      case 'success':
        notification.style.background = '#10b981';
        break;
      case 'error':
        notification.style.background = '#ef4444';
        break;
      case 'warning':
        notification.style.background = '#f59e0b';
        break;
      default:
        notification.style.background = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  } catch (error) {
    console.error('Error creating notification:', error);
    // Ultimate fallback
    alert(`${type.toUpperCase()}: ${message}`);
  }
}