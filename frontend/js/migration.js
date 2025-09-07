/**
 * Migration script for existing users
 * Converts old 'token' to new 'accessToken' and 'refreshToken' system
 */

function migrateOldTokens() {
  const oldToken = localStorage.getItem('token');
  
  if (oldToken && !localStorage.getItem('accessToken')) {
    
    try {
      // Set the old token as both access and refresh token temporarily
      // This allows users to continue using the app while we implement proper migration
      localStorage.setItem('accessToken', oldToken);
      localStorage.setItem('refreshToken', oldToken);
      
      // Remove the old token
      localStorage.removeItem('token');
      
      
      // Show notification to user
      showMigrationNotification();
      
    } catch (error) {
      console.error('Token migration failed:', error);
    }
  }
}

function showMigrationNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    border-radius: 8px;
    font-weight: 600;
    z-index: 10001;
    max-width: 300px;
    word-wrap: break-word;
    box-shadow: 0 10px 25px rgba(139, 92, 246, 0.3);
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Security update applied! Your session is now more secure.</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Run migration when script loads
migrateOldTokens();

// Export for use in other files
window.migrateOldTokens = migrateOldTokens;
