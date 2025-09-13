const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { adminSecurityManager, createAdminSession } = require('../middleware/adminSecurity');
const { ZeroTrustManager } = require('../middleware/zeroTrust');

/**
 * Enhanced Admin Authentication Routes
 * Provides secure admin login with additional security layers
 */

// Admin Login with Enhanced Security
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // 1. Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // 2. Find admin user
    const user = await User.findOne({ email });
    if (!user) {
      adminSecurityManager.logAdminActivity('ADMIN_LOGIN_FAILED_USER_NOT_FOUND', {
        email,
        ip,
        userAgent,
        timestamp: new Date()
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 3. Check if user is super admin
    if (user.role !== 'super_admin') {
      adminSecurityManager.logAdminActivity('ADMIN_LOGIN_FAILED_NOT_ADMIN', {
        email,
        ip,
        userAgent,
        userId: user._id,
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    // 4. IP Whitelist Check (if enabled)
    if (process.env.ADMIN_IP_WHITELIST === 'true' && !adminSecurityManager.isIPWhitelisted(ip)) {
      adminSecurityManager.logAdminActivity('ADMIN_LOGIN_FAILED_IP_NOT_WHITELISTED', {
        email,
        ip,
        userAgent,
        userId: user._id,
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: IP not whitelisted for admin access',
        code: 'IP_NOT_WHITELISTED'
      });
    }

    // 5. Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      adminSecurityManager.logAdminActivity('ADMIN_LOGIN_FAILED_INVALID_PASSWORD', {
        email,
        ip,
        userAgent,
        userId: user._id,
        timestamp: new Date()
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 6. Zero Trust Evaluation
    const zeroTrustEvaluation = await ZeroTrustManager.evaluateAccess(req, user, 'admin_login', 'admin_panel');
    if (!zeroTrustEvaluation.allowed) {
      adminSecurityManager.logAdminActivity('ADMIN_LOGIN_FAILED_ZERO_TRUST', {
        email,
        ip,
        userAgent,
        userId: user._id,
        riskScore: zeroTrustEvaluation.riskScore,
        factors: zeroTrustEvaluation.factors,
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Login denied by security policy',
        code: 'ZERO_TRUST_DENIED',
        riskScore: zeroTrustEvaluation.riskScore
      });
    }

    // 7. Generate secure admin tokens
    const adminAccessToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role,
        isAdmin: true,
        sessionType: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' } // Short-lived admin tokens
    );

    const adminRefreshToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role,
        isAdmin: true,
        sessionType: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Admin refresh token
    );

    // 8. Create admin session
    const sessionId = adminSecurityManager.createAdminSession(user._id, ip, userAgent);

    // 9. Update user's last admin login
    await User.findByIdAndUpdate(user._id, {
      $set: {
        lastAdminLogin: new Date(),
        lastLoginIP: ip,
        lastLoginUserAgent: userAgent
      }
    });

    // 10. Log successful admin login
    adminSecurityManager.logAdminActivity('ADMIN_LOGIN_SUCCESS', {
      email,
      ip,
      userAgent,
      userId: user._id,
      sessionId,
      riskScore: zeroTrustEvaluation.riskScore,
      timestamp: new Date()
    });

    // 11. Return admin tokens and session info
    res.json({
      success: true,
      message: 'Admin login successful',
      accessToken: adminAccessToken,
      refreshToken: adminRefreshToken,
      sessionId,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        lastAdminLogin: user.lastAdminLogin
      },
      security: {
        riskScore: zeroTrustEvaluation.riskScore,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        requiresMFA: process.env.ADMIN_MFA_REQUIRED === 'true'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    adminSecurityManager.logAdminActivity('ADMIN_LOGIN_ERROR', {
      error: error.message,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });
    res.status(500).json({
      success: false,
      message: 'Admin authentication service temporarily unavailable',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
});

// Admin Logout
router.post('/admin-logout', auth, async (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session-id'];
    const ip = req.ip || req.connection.remoteAddress;

    if (sessionId) {
      adminSecurityManager.clearAdminSession(sessionId);
    }

    adminSecurityManager.logAdminActivity('ADMIN_LOGOUT', {
      userId: req.user._id,
      ip,
      sessionId,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Admin logout successful'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin logout failed',
      code: 'ADMIN_LOGOUT_ERROR'
    });
  }
});

// Get Admin Session Status
router.get('/admin-session-status', auth, async (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No admin session found',
        code: 'NO_ADMIN_SESSION'
      });
    }

    const activeSessions = adminSecurityManager.getActiveAdminSessions();
    const currentSession = activeSessions.find(s => s.sessionId === sessionId);

    if (!currentSession) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin session',
        code: 'INVALID_ADMIN_SESSION'
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        ip: currentSession.ip,
        createdAt: currentSession.createdAt,
        lastActivity: currentSession.lastActivity,
        requestCount: currentSession.requestCount,
        isActive: true
      }
    });

  } catch (error) {
    console.error('Admin session status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin session status',
      code: 'ADMIN_SESSION_STATUS_ERROR'
    });
  }
});

// Get Admin Activity Log
router.get('/admin-activity-log', auth, async (req, res) => {
  try {
    // Only super admin can access activity log
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super Admin privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const activityLog = adminSecurityManager.getAdminActivityLog(limit);

    res.json({
      success: true,
      activityLog,
      totalEntries: activityLog.length
    });

  } catch (error) {
    console.error('Admin activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin activity log',
      code: 'ADMIN_ACTIVITY_LOG_ERROR'
    });
  }
});

// Clear All Admin Sessions (Emergency)
router.post('/admin-clear-all-sessions', auth, async (req, res) => {
  try {
    // Only super admin can clear all sessions
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super Admin privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    adminSecurityManager.clearAllAdminSessions();

    res.json({
      success: true,
      message: 'All admin sessions cleared successfully'
    });

  } catch (error) {
    console.error('Clear all admin sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear admin sessions',
      code: 'CLEAR_ADMIN_SESSIONS_ERROR'
    });
  }
});

module.exports = router;
