const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Enhanced Admin Security Middleware
 * Provides additional security layers for admin access
 */

class AdminSecurityManager {
  constructor() {
    this.adminSessions = new Map();
    this.failedAttempts = new Map();
    this.ipWhitelist = new Set();
    this.adminActivityLog = [];
  }

  // IP Whitelist Management
  addToIPWhitelist(ip) {
    this.ipWhitelist.add(ip);
  }

  removeFromIPWhitelist(ip) {
    this.ipWhitelist.delete(ip);
  }

  isIPWhitelisted(ip) {
    return this.ipWhitelist.has(ip);
  }

  // Enhanced Admin Authentication
  async verifyAdminAccess(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const userId = req.user._id;

      // 1. IP Whitelist Check (if enabled)
      if (process.env.ADMIN_IP_WHITELIST === 'true' && !this.isIPWhitelisted(ip)) {
        this.logAdminActivity('IP_NOT_WHITELISTED', {
          ip,
          userId,
          userAgent,
          timestamp: new Date()
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied: IP not whitelisted for admin access',
          code: 'IP_NOT_WHITELISTED'
        });
      }

      // 2. Admin Session Validation
      const sessionId = this.generateSessionId(req.user._id, ip);
      if (!this.adminSessions.has(sessionId)) {
        this.logAdminActivity('INVALID_ADMIN_SESSION', {
          ip,
          userId,
          userAgent,
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid admin session',
          code: 'INVALID_ADMIN_SESSION'
        });
      }

      // 3. Session Activity Check
      const session = this.adminSessions.get(sessionId);
      const now = Date.now();
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes

      if (now - session.lastActivity > sessionTimeout) {
        this.adminSessions.delete(sessionId);
        this.logAdminActivity('ADMIN_SESSION_EXPIRED', {
          ip,
          userId,
          userAgent,
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'Admin session expired',
          code: 'ADMIN_SESSION_EXPIRED'
        });
      }

      // 4. Update session activity
      session.lastActivity = now;
      session.requestCount++;

      // 5. Rate limiting for admin actions
      if (session.requestCount > 100) { // 100 requests per session
        this.logAdminActivity('ADMIN_RATE_LIMIT_EXCEEDED', {
          ip,
          userId,
          userAgent,
          requestCount: session.requestCount,
          timestamp: new Date()
        });
        return res.status(429).json({
          success: false,
          message: 'Admin rate limit exceeded',
          code: 'ADMIN_RATE_LIMIT_EXCEEDED'
        });
      }

      // 6. Log admin activity
      this.logAdminActivity('ADMIN_ACCESS', {
        ip,
        userId,
        userAgent,
        endpoint: req.path,
        method: req.method,
        timestamp: new Date()
      });

      req.adminSession = session;
      next();

    } catch (error) {
      console.error('Admin security verification failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Admin security verification failed',
        code: 'ADMIN_SECURITY_ERROR'
      });
    }
  }

  // Create Admin Session
  createAdminSession(userId, ip, userAgent) {
    const sessionId = this.generateSessionId(userId, ip);
    const session = {
      id: sessionId,
      userId,
      ip,
      userAgent,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requestCount: 0,
      isActive: true
    };

    this.adminSessions.set(sessionId, session);
    this.logAdminActivity('ADMIN_SESSION_CREATED', {
      ip,
      userId,
      userAgent,
      sessionId,
      timestamp: new Date()
    });

    return sessionId;
  }

  // Generate Secure Session ID
  generateSessionId(userId, ip) {
    const data = `${userId}-${ip}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Log Admin Activity
  logAdminActivity(action, details) {
    const logEntry = {
      action,
      details,
      timestamp: new Date().toISOString()
    };

    this.adminActivityLog.push(logEntry);

    // Keep only last 1000 entries
    if (this.adminActivityLog.length > 1000) {
      this.adminActivityLog = this.adminActivityLog.slice(-1000);
    }

    // Log to console in production
    if (process.env.NODE_ENV === 'production') {
      console.log('ADMIN_ACTIVITY:', JSON.stringify(logEntry));
    }
  }

  // Get Admin Activity Log
  getAdminActivityLog(limit = 100) {
    return this.adminActivityLog.slice(-limit);
  }

  // Clear Admin Session
  clearAdminSession(sessionId) {
    if (this.adminSessions.has(sessionId)) {
      const session = this.adminSessions.get(sessionId);
      this.logAdminActivity('ADMIN_SESSION_CLEARED', {
        sessionId,
        userId: session.userId,
        ip: session.ip,
        timestamp: new Date()
      });
      this.adminSessions.delete(sessionId);
    }
  }

  // Clear All Admin Sessions
  clearAllAdminSessions() {
    this.adminSessions.clear();
    this.logAdminActivity('ALL_ADMIN_SESSIONS_CLEARED', {
      timestamp: new Date()
    });
  }

  // Get Active Admin Sessions
  getActiveAdminSessions() {
    const activeSessions = [];
    for (const [sessionId, session] of this.adminSessions) {
      if (session.isActive) {
        activeSessions.push({
          sessionId,
          userId: session.userId,
          ip: session.ip,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          requestCount: session.requestCount
        });
      }
    }
    return activeSessions;
  }

  // MFA Verification (placeholder for future implementation)
  async verifyMFA(userId, token) {
    // This would integrate with your MFA system
    // For now, return true if MFA is disabled
    return process.env.ADMIN_MFA_REQUIRED !== 'true';
  }

  // Device Verification
  async verifyAdminDevice(req, userId) {
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    const userAgent = req.headers['user-agent'];
    
    // This would check against known admin devices
    // For now, return true if device verification is disabled
    return process.env.ADMIN_DEVICE_VERIFICATION !== 'true';
  }
}

// Create singleton instance
const adminSecurityManager = new AdminSecurityManager();

// Middleware for admin routes
const adminSecurityMiddleware = async (req, res, next) => {
  // Check if user is super admin
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Admin privileges required.',
      code: 'INSUFFICIENT_PRIVILEGES'
    });
  }

  // Apply enhanced admin security
  await adminSecurityManager.verifyAdminAccess(req, res, next);
};

// Admin login middleware
const createAdminSession = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const userId = req.user._id;

    // Create admin session
    const sessionId = adminSecurityManager.createAdminSession(userId, ip, userAgent);
    
    // Add session ID to response
    res.locals.adminSessionId = sessionId;
    
    next();
  } catch (error) {
    console.error('Failed to create admin session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin session',
      code: 'ADMIN_SESSION_ERROR'
    });
  }
};

module.exports = {
  AdminSecurityManager,
  adminSecurityManager,
  adminSecurityMiddleware,
  createAdminSession
};
