// pricing.js — Enhanced pricing UI with toggle and better UX
// Version: 2.3 - Clean production version without debugging code
const API = path => `https://json4ai.onrender.com${path}`;

// Force visibility immediately when script loads
(function() {
  // Force visibility immediately
  function forceImmediateVisibility() {
    const planCards = document.querySelectorAll('.plan-card');
    
    planCards.forEach((card, index) => {
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
      
      // Specifically ensure all features are visible
      const features = card.querySelectorAll('.plan-features li');
      features.forEach((feature, featureIndex) => {
        feature.style.setProperty('display', 'flex', 'important');
        feature.style.setProperty('visibility', 'visible', 'important');
        feature.style.setProperty('opacity', '1', 'important');
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
  // Initialize pricing page functionality
  const planCards = document.querySelectorAll('.plan-card');
  
  planCards.forEach((card, index) => {
    // Ensure all plan cards are visible
    card.style.setProperty('display', 'flex', 'important');
    card.style.setProperty('visibility', 'visible', 'important');
    card.style.setProperty('opacity', '1', 'important');
    card.classList.remove('hidden');
    
    // Add click handler for plan selection
    card.addEventListener('click', function() {
      // Remove selected class from all cards
      planCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      this.classList.add('selected');
      
      // Update the hidden input for form submission
      const planInput = document.getElementById('selected-plan');
      if (planInput) {
        const planName = this.querySelector('h3')?.textContent?.toLowerCase();
        if (planName) {
          planInput.value = planName;
        }
      }
    });
  });

  // Initialize pricing toggle
  const toggle = document.getElementById('pricing-toggle');
  if (toggle) {
    toggle.addEventListener('change', function() {
      const isYearly = this.checked;
      updatePricingDisplay(isYearly);
    });
    
    // Initialize with monthly pricing
    updatePricingDisplay(false);
  }

  // Initialize payment buttons
  initializePaymentButtons();
  
  // Update navigation based on login status
  updateNavigation();
});

function updatePricingDisplay(isYearly) {
  // Get all plan cards
  const planCards = document.querySelectorAll('.plan-card');
  
  planCards.forEach(card => {
    const planName = card.querySelector('h3')?.textContent?.toLowerCase();
    const yearlyPrice = card.querySelector('.yearly-price');
    
    if (yearlyPrice) {
      if (isYearly) {
        // Add yearly-pricing class to enable CSS rules
        card.classList.add('yearly-pricing');
      } else {
        // Remove yearly-pricing class to show monthly pricing
        card.classList.remove('yearly-pricing');
      }
    } else {
      // Fallback: manually toggle visibility
      const monthlyPrice = card.querySelector('.price:not(.yearly-price)');
      if (monthlyPrice && yearlyPrice) {
        if (isYearly) {
          monthlyPrice.style.display = 'none';
          yearlyPrice.style.display = 'block';
        } else {
          monthlyPrice.style.display = 'block';
          yearlyPrice.style.display = 'none';
        }
      }
    }
  });
  
  // Update toggle label
  const toggleLabel = document.querySelector('.toggle-label');
  if (toggleLabel) {
    toggleLabel.textContent = isYearly ? 'Yearly' : 'Monthly';
  }
}

// Initialize the pricing page
async function initializePricingPage() {
  // Force all content to be visible immediately
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    if (el.style.display === 'none') {
      el.style.display = '';
    }
    if (el.style.visibility === 'hidden') {
      el.style.visibility = 'visible';
    }
    if (el.style.opacity === '0') {
      el.style.opacity = '1';
    }
  });
  
  // Ensure plan cards are visible
  const planCards = document.querySelectorAll('.plan-card');
  planCards.forEach(card => {
    card.style.display = 'flex';
    card.style.visibility = 'visible';
    card.style.opacity = '1';
  });
  
  // Initialize pricing toggle
  const toggle = document.getElementById('pricing-toggle');
  if (toggle) {
    updatePricingDisplay(toggle.checked);
  }
}

// Payment functionality
async function createPaymentOrder(planType) {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      showNotification('Please log in to continue', 'error');
      return;
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.order) {
      // Initialize Razorpay
      const options = {
        key: data.order.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'JSON4AI',
        description: `${planType} Plan Subscription`,
        order_id: data.order.id,
        handler: function(response) {
          handlePaymentSuccess(response, planType);
        },
        prefill: {
          name: data.user?.name || '',
          email: data.user?.email || ''
        },
        theme: {
          color: '#22d3ee'
        },
        modal: {
          ondismiss: function() {
            showNotification('Payment cancelled', 'warning');
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      throw new Error(data.message || 'Failed to create payment order');
    }
  } catch (error) {
    showNotification(`Payment error: ${error.message}`, 'error');
  }
}

function getPlanAmount(planType) {
  const amounts = {
    'starter': 900, // $9.00 in cents
    'premium': 2900 // $29.00 in cents
  };
  return amounts[planType.toLowerCase()] || 900;
}

async function handlePaymentSuccess(paymentResponse, planType) {
  try {
    const token = localStorage.getItem('accessToken');
    
    const response = await fetch(`${API('/api/payment/verify')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        payment_id: paymentResponse.razorpay_payment_id,
        order_id: paymentResponse.razorpay_order_id,
        signature: paymentResponse.razorpay_signature,
        plan: planType
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showNotification('Payment successful! Your subscription has been activated.', 'success');
      // Redirect to dashboard after successful payment
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 2000);
    } else {
      throw new Error(data.message || 'Payment verification failed');
    }
  } catch (error) {
    showNotification(`Payment verification error: ${error.message}`, 'error');
  }
}

function initializePaymentButtons() {
  // Handle plan selection and payment
  const planCards = document.querySelectorAll('.plan-card');
  
  planCards.forEach(card => {
    const button = card.querySelector('.btn-primary');
    if (button) {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const planName = card.querySelector('h3')?.textContent?.toLowerCase();
        if (planName && planName !== 'free') {
          createPaymentOrder(planName);
        } else if (planName === 'free') {
          showNotification('Free plan is already active!', 'info');
        }
      });
    }
  });
}

function updateNavigation() {
  const loginLink = document.getElementById('login-link');
  const dashboardLink = document.getElementById('dashboard-link');
  const logoutLink = document.getElementById('logout-link');
  
  if (!loginLink || !dashboardLink || !logoutLink) {
    return;
  }
  
  const isLoggedIn = localStorage.getItem('accessToken') !== null;
  
  if (isLoggedIn) {
    loginLink.style.display = 'none';
    dashboardLink.style.display = 'block';
    logoutLink.style.display = 'block';
  } else {
    loginLink.style.display = 'block';
    dashboardLink.style.display = 'none';
    logoutLink.style.display = 'none';
  }
}

// Utility function to show notifications
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePricingPage);
} else {
  initializePricingPage();
}