// frontend/js/paypal-helper.js
// Helper functions for PayPal integration

class PayPalHelper {
  constructor() {
    this.isPayPalRedirect = this.checkIfPayPalRedirect();
    this.init();
  }

  // Check if we're returning from PayPal
  checkIfPayPalRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('success') || urlParams.has('canceled') || urlParams.has('token');
  }

  // Initialize PayPal helper
  init() {
    if (this.isPayPalRedirect) {
      this.handlePayPalReturn();
    }
    
    // Add CSP meta tag for PayPal pages
    this.addCSPMetaTag();
  }

  // Handle return from PayPal
  handlePayPalReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const token = urlParams.get('token');

    if (success === 'true') {
      this.showSuccessMessage('Subscription activated successfully!');
      // Redirect to dashboard after a delay
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
    } else if (canceled === 'true') {
      this.showInfoMessage('Subscription was canceled');
      // Redirect to pricing page after a delay
      setTimeout(() => {
        window.location.href = '/pricing.html';
      }, 2000);
    } else if (token) {
      // Handle PayPal token if needed
      this.handlePayPalToken(token);
    }
  }

  // Handle PayPal token
  handlePayPalToken(token) {
    // You can implement additional token handling here
  }

  // Add CSP meta tag to allow PayPal resources
  addCSPMetaTag() {
    // Remove existing CSP meta tag if present
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingCSP) {
      existingCSP.remove();
    }

    // Create new CSP meta tag
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://*.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "img-src 'self' data: https: blob: https://*.paypal.com https://*.paypalobjects.com",
      "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://api-m.sandbox.paypal.com https://api-m.paypal.com https://*.onrender.com https://json4ai.onrender.com",
      "frame-src 'self' https://*.paypal.com https://*.paypalobjects.com",
      "frame-ancestors 'self'",
      "form-action 'self' https://*.paypal.com"
    ].join('; ');

    // Add to head
    document.head.appendChild(cspMeta);
  }

  // Show success message
  showSuccessMessage(message) {
    if (typeof showNotification === 'function') {
      showNotification(message, 'success');
    } else {
      alert(message);
    }
  }

  // Show info message
  showInfoMessage(message) {
    if (typeof showNotification === 'function') {
      showNotification(message, 'info');
    } else {
      alert(message);
    }
  }

  // Show error message
  showErrorMessage(message) {
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      alert(message);
    }
  }

  // Subscribe to a plan
  async subscribeToPlan(planType) {
    try {
      const response = await fetch('/api/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ planType })
      });

      const data = await response.json();
      
      if (data.approvalUrl) {
        // Redirect to PayPal for approval
        window.location.href = data.approvalUrl;
      } else if (data.error) {
        this.showErrorMessage(data.error);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      this.showErrorMessage('Failed to create subscription. Please try again.');
    }
  }

  // Get auth token from session storage
  getAuthToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getAuthToken();
  }
}

// Initialize PayPal helper when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.paypalHelper = new PayPalHelper();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PayPalHelper;
}
