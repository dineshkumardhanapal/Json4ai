const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Super Admin middleware - only super_admin role can access
const superAdminAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Super Admin privileges required.' 
      });
    }
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Dashboard Analytics Endpoints

// Get comprehensive dashboard overview
router.get('/dashboard/overview', auth, superAdminAuth, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User Statistics
    const totalUsers = await User.countDocuments();
    const newUsers24h = await User.countDocuments({ createdAt: { $gte: last24h } });
    const newUsers7d = await User.countDocuments({ createdAt: { $gte: last7d } });
    const newUsers30d = await User.countDocuments({ createdAt: { $gte: last30d } });
    
    // Active Users (logged in within last 24h)
    const activeUsers24h = await User.countDocuments({ 
      'activeSessions.lastActivity': { $gte: last24h } 
    });
    
    // User Role Distribution
    const roleDistribution = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Subscription Statistics
    const premiumUsers = await User.countDocuments({ 
      subscriptionStatus: 'active',
      subscriptionPlan: { $in: ['premium', 'starter'] }
    });
    
    const freeUsers = await User.countDocuments({ 
      subscriptionStatus: { $in: ['inactive', null] }
    });

    // Security Statistics
    const lockedAccounts = await User.countDocuments({ 
      'securityStatus.accountLocked': true 
    });
    
    const mfaEnabledUsers = await User.countDocuments({ 
      mfaEnabled: true 
    });

    // Recent Activity
    const recentRegistrations = await User.find({ createdAt: { $gte: last7d } })
      .select('firstName lastName email role createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentLogins = await User.find({ 
      'activeSessions.lastActivity': { $gte: last24h } 
    })
      .select('firstName lastName email role activeSessions')
      .sort({ 'activeSessions.lastActivity': -1 })
      .limit(10);

    // System Health
    const systemHealth = {
      database: 'connected',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: now
    };

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsers24h,
          newUsers7d,
          newUsers30d,
          activeUsers24h,
          premiumUsers,
          freeUsers,
          lockedAccounts,
          mfaEnabledUsers
        },
        roleDistribution,
        recentRegistrations,
        recentLogins,
        systemHealth
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard overview',
      error: error.message 
    });
  }
});

// Get detailed user analytics
router.get('/analytics/users', auth, superAdminAuth, async (req, res) => {
  try {
    const { period = '30d', page = 1, limit = 50 } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case '90d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
        break;
    }

    // User Growth Over Time
    const userGrowth = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // User Demographics
    const userDemographics = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            role: '$role',
            subscriptionStatus: '$subscriptionStatus'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Geographic Distribution
    const geographicDistribution = await User.aggregate([
      { $match: { 'lastKnownLocation.country': { $exists: true } } },
      {
        $group: {
          _id: '$lastKnownLocation.country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Device Statistics
    const deviceStats = await User.aggregate([
      { $match: { 'trustedDevices': { $exists: true, $ne: [] } } },
      { $unwind: '$trustedDevices' },
      {
        $group: {
          _id: '$trustedDevices.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Paginated User List
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(dateFilter)
      .select('firstName lastName email role subscriptionStatus createdAt lastLogin activeSessions securityStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(dateFilter);

    res.json({
      success: true,
      data: {
        userGrowth,
        userDemographics,
        geographicDistribution,
        deviceStats,
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
          totalUsers,
          hasNext: skip + parseInt(limit) < totalUsers,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user analytics',
      error: error.message 
    });
  }
});

// Get subscription analytics
router.get('/analytics/subscriptions', auth, superAdminAuth, async (req, res) => {
  try {
    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Subscription Revenue Analytics
    const revenueAnalytics = await User.aggregate([
      { $match: { subscriptionStatus: 'active' } },
      {
        $group: {
          _id: '$subscriptionPlan',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$subscriptionAmount' }
        }
      }
    ]);

    // Monthly Revenue Trend
    const monthlyRevenue = await User.aggregate([
      { $match: { subscriptionStatus: 'active' } },
      {
        $group: {
          _id: {
            year: { $year: '$subscriptionStartDate' },
            month: { $month: '$subscriptionStartDate' }
          },
          revenue: { $sum: '$subscriptionAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Subscription Status Distribution
    const subscriptionStatus = await User.aggregate([
      {
        $group: {
          _id: '$subscriptionStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent Subscriptions
    const recentSubscriptions = await User.find({ 
      subscriptionStatus: 'active',
      subscriptionStartDate: { $gte: last30d }
    })
      .select('firstName lastName email subscriptionPlan subscriptionAmount subscriptionStartDate')
      .sort({ subscriptionStartDate: -1 })
      .limit(20);

    // Churn Analysis
    const churnedUsers = await User.find({ 
      subscriptionStatus: 'cancelled',
      subscriptionEndDate: { $gte: last30d }
    })
      .select('firstName lastName email subscriptionPlan subscriptionEndDate')
      .sort({ subscriptionEndDate: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        revenueAnalytics,
        monthlyRevenue,
        subscriptionStatus,
        recentSubscriptions,
        churnedUsers
      }
    });
  } catch (error) {
    console.error('Subscription analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subscription analytics',
      error: error.message 
    });
  }
});

// Get security analytics
router.get('/analytics/security', auth, superAdminAuth, async (req, res) => {
  try {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Security Incidents
    const securityIncidents = await User.find({
      'securityStatus.securityFlags': { $exists: true, $ne: [] }
    })
      .select('firstName lastName email securityStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    // Account Lockouts
    const lockedAccounts = await User.find({
      'securityStatus.accountLocked': true
    })
      .select('firstName lastName email securityStatus createdAt')
      .sort({ createdAt: -1 });

    // MFA Adoption
    const mfaStats = await User.aggregate([
      {
        $group: {
          _id: '$mfaEnabled',
          count: { $sum: 1 }
        }
      }
    ]);

    // Risk Score Distribution
    const riskDistribution = await User.aggregate([
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$securityStatus.riskScore', 25] }, then: 'Low' },
                { case: { $lt: ['$securityStatus.riskScore', 50] }, then: 'Medium' },
                { case: { $lt: ['$securityStatus.riskScore', 75] }, then: 'High' },
                { case: { $gte: ['$securityStatus.riskScore', 75] }, then: 'Critical' }
              ],
              default: 'Unknown'
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Failed Login Attempts
    const failedLogins = await User.find({
      'securityStatus.securityFlags': { $in: ['failed_login'] }
    })
      .select('firstName lastName email securityStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        securityIncidents,
        lockedAccounts,
        mfaStats,
        riskDistribution,
        failedLogins
      }
    });
  } catch (error) {
    console.error('Security analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch security analytics',
      error: error.message 
    });
  }
});

// User Management Endpoints

// Get all users with advanced filtering
router.get('/users', auth, superAdminAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      role, 
      subscriptionStatus, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let filter = {};
    
    if (role) filter.role = role;
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const users = await User.find(filter)
      .select('-password -passwordSalt -passwordHistory -mfaSecret -mfaBackupCodes')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / parseInt(limit)),
          totalUsers,
          hasNext: skip + parseInt(limit) < totalUsers,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// Get user details
router.get('/users/:userId', auth, superAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }

    const user = await User.findById(userId)
      .select('-password -passwordSalt -passwordHistory -mfaSecret -mfaBackupCodes');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user details',
      error: error.message 
    });
  }
});

// Update user role
router.put('/users/:userId/role', auth, superAdminAuth, [
  body('role').isIn(['super_admin', 'admin', 'moderator', 'premium_user', 'standard_user', 'free_user', 'suspended_user'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { userId } = req.params;
    const { role } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        role,
        'securityStatus.lastRoleChange': new Date(),
        'securityStatus.roleChangedBy': req.user.id
      },
      { new: true }
    ).select('-password -passwordSalt -passwordHistory -mfaSecret -mfaBackupCodes');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user role',
      error: error.message 
    });
  }
});

// Suspend/Unsuspend user
router.put('/users/:userId/suspend', auth, superAdminAuth, [
  body('suspended').isBoolean(),
  body('reason').optional().isString().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { userId } = req.params;
    const { suspended, reason } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }

    const updateData = {
      'securityStatus.accountLocked': suspended,
      'securityStatus.lockReason': reason || (suspended ? 'Account suspended by admin' : 'Account unsuspended by admin'),
      'securityStatus.lastSuspensionChange': new Date(),
      'securityStatus.suspendedBy': req.user.id
    };

    if (suspended) {
      updateData.role = 'suspended_user';
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password -passwordSalt -passwordHistory -mfaSecret -mfaBackupCodes');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: `User ${suspended ? 'suspended' : 'unsuspended'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user suspension status',
      error: error.message 
    });
  }
});

// System Management Endpoints

// Get system health
router.get('/system/health', auth, superAdminAuth, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      database: 'connected'
    };

    // Check database connection
    try {
      await mongoose.connection.db.admin().ping();
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'degraded';
    }

    res.json({
      success: true,
      data: { health }
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch system health',
      error: error.message 
    });
  }
});

// Get system logs
router.get('/system/logs', auth, superAdminAuth, async (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    // This would typically come from a logging system
    // For now, we'll return a placeholder
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'System health check completed',
        source: 'system'
      },
      {
        timestamp: new Date(Date.now() - 60000),
        level: 'warn',
        message: 'High memory usage detected',
        source: 'monitor'
      }
    ];

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    console.error('System logs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch system logs',
      error: error.message 
    });
  }
});

module.exports = router;
