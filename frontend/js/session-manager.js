/**
 * Session Manager for JSON4AI
 * Handles automatic logout, token refresh, and session monitoring
 */

class SessionManager {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.userData = localStorage.getItem('userData');
    this.sessionTimeout = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.warningTime = 2 * 60 * 1000; // 2 minutes warning before logout
    this.activityTimeout = null;
    this.warningTimeout = null;
    this.isRefreshing = false;
    
    this.init();
  }

  init() {
    // Always update navigation UI on init
    this.updateNavigationUI();
    
    if (this.accessToken && this.refreshToken) {
      this.startSessionMonitoring();
      this.setupActivityListeners();
      this.checkTokenExpiration();
    }
  }

  // Start monitoring session timeout
  startSessionMonitoring() {
    this.resetSessionTimeout();
  }

  // Reset session timeout on user activity
  resetSessionTimeout() {
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
    }

    // Set warning timeout (13 minutes)
    this.warningTimeout = setTimeout(() => {
      this.showSessionWarning();
    }, this.sessionTimeout - this.warningTime);

    // Set logout timeout (15 minutes)
    this.activityTimeout = setTimeout(() => {
      this.forceLogout('Session expired due to inactivity');
    }, this.sessionTimeout);
  }

  // Setup activity listeners
  setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.resetSessionTimeout();
        this.updateLastActivity();
      }, { passive: true });
    });

    // Also listen for visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkTokenExpiration();
      }
    });
  }

  // Show warning before session expires
  showSessionWarning() {
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.id = 'session-warning-modal';
    warningModal.innerHTML = `
      <div class="session-warning-overlay">
        <div class="session-warning-content">
          <div class="session-warning-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>Session Expiring Soon</h3>
          <p>Your session will expire in 2 minutes due to inactivity. Click "Stay Logged In" to continue your session.</p>
          <div class="session-warning-actions">
            <button id="extend-session" class="btn-primary">Stay Logged In</button>
            <button id="logout-now" class="btn-secondary">Logout Now</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      .session-warning-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(8px);
      }
      
      .session-warning-content {
        background: var(--bg-card, #1e1e1e);
        border: 1px solid var(--border-color, #374151);
        border-radius: 16px;
        padding: 2rem;
        max-width: 450px;
        width: 90%;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }
      
      .session-warning-icon {
        margin-bottom: 1rem;
      }
      
      .session-warning-content h3 {
        color: var(--text-primary, #ffffff);
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }
      
      .session-warning-content p {
        color: var(--text-secondary, #e5e7eb);
        line-height: 1.6;
        margin-bottom: 1.5rem;
      }
      
      .session-warning-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .btn-primary, .btn-secondary {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 120px;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(139, 92, 246, 0.3);
      }
      
      .btn-secondary {
        background: transparent;
        border: 2px solid var(--border-color, #374151);
        color: var(--text-secondary, #e5e7eb);
      }
      
      .btn-secondary:hover {
        border-color: #8b5cf6;
        color: #8b5cf6;
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(warningModal);

    // Add event listeners
    document.getElementById('extend-session').addEventListener('click', () => {
      this.extendSession();
      warningModal.remove();
    });

    document.getElementById('logout-now').addEventListener('click', () => {
      this.forceLogout('User chose to logout');
      warningModal.remove();
    });
  }

  // Extend session by refreshing token
  async extendSession() {
    try {
      const response = await fetch('https://json4ai.onrender.com/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', this.accessToken);
        
        // Update navigation UI
        this.updateNavigationUI();
        
        // Reset session monitoring
        this.resetSessionTimeout();
        
        // Show success message
        this.showNotification('Session extended successfully', 'success');
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Session extension failed:', error);
      this.forceLogout('Failed to extend session');
    }
  }

  // Force logout
  forceLogout(reason = 'Session expired') {
    // Clear all timeouts
    if (this.activityTimeout) clearTimeout(this.activityTimeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);

    // Clear tokens and user data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    this.accessToken = null;
    this.refreshToken = null;
    this.userData = null;

    // Update UI
    this.updateNavigationUI();

    // Show logout message
    this.showNotification(`Logged out: ${reason}`, 'info');

    // Redirect to home page
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
      window.location.href = '/index.html';
    }
  }

  // Update navigation UI based on login status
  updateNavigationUI() {
    const loginLink = document.getElementById('login-link');
    const dashLink = document.getElementById('dashboard-link');
    
    if (this.isLoggedIn()) {
      if (loginLink) loginLink.classList.add('hidden');
      if (dashLink) dashLink.classList.remove('hidden');
    } else {
      if (loginLink) loginLink.classList.remove('hidden');
      if (dashLink) dashLink.classList.add('hidden');
    }
  }

  // Check if token is expired
  checkTokenExpiration() {
    if (!this.accessToken) return;

    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < currentTime) {
        // Token expired, try to refresh
        this.refreshAccessToken();
      }
    } catch (error) {
      console.error('Error checking token expiration:', error);
      this.forceLogout('Invalid token format');
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      const response = await fetch('https://json4ai.onrender.com/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', this.accessToken);
        
        // Update navigation UI
        this.updateNavigationUI();
        
        // Reset session monitoring
        this.resetSessionTimeout();
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.forceLogout('Token refresh failed');
    } finally {
      this.isRefreshing = false;
    }
  }

  // Update last activity timestamp
  updateLastActivity() {
    if (this.accessToken) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }
  }
  
  // Refresh user plan data
  async refreshUserPlan() {
    try {
      if (!this.accessToken) return null;
      
      const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
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
      }
    } catch (error) {
      console.error('Error refreshing user plan:', error);
    }
    return null;
  }
  
  // Get current user plan
  getCurrentPlan() {
    const userPlan = localStorage.getItem('userPlan');
    if (userPlan) {
      try {
          return JSON.parse(userPlan);
      } catch (e) {
        console.error('Error parsing user plan:', e);
      }
    }
    return null;
  }

  // Show notification
  showNotification(message, type = 'info') {
    // Check if notification system exists
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
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
    }
  }

  // Get current access token
  getAccessToken() {
    return this.accessToken;
  }

  // Check if user is logged in
  isLoggedIn() {
    return !!(this.accessToken && this.refreshToken);
  }

  // Get user data
  getUserData() {
    if (this.userData) {
      try {
        return JSON.parse(this.userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  // Manual logout
  async logout() {
    try {
      if (this.refreshToken) {
        const response = await fetch('https://json4ai.onrender.com/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: this.refreshToken })
        });
        
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.forceLogout('User logged out');
    }
  }
}

// Initialize session manager
const sessionManager = new SessionManager();

// Export for use in other files
window.sessionManager = sessionManager;

// Add debug logging
console.log('SessionManager initialized:', {
  hasAccessToken: !!sessionManager.accessToken,
  hasRefreshToken: !!sessionManager.refreshToken,
  isLoggedIn: sessionManager.isLoggedIn()
});