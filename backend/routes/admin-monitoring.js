const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { adminSecurityMiddleware } = require('../middleware/adminSecurity');
const mongoose = require('mongoose');

// Authentication & Access Monitoring
router.get('/security/auth-metrics', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Failed login attempts
    const failedLogins24h = await User.aggregate([
      { 
        $match: { 
          'securityStatus.lastFailedLogin': { $gte: last24h },
          'securityStatus.failedLoginAttempts': { $gt: 0 }
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalFailed: { $sum: '$securityStatus.failedLoginAttempts' },
          uniqueUsers: { $addToSet: '$_id' }
        } 
      },
      {
        $project: {
          totalFailed: 1,
          uniqueUsersAffected: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // MFA metrics
    const mfaStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          mfaEnabled: { $sum: { $cond: ['$mfaEnabled', 1, 0] } },
          mfaDisabled: { $sum: { $cond: ['$mfaEnabled', 0, 1] } }
        }
      }
    ]);

    // Password reset requests (last 7 days)
    const passwordResets = await User.countDocuments({
      'securityStatus.lastPasswordReset': { $gte: last7d }
    });

    // Account lockouts
    const lockedAccounts = await User.countDocuments({
      'securityStatus.accountLocked': true
    });

    // Suspicious login patterns
    const suspiciousLogins = await User.find({
      'securityStatus.riskScore': { $gte: 70 }
    }).select('email firstName lastName securityStatus.lastLogin securityStatus.riskScore').limit(10);

    res.json({
      success: true,
      data: {
        failedLogins: failedLogins24h[0] || { totalFailed: 0, uniqueUsersAffected: 0 },
        mfaStats: mfaStats[0] || { totalUsers: 0, mfaEnabled: 0, mfaDisabled: 0 },
        passwordResets,
        lockedAccounts,
        suspiciousLogins
      }
    });
  } catch (error) {
    console.error('Auth metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch auth metrics' });
  }
});

// User Activity Monitoring
router.get('/activity/user-activity', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Recent admin actions (mock data - implement actual audit log)
    const adminActions = [
      {
        id: 1,
        admin: 'Super Admin',
        action: 'User role updated',
        target: 'user@example.com',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        details: 'Changed role from user to premium'
      },
      {
        id: 2,
        admin: 'Super Admin',
        action: 'Account suspended',
        target: 'suspicious@example.com',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        details: 'Account suspended due to security violations'
      }
    ];

    // Data export requests (last 7 days)
    const dataExports = await User.countDocuments({
      'securityStatus.dataExportRequested': { $gte: last7d }
    });

    // API usage patterns
    const apiUsage = await User.aggregate([
      { $match: { lastLogin: { $gte: last7d } } },
      {
        $group: {
          _id: '$subscriptionPlan',
          userCount: { $sum: 1 },
          avgSessions: { $avg: '$behaviorPatterns.averageSessionDuration' }
        }
      }
    ]);

    // Top active users
    const topActiveUsers = await User.find({
      'activeSessions.lastActivity': { $gte: last24h }
    })
    .select('firstName lastName email subscriptionPlan activeSessions')
    .sort({ 'activeSessions.lastActivity': -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        adminActions,
        dataExports,
        apiUsage,
        topActiveUsers
      }
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user activity' });
  }
});

// System Health Monitoring
router.get('/system/health-metrics', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const os = require('os');
    const now = new Date();

    // System metrics
    const systemHealth = {
      timestamp: now,
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage(),
        total: os.totalmem(),
        free: os.freemem(),
        usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      platform: {
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };

    // Database health
    const dbStats = await mongoose.connection.db.stats();
    const dbHealth = {
      collections: dbStats.collections,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexes: dbStats.indexes,
      indexSize: dbStats.indexSize,
      avgObjSize: dbStats.avgObjSize
    };

    // API performance metrics (mock data)
    const apiMetrics = {
      averageResponseTime: Math.floor(Math.random() * 200) + 100, // 100-300ms
      errorRate: (Math.random() * 2).toFixed(2), // 0-2%
      totalRequests24h: Math.floor(Math.random() * 10000) + 5000,
      successRate: (98 + Math.random() * 2).toFixed(1),
      slowQueries: Math.floor(Math.random() * 10),
      dbConnections: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    };

    // Third-party service status (mock data)
    const serviceStatus = {
      mongodb: mongoose.connection.readyState === 1 ? 'healthy' : 'error',
      stripe: 'healthy',
      email: 'healthy',
      redis: 'healthy'
    };

    res.json({
      success: true,
      data: {
        systemHealth,
        dbHealth,
        apiMetrics,
        serviceStatus
      }
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch system health' });
  }
});

// Network & Threat Monitoring
router.get('/security/threat-metrics', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // High-risk users
    const highRiskUsers = await User.find({
      'securityStatus.riskScore': { $gte: 80 }
    }).select('email firstName lastName securityStatus.lastLogin securityStatus.riskScore').limit(10);

    // Geographic distribution of logins
    const geoDistribution = await User.aggregate([
      { $match: { lastLogin: { $gte: last24h } } },
      {
        $group: {
          _id: '$lastKnownLocation.country',
          count: { $sum: 1 },
          riskScore: { $avg: '$securityStatus.riskScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // IP-based threats (mock data - implement actual IP tracking)
    const ipThreats = [
      {
        ip: '192.168.1.100',
        country: 'Unknown',
        riskLevel: 'High',
        attempts: 15,
        lastSeen: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        reason: 'Multiple failed login attempts'
      }
    ];

    // Traffic anomalies (mock data)
    const trafficAnomalies = {
      normalTraffic: 1200,
      currentTraffic: 1800,
      anomalyScore: 85,
      peakTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      suspiciousPatterns: 3
    };

    res.json({
      success: true,
      data: {
        highRiskUsers,
        geoDistribution,
        ipThreats,
        trafficAnomalies
      }
    });
  } catch (error) {
    console.error('Threat metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch threat metrics' });
  }
});

// Business Intelligence & Revenue Analytics
router.get('/analytics/revenue-metrics', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Revenue metrics
    const revenueStats = await User.aggregate([
      { $match: { subscriptionStatus: 'active' } },
      {
        $group: {
          _id: null,
          mrr: { $sum: '$subscriptionAmount' },
          totalRevenue: { $sum: { $multiply: ['$subscriptionAmount', 12] } },
          avgRevenuePerUser: { $avg: '$subscriptionAmount' }
        }
      }
    ]);

    // Subscription metrics
    const subscriptionMetrics = await User.aggregate([
      {
        $group: {
          _id: '$subscriptionPlan',
          count: { $sum: 1 },
          revenue: { $sum: '$subscriptionAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Churn analysis
    const churnData = await User.aggregate([
      { $match: { subscriptionStatus: 'cancelled' } },
      {
        $group: {
          _id: {
            month: { $month: '$subscriptionEndDate' },
            year: { $year: '$subscriptionEndDate' }
          },
          churnedUsers: { $sum: 1 },
          lostRevenue: { $sum: '$subscriptionAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    // Conversion funnel
    const conversionFunnel = await User.aggregate([
      {
        $group: {
          _id: null,
          totalSignups: { $sum: 1 },
          freeUsers: { $sum: { $cond: [{ $eq: ['$subscriptionPlan', 'free'] }, 1, 0] } },
          starterUsers: { $sum: { $cond: [{ $eq: ['$subscriptionPlan', 'starter'] }, 1, 0] } },
          premiumUsers: { $sum: { $cond: [{ $eq: ['$subscriptionPlan', 'premium'] }, 1, 0] } }
        }
      }
    ]);

    // User acquisition sources (mock data)
    const acquisitionSources = [
      { source: 'Google', users: 45, conversion: 12 },
      { source: 'Direct', users: 32, conversion: 15 },
      { source: 'Social Media', users: 28, conversion: 8 },
      { source: 'Referral', users: 18, conversion: 22 },
      { source: 'Paid Ads', users: 25, conversion: 6 }
    ];

    res.json({
      success: true,
      data: {
        revenueStats: revenueStats[0] || { mrr: 0, totalRevenue: 0, avgRevenuePerUser: 0 },
        subscriptionMetrics,
        churnData,
        conversionFunnel: conversionFunnel[0] || { totalSignups: 0, freeUsers: 0, starterUsers: 0, premiumUsers: 0 },
        acquisitionSources
      }
    });
  } catch (error) {
    console.error('Revenue metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch revenue metrics' });
  }
});

// User Engagement Analytics
router.get('/analytics/engagement-metrics', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // DAU, WAU, MAU
    const dau = await User.countDocuments({
      'activeSessions.lastActivity': { 
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
      }
    });

    const wau = await User.countDocuments({
      'activeSessions.lastActivity': { $gte: last7d }
    });

    const mau = await User.countDocuments({
      'activeSessions.lastActivity': { $gte: last30d }
    });

    // User stickiness
    const stickiness = mau > 0 ? ((dau / mau) * 100).toFixed(1) : 0;

    // Feature usage (mock data - implement actual feature tracking)
    const featureUsage = [
      { feature: 'Prompt Generator', usage: 89, satisfaction: 4.2 },
      { feature: 'JSON Validator', usage: 76, satisfaction: 4.1 },
      { feature: 'API Integration', usage: 45, satisfaction: 3.8 },
      { feature: 'Export Tools', usage: 32, satisfaction: 4.0 },
      { feature: 'Team Collaboration', usage: 18, satisfaction: 3.9 }
    ];

    // Session analytics
    const sessionAnalytics = await User.aggregate([
      { $match: { 'activeSessions.lastActivity': { $gte: last7d } } },
      {
        $group: {
          _id: null,
          avgSessionDuration: { $avg: '$behaviorPatterns.averageSessionDuration' },
          totalSessions: { $sum: 1 }
        }
      }
    ]);

    // User retention cohorts (mock data)
    const retentionCohorts = [
      { cohort: 'Week 1', retention: 85 },
      { cohort: 'Week 2', retention: 72 },
      { cohort: 'Week 3', retention: 68 },
      { cohort: 'Week 4', retention: 61 },
      { cohort: 'Month 2', retention: 54 },
      { cohort: 'Month 3', retention: 47 }
    ];

    res.json({
      success: true,
      data: {
        dau,
        wau,
        mau,
        stickiness,
        featureUsage,
        sessionAnalytics: sessionAnalytics[0] || { avgSessionDuration: 0, totalSessions: 0 },
        retentionCohorts
      }
    });
  } catch (error) {
    console.error('Engagement metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch engagement metrics' });
  }
});

// Real-time alerts and notifications
router.get('/alerts/active-alerts', auth, adminSecurityMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Security alerts
    const securityAlerts = [
      {
        id: 1,
        type: 'security',
        severity: 'high',
        title: 'Multiple Failed Login Attempts',
        description: 'IP 192.168.1.100 has 15 failed login attempts in the last hour',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
        status: 'active'
      },
      {
        id: 2,
        type: 'security',
        severity: 'medium',
        title: 'High Risk User Detected',
        description: 'User john.doe@example.com has risk score of 85',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        status: 'active'
      }
    ];

    // System alerts
    const systemAlerts = [
      {
        id: 3,
        type: 'system',
        severity: 'low',
        title: 'High Memory Usage',
        description: 'Server memory usage is at 85%',
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        status: 'active'
      }
    ];

    // Business alerts
    const businessAlerts = [
      {
        id: 4,
        type: 'business',
        severity: 'medium',
        title: 'Revenue Drop Detected',
        description: 'Daily revenue is 15% below average',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        status: 'active'
      }
    ];

    const allAlerts = [...securityAlerts, ...systemAlerts, ...businessAlerts];

    res.json({
      success: true,
      data: {
        alerts: allAlerts,
        summary: {
          total: allAlerts.length,
          security: securityAlerts.length,
          system: systemAlerts.length,
          business: businessAlerts.length,
          high: allAlerts.filter(a => a.severity === 'high').length,
          medium: allAlerts.filter(a => a.severity === 'medium').length,
          low: allAlerts.filter(a => a.severity === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
});

module.exports = router;
