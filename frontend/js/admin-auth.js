/**
 * Enhanced Admin Authentication
 * Provides secure admin login with additional security layers
 */

class AdminAuth {
    constructor() {
        this.adminSessionId = null;
        this.adminToken = null;
        this.sessionTimeout = null;
        this.heartbeatInterval = null;
    }

    // Admin Login with Enhanced Security
    async adminLogin(email, password) {
        try {
            const response = await fetch('/api/admin/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store admin tokens separately from regular user tokens
                localStorage.setItem('adminAccessToken', data.accessToken);
                localStorage.setItem('adminRefreshToken', data.refreshToken);
                localStorage.setItem('adminSessionId', data.sessionId);
                localStorage.setItem('adminUserData', JSON.stringify(data.user));

                this.adminSessionId = data.sessionId;
                this.adminToken = data.accessToken;

                // Start admin session monitoring
                this.startAdminSessionMonitoring();

                // Start heartbeat to keep session alive
                this.startHeartbeat();

                return {
                    success: true,
                    user: data.user,
                    sessionId: data.sessionId,
                    security: data.security
                };
            } else {
                throw new Error(data.message || 'Admin login failed');
            }
        } catch (error) {
            // Admin login error handled silently
            throw error;
        }
    }

    // Check Admin Authentication
    isAdminAuthenticated() {
        const adminToken = localStorage.getItem('adminAccessToken');
        const adminSessionId = localStorage.getItem('adminSessionId');
        
        if (!adminToken || !adminSessionId) {
            return false;
        }

        // Check if token is expired
        try {
            const payload = JSON.parse(atob(adminToken.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < currentTime) {
                this.clearAdminSession();
                return false;
            }

            // Check if it's an admin token
            if (!payload.isAdmin || payload.role !== 'super_admin') {
                this.clearAdminSession();
                return false;
            }

            return true;
        } catch (error) {
            // Token check error handled silently
            this.clearAdminSession();
            return false;
        }
    }

    // Get Admin User Data
    getAdminUserData() {
        const adminUserData = localStorage.getItem('adminUserData');
        if (adminUserData) {
            try {
                return JSON.parse(adminUserData);
            } catch (error) {
                // User data parsing error handled silently
                return null;
            }
        }
        return null;
    }

    // Start Admin Session Monitoring
    startAdminSessionMonitoring() {
        // Check session status every 5 minutes
        this.sessionTimeout = setInterval(async () => {
            try {
                const response = await fetch('/api/admin/admin-session-status', {
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`,
                        'X-Admin-Session-Id': this.adminSessionId
                    }
                });

                if (!response.ok) {
                    // Admin session invalid
                    this.adminLogout();
                }
            } catch (error) {
                // Session check failed
                this.adminLogout();
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Start Heartbeat
    startHeartbeat() {
        // Send heartbeat every 10 minutes to keep session alive
        this.heartbeatInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/admin/admin-session-status', {
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`,
                        'X-Admin-Session-Id': this.adminSessionId
                    }
                });

                if (!response.ok) {
                    // Session heartbeat failed
                    this.adminLogout();
                }
            } catch (error) {
                // Session heartbeat error
                this.adminLogout();
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    // Admin Logout
    async adminLogout() {
        try {
            if (this.adminSessionId) {
                await fetch('/api/admin/admin-logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`,
                        'X-Admin-Session-Id': this.adminSessionId,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            // Logout request failed
        } finally {
            this.clearAdminSession();
        }
    }

    // Clear Admin Session
    clearAdminSession() {
        // Clear admin-specific storage
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminSessionId');
        localStorage.removeItem('adminUserData');

        // Clear intervals
        if (this.sessionTimeout) {
            clearInterval(this.sessionTimeout);
            this.sessionTimeout = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        this.adminSessionId = null;
        this.adminToken = null;

        // Redirect to admin login
        window.location.href = '/admin-login.html';
    }

    // Get Admin Access Token
    getAdminAccessToken() {
        return localStorage.getItem('adminAccessToken');
    }

    // Refresh Admin Token
    async refreshAdminToken() {
        try {
            const refreshToken = localStorage.getItem('adminRefreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch('/api/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('adminAccessToken', data.accessToken);
                this.adminToken = data.accessToken;
                return data.accessToken;
            } else {
                throw new Error(data.message || 'Token refresh failed');
            }
        } catch (error) {
            // Token refresh failed
            this.clearAdminSession();
            throw error;
        }
    }

    // Make Authenticated Admin Request
    async makeAdminRequest(url, options = {}) {
        let token = this.getAdminAccessToken();
        
        // Check if token is expired and refresh if needed
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < currentTime + 300) { // Refresh if expires in 5 minutes
                token = await this.refreshAdminToken();
            }
        } catch (error) {
            // Token expiration check error
            token = await this.refreshAdminToken();
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Admin-Session-Id': this.adminSessionId,
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        return fetch(url, mergedOptions);
    }

    // Get Admin Activity Log
    async getAdminActivityLog(limit = 100) {
        try {
            const response = await this.makeAdminRequest(`/api/admin/admin-activity-log?limit=${limit}`);
            const data = await response.json();

            if (response.ok && data.success) {
                return data.activityLog;
            } else {
                throw new Error(data.message || 'Failed to get admin activity log');
            }
        } catch (error) {
            // Activity log error
            throw error;
        }
    }
}

// Create singleton instance
const adminAuth = new AdminAuth();

// Export for use in other files
window.adminAuth = adminAuth;

// Auto-initialize admin session if admin tokens exist
document.addEventListener('DOMContentLoaded', () => {
    if (adminAuth.isAdminAuthenticated()) {
        adminAuth.startAdminSessionMonitoring();
        adminAuth.startHeartbeat();
    }
});

// Export class for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminAuth;
}
