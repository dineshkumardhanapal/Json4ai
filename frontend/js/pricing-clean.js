// pricing.js — Clean pricing UI with toggle and better UX
// Version: 3.0 - Production ready without debugging

const API = path => `https://json4ai.onrender.com${path}`;

// Initialize pricing page
async function initializePricingPage() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePricingPage);
    return;
  }

  // Initialize pricing toggle
  initializePricingToggle();
  
  // Initialize payment buttons
  initializePaymentButtons();
  
  // Initialize plan selection
  initializePlanSelection();
  
  // Update navigation
  updateNavigation();
}

// Initialize pricing toggle
function initializePricingToggle() {
  const toggle = document.getElementById('pricing-toggle');
  if (toggle) {
    toggle.addEventListener('change', function() {
      const isYearly = this.checked;
      updatePricingDisplay(isYearly);
    });
    
    // Initialize with monthly pricing
    updatePricingDisplay(false);
  }
}

// Update pricing display based on toggle
function updatePricingDisplay(isYearly) {
  const planCards = document.querySelectorAll('.plan-card');
  
  planCards.forEach((card, index) => {
    const monthlyPrice = card.querySelector('.monthly-price');
    const yearlyPrice = card.querySelector('.yearly-price');
    
    if (monthlyPrice && yearlyPrice) {
      if (isYearly) {
        monthlyPrice.style.display = 'none';
        yearlyPrice.style.display = 'block';
      } else {
        monthlyPrice.style.display = 'block';
        yearlyPrice.style.display = 'none';
      }
    }
  });
}

// Initialize payment buttons
function initializePaymentButtons() {
  const buttons = document.querySelectorAll('.btn-primary');
  
  buttons.forEach(button => {
    button.addEventListener('click', async function(e) {
      e.preventDefault();
      
      // Check if user is logged in
      if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
        showNotification('Please log in to continue', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
        return;
      }
      
      // Get plan type from button data attribute or parent card
      const planCard = this.closest('.plan-card');
      let planType = this.dataset.plan;
      
      if (!planType && planCard) {
        const planName = planCard.querySelector('h3')?.textContent?.toLowerCase();
        if (planName?.includes('free')) planType = 'free';
        else if (planName?.includes('starter')) planType = 'starter';
        else if (planName?.includes('premium')) planType = 'premium';
      }
      
      if (!planType) {
        showNotification('Unable to determine plan type', 'error');
        return;
      }
      
      // Handle free plan
      if (planType === 'free') {
        showNotification('Free plan is already active!', 'success');
        return;
      }
      
      // Handle paid plans
      try {
        showNotification('Processing payment...', 'info');
        await createPaymentOrder(planType);
      } catch (error) {
        showNotification('Payment failed. Please try again.', 'error');
      }
    });
  });
}

// Initialize plan selection
function initializePlanSelection() {
  const planCards = document.querySelectorAll('.plan-card');
  
  planCards.forEach(card => {
    card.addEventListener('click', function() {
      // Remove selected class from all cards
      planCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      this.classList.add('selected');
      
      // Update button text
      updateButtonText(this);
    });
  });
}

// Update button text based on selection
function updateButtonText(selectedCard) {
  const button = selectedCard.querySelector('.btn-primary');
  if (!button) return;
  
  const planName = selectedCard.querySelector('h3')?.textContent;
  if (planName?.toLowerCase().includes('free')) {
    button.textContent = 'Current Plan';
    button.disabled = true;
  } else {
    button.textContent = `Get ${planName}`;
    button.disabled = false;
  }
}

// Create payment order
async function createPaymentOrder(planType) {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token');
    }

    const response = await fetch(`${API('/api/payment/create-order')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        plan: planType,
        amount: getPlanAmount(planType),
        currency: 'USD'
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Redirect to payment page or handle Razorpay
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.razorpayOrderId) {
        // Handle Razorpay integration
        handleRazorpayPayment(data);
      }
    } else {
      throw new Error(data.message || 'Payment creation failed');
    }
  } catch (error) {
    throw error;
  }
}

// Get plan amount
function getPlanAmount(planType) {
  const amounts = {
    starter: 9,
    premium: 29
  };
  return amounts[planType] || 0;
}

// Handle Razorpay payment
function handleRazorpayPayment(data) {
  // This would integrate with Razorpay SDK
  showNotification('Razorpay integration not yet implemented', 'info');
}

// Update navigation based on login status
function updateNavigation() {
  const loginLink = document.getElementById('login-link');
  const dashLink = document.getElementById('dashboard-link');
  
  if (window.sessionManager && window.sessionManager.isLoggedIn()) {
    if (loginLink) loginLink.style.display = 'none';
    if (dashLink) dashLink.style.display = 'block';
  } else {
    if (loginLink) loginLink.style.display = 'block';
    if (dashLink) dashLink.style.display = 'none';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <div class="notification-message">${message}</div>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Add to notification container
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  container.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Initialize when page loads
initializePricingPage();
