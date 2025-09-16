// Configuration for API endpoints
const CONFIG = {
  // Backend API base URL
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : 'https://json4ai.onrender.com',
  
  // API endpoints
  ENDPOINTS: {
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/user/profile',
    USAGE: '/api/user/usage',
    REFRESH: '/api/refresh',
    LOGOUT: '/api/logout',
    HISTORY: '/api/prompt/history',
    PROMPT_USAGE: '/api/prompt/usage',
    CREATE_ORDER: '/api/payment/create-order',
    VERIFY_PAYMENT: '/api/payment/verify-payment',
    CREATE_SUBSCRIPTION: '/api/paypal/create-subscription',
    ADMIN_LOGIN: '/api/admin/admin-login',
    ADMIN_SESSION_STATUS: '/api/admin/admin-session-status',
    ADMIN_LOGOUT: '/api/admin/admin-logout',
    ADMIN_DASHBOARD: '/api/admin/dashboard/overview',
    ADMIN_SECURITY: '/api/admin/security/auth-metrics',
    ADMIN_SYSTEM: '/api/admin/system/health-metrics',
    ADMIN_ALERTS: '/api/admin/alerts/active-alerts',
    ADMIN_USERS: '/api/admin/users'
  }
};

// Helper function to get full API URL
function getApiUrl(endpoint) {
  return CONFIG.API_BASE_URL + endpoint;
}

// Legacy function for backward compatibility
function API(endpoint) {
  return getApiUrl(endpoint);
}
