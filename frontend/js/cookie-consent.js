// Cookie Consent Management System
class CookieConsent {
  constructor() {
    this.cookieBanner = document.getElementById('cookie-consent');
    this.cookieModal = document.getElementById('cookie-modal');
    this.preferencesButton = document.getElementById('cookie-preferences');
    this.acceptAllButton = document.getElementById('cookie-accept-all');
    this.modalCloseButton = document.getElementById('cookie-modal-close');
    this.savePreferencesButton = document.getElementById('cookie-save-preferences');
    this.rejectAllButton = document.getElementById('cookie-reject-all');
    
    this.cookiePreferences = {
      essential: true, // Always true, cannot be disabled
      analytics: false,
      preferences: false,
      marketing: false
    };
    
    this.init();
  }
  
  init() {
    // Check if user has already made a choice
    if (!this.hasUserConsent()) {
      this.showBanner();
    } else {
      this.loadUserPreferences();
      this.applyPreferences();
    }
    
    this.bindEvents();
  }
  
  bindEvents() {
    // Banner buttons
    this.preferencesButton.addEventListener('click', () => this.showModal());
    this.acceptAllButton.addEventListener('click', () => this.acceptAll());
    
    // Modal buttons
    this.modalCloseButton.addEventListener('click', () => this.hideModal());
    this.savePreferencesButton.addEventListener('click', () => this.savePreferences());
    this.rejectAllButton.addEventListener('click', () => this.rejectAll());
    
    // Close modal when clicking outside
    this.cookieModal.addEventListener('click', (e) => {
      if (e.target === this.cookieModal) {
        this.hideModal();
      }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.cookieModal.classList.contains('active')) {
        this.hideModal();
      }
    });
  }
  
  hasUserConsent() {
    return localStorage.getItem('cookieConsent') !== null;
  }
  
  showBanner() {
    this.cookieBanner.classList.add('active');
    // Add body class to prevent scrolling
    document.body.classList.add('cookie-banner-active');
  }
  
  hideBanner() {
    this.cookieBanner.classList.remove('active');
    document.body.classList.remove('cookie-banner-active');
  }
  
  showModal() {
    this.cookieModal.classList.add('active');
    this.loadCurrentPreferences();
    // Add body class to prevent scrolling
    document.body.classList.add('cookie-modal-active');
  }
  
  hideModal() {
    this.cookieModal.classList.remove('active');
    document.body.classList.remove('cookie-modal-active');
  }
  
  loadCurrentPreferences() {
    const savedPreferences = this.getSavedPreferences();
    document.getElementById('analytics-cookies').checked = savedPreferences.analytics;
    document.getElementById('preference-cookies').checked = savedPreferences.preferences;
    document.getElementById('marketing-cookies').checked = savedPreferences.marketing;
  }
  
  acceptAll() {
    this.cookiePreferences = {
      essential: true,
      analytics: true,
      preferences: true,
      marketing: true
    };
    this.saveUserConsent();
    this.hideBanner();
    this.applyPreferences();
    this.showNotification('All cookies accepted!', 'success');
  }
  
  rejectAll() {
    this.cookiePreferences = {
      essential: true,
      analytics: false,
      preferences: false,
      marketing: false
    };
    this.saveUserConsent();
    this.hideModal();
    this.applyPreferences();
    this.showNotification('Non-essential cookies rejected!', 'info');
  }
  
  savePreferences() {
    this.cookiePreferences = {
      essential: true,
      analytics: document.getElementById('analytics-cookies').checked,
      preferences: document.getElementById('preference-cookies').checked,
      marketing: document.getElementById('marketing-cookies').checked
    };
    this.saveUserConsent();
    this.hideModal();
    this.applyPreferences();
    this.showNotification('Cookie preferences saved!', 'success');
  }
  
  saveUserConsent() {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences: this.cookiePreferences,
      version: '1.0'
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    
    // Set a cookie to track consent on the server side
    this.setCookie('cookie_consent', JSON.stringify(consentData), 365);
  }
  
  loadUserPreferences() {
    const savedConsent = this.getSavedPreferences();
    if (savedConsent) {
      this.cookiePreferences = savedConsent;
    }
  }
  
  getSavedPreferences() {
    try {
      const savedConsent = localStorage.getItem('cookieConsent');
      if (savedConsent) {
        const consentData = JSON.parse(savedConsent);
        return consentData.preferences || this.cookiePreferences;
      }
    } catch (error) {
      console.error('Error loading cookie preferences:', error);
    }
    return this.cookiePreferences;
  }
  
  applyPreferences() {
    // Apply analytics cookies
    if (this.cookiePreferences.analytics) {
      this.enableAnalytics();
    } else {
      this.disableAnalytics();
    }
    
    // Apply preference cookies
    if (this.cookiePreferences.preferences) {
      this.enablePreferences();
    } else {
      this.disablePreferences();
    }
    
    // Apply marketing cookies
    if (this.cookiePreferences.marketing) {
      this.enableMarketing();
    } else {
      this.disableMarketing();
    }
  }
  
  enableAnalytics() {
    // Enable Google Analytics or other analytics services
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }
    
    // Enable other analytics cookies
    this.setCookie('analytics_enabled', 'true', 365);
  }
  
  disableAnalytics() {
    // Disable analytics cookies
    this.deleteCookie('analytics_enabled');
    this.deleteCookie('_ga');
    this.deleteCookie('_gid');
    this.deleteCookie('_gat');
  }
  
  enablePreferences() {
    // Enable preference cookies
    this.setCookie('preferences_enabled', 'true', 365);
    this.setCookie('theme', 'dark', 365); // Default theme
  }
  
  disablePreferences() {
    // Disable preference cookies
    this.deleteCookie('preferences_enabled');
    this.deleteCookie('theme');
  }
  
  enableMarketing() {
    // Enable marketing cookies
    this.setCookie('marketing_enabled', 'true', 365);
  }
  
  disableMarketing() {
    // Disable marketing cookies
    this.deleteCookie('marketing_enabled');
  }
  
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }
  
  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
  
  showNotification(message, type = 'info') {
    // Check if notification system exists
    if (typeof showNotification === 'function') {
      showNotification(message, type);
    } else {
      // Fallback notification
      this.showFallbackNotification(message, type);
    }
  }
  
  showFallbackNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `cookie-notification cookie-notification-${type}`;
    notification.innerHTML = `
      <div class="cookie-notification-content">
        <span>${message}</span>
        <button class="cookie-notification-close">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.cookie-notification-close');
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }
  
  // Public method to check if specific cookie type is allowed
  isAllowed(cookieType) {
    return this.cookiePreferences[cookieType] || false;
  }
  
  // Public method to get current preferences
  getPreferences() {
    return { ...this.cookiePreferences };
  }
}

// Initialize cookie consent when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.cookieConsent = new CookieConsent();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CookieConsent;
}
