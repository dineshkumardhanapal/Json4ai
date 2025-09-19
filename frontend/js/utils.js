// Utility functions

// Error boundary for async operations
const safeAsync = async (asyncFn, fallback = null) => {
  try {
    return await asyncFn();
  } catch (error) {
    // Handle error silently or show user-friendly message
    return fallback;
  }
};

// Debounce function for performance
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for scroll events
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Hamburger toggle (legacy - now handled by mobile-nav.js)
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}
// Update navigation UI based on login status
function updateNavigationUI() {
  const loginLink = document.getElementById('login-link');
  const dashLink = document.getElementById('dashboard-link');
  
  // Check if user is logged in using session manager
  if (window.sessionManager && window.sessionManager.isLoggedIn()) {
    if (loginLink) loginLink.classList.add('hidden');
    if (dashLink) dashLink.classList.remove('hidden');
  } else {
    if (loginLink) loginLink.classList.remove('hidden');
    if (dashLink) dashLink.classList.add('hidden');
  }
}

// Initialize navigation UI when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Wait for session manager to be available
  setTimeout(updateNavigationUI, 100);
  
  // Secure links that require authentication (e.g., Prompt Generator, Dashboard)
  const authLinks = Array.from(document.querySelectorAll('a[href$="prompt-generator.html"], a[href$="dashboard.html"], a[data-requires-auth="true"]'));
  const ensureAuthLinkState = () => {
    const isLoggedIn = !!(window.sessionManager && window.sessionManager.isLoggedIn());
    authLinks.forEach(link => {
      link.setAttribute('data-requires-auth', 'true');
      if (isLoggedIn) {
        // Restore real destination
        link.setAttribute('href', 'prompt-generator.html');
        link.classList.remove('locked');
        link.title = link.title && link.title.replace(/\s*\(Login required\)$/i, '');
      } else {
        // Point to login to avoid exposing the protected page URL directly
        link.setAttribute('href', 'login.html');
        link.classList.add('locked');
        if (!/\(Login required\)$/i.test(link.title || '')) {
          link.title = (link.title || 'Login required') + ' (Login required)';
        }
      }
    });
  };
  
  // Initial ensure
  ensureAuthLinkState();
  
  // Intercept clicks on auth-required links to enforce login without page flash
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a[data-requires-auth="true"]');
    if (!target) return;
    const isLoggedIn = !!(window.sessionManager && window.sessionManager.isLoggedIn());
    if (!isLoggedIn) {
      e.preventDefault();
      // Redirect explicitly to login
      window.location.href = 'login.html';
    }
  });
  
  // Re-evaluate links when session state might change
  window.addEventListener('storage', function(e) {
    if (e.key === 'accessToken' || e.key === 'refreshToken') {
      updateNavigationUI();
      ensureAuthLinkState();
    }
  });
  
  // Update navigation UI when session status changes
  if (window.sessionManager) {
    // Listen for storage changes (when tokens are cleared)
    window.addEventListener('storage', function(e) {
      if (e.key === 'accessToken' || e.key === 'refreshToken') {
        updateNavigationUI();
        ensureAuthLinkState();
      }
    });
  }
});

// Logo Slider Enhancement
document.addEventListener('DOMContentLoaded', function() {
  const logoSlider = document.querySelector('.logo-slider');
  const logoTrack = document.querySelector('.logo-track');
  
  if (logoSlider && logoTrack) {
    // Add touch/swipe support for mobile
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    logoSlider.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent default touch behavior
      startX = e.touches[0].clientX;
      isDragging = true;
      logoTrack.style.animationPlayState = 'paused';
    }, { passive: false });
    
    logoSlider.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent default scroll behavior
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      logoTrack.style.transform = `translateX(-${diff}px)`;
    }, { passive: false });
    
    logoSlider.addEventListener('touchend', (e) => {
      e.preventDefault();
      isDragging = false;
      logoTrack.style.transform = '';
      logoTrack.style.animationPlayState = 'running';
    }, { passive: false });
    
    // Add mouse drag support for desktop
    logoSlider.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent text selection
      startX = e.clientX;
      isDragging = true;
      logoTrack.style.animationPlayState = 'paused';
      logoSlider.style.cursor = 'grabbing';
    });
    
    logoSlider.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent default behavior
      currentX = e.clientX;
      const diff = startX - currentX;
      logoTrack.style.transform = `translateX(-${diff}px)`;
    });
    
    logoSlider.addEventListener('mouseup', (e) => {
      e.preventDefault();
      isDragging = false;
      logoTrack.style.transform = '';
      logoTrack.style.animationPlayState = 'running';
      logoSlider.style.cursor = 'grab';
    });
    
    logoSlider.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        logoTrack.style.transform = '';
        logoTrack.style.animationPlayState = 'running';
        logoSlider.style.cursor = 'grab';
      }
    });
  }
});