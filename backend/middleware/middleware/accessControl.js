const crypto = require('crypto');

// Comprehensive Access Control Matrix
const ACCESS_MATRIX = {
  // Resource definitions
  resources: {
    // User resources
    'user_profile': {
      description: 'User profile information',
      sensitivity: 'medium',
      ownerField: 'userId'
    },
    'user_settings': {
      description: 'User account settings',
      sensitivity: 'medium',
      ownerField: 'userId'
    },
    'user_payment': {
      description: 'User payment information',
      sensitivity: 'high',
      ownerField: 'userId'
    },
    'user_subscription': {
      description: 'User subscription data',
      sensitivity: 'high',
      ownerField: 'userId'
    },
    
    // Content resources
    'prompt_generation': {
      description: 'AI prompt generation',
      sensitivity: 'medium',
      ownerField: 'userId'
    },
    'generated_content': {
      description: 'Generated AI content',
      sensitivity: 'low',
      ownerField: 'userId'
    },
    'content_history': {
      description: 'User content history',
      sensitivity: 'medium',
      ownerField: 'userId'
    },
    
    // System resources
    'system_config': {
      description: 'System configuration',
      sensitivity: 'critical',
      ownerField: null
    },
    'user_management': {
      description: 'User management operations',
      sensitivity: 'critical',
      ownerField: null
    },
    'payment_processing': {
      description: 'Payment processing system',
      sensitivity: 'critical',
      ownerField: null
    },
    'analytics_data': {
      description: 'System analytics and metrics',
      sensitivity: 'high',
      ownerField: null
    },
    'security_logs': {
      description: 'Security audit logs',
      sensitivity: 'critical',
      ownerField: null
    }
  },
  
  // Role definitions with granular permissions
  roles: {
    'super_admin': {
      description: 'Super Administrator with full system access',
      level: 100,
      permissions: {
        '*': ['*'] // Full access to everything
      },
      restrictions: {
        maxConcurrentSessions: 5,
        requireMFA: true,
        sessionTimeout: 30, // minutes
        allowedIPs: [], // No IP restrictions
        workingHoursOnly: false
      }
    },
    
    'admin': {
      description: 'System Administrator',
      level: 90,
      permissions: {
        'user_management': ['read', 'write', 'delete'],
        'system_config': ['read', 'write'],
        'analytics_data': ['read'],
        'security_logs': ['read'],
        'payment_processing': ['read', 'write']
      },
      restrictions: {
        maxConcurrentSessions: 3,
        requireMFA: true,
        sessionTimeout: 60,
        allowedIPs: [],
        workingHoursOnly: false
      }
    },
    
    'moderator': {
      description: 'Content Moderator',
      level: 70,
      permissions: {
        'user_profile': ['read'],
        'generated_content': ['read', 'moderate'],
        'content_history': ['read'],
        'analytics_data': ['read']
      },
      restrictions: {
        maxConcurrentSessions: 2,
        requireMFA: false,
        sessionTimeout: 120,
        allowedIPs: [],
        workingHoursOnly: true
      }
    },
    
    'premium_user': {
      description: 'Premium Subscription User',
      level: 50,
      permissions: {
        'user_profile': ['read', 'write'],
        'user_settings': ['read', 'write'],
        'prompt_generation': ['read', 'write'],
        'generated_content': ['read', 'write', 'delete'],
        'content_history': ['read', 'write'],
        'user_subscription': ['read']
      },
      restrictions: {
        maxConcurrentSessions: 3,
        requireMFA: false,
        sessionTimeout: 240,
        allowedIPs: [],
        workingHoursOnly: false
      }
    },
    
    'standard_user': {
      description: 'Standard Subscription User',
      level: 30,
      permissions: {
        'user_profile': ['read', 'write'],
        'user_settings': ['read', 'write'],
        'prompt_generation': ['read', 'write'],
        'generated_content': ['read', 'write'],
        'content_history': ['read'],
        'user_subscription': ['read']
      },
      restrictions: {
        maxConcurrentSessions: 2,
        requireMFA: false,
        sessionTimeout: 180,
        allowedIPs: [],
        workingHoursOnly: false
      }
    },
    
    'free_user': {
      description: 'Free Tier User',
      level: 10,
      permissions: {
        'user_profile': ['read', 'write'],
        'user_settings': ['read', 'write'],
        'prompt_generation': ['read', 'write'],
        'generated_content': ['read'],
        'content_history': ['read']
      },
      restrictions: {
        maxConcurrentSessions: 1,
        requireMFA: false,
        sessionTimeout: 120,
        allowedIPs: [],
        workingHoursOnly: false
      }
    },
    
    'suspended_user': {
      description: 'Suspended User Account',
      level: 0,
      permissions: {
        'user_profile': ['read']
      },
      restrictions: {
        maxConcurrentSessions: 0,
        requireMFA: false,
        sessionTimeout: 0,
        allowedIPs: [],
        workingHoursOnly: true
      }
    }
  },
  
  // Action definitions
  actions: {
    'read': {
      description: 'Read access to resource',
      riskLevel: 'low',
      auditRequired: false
    },
    'write': {
      description: 'Create or update resource',
      riskLevel: 'medium',
      auditRequired: true
    },
    'delete': {
      description: 'Delete resource',
      riskLevel: 'high',
      auditRequired: true
    },
    'moderate': {
      description: 'Moderate content',
      riskLevel: 'medium',
      auditRequired: true
    },
    'admin': {
      description: 'Administrative operations',
      riskLevel: 'critical',
      auditRequired: true
    }
  }
};

// Access Control Manager
class AccessControlManager {
  // Main access control method
  static async checkAccess(user, action, resource, context = {}) {
    const evaluation = {
      allowed: false,
      reason: '',
      level: 0,
      restrictions: [],
      auditRequired: false,
      riskLevel: 'low'
    };
    
    try {
      // 1. Check if user is active
      if (!user.active || user.status === 'suspended') {
        evaluation.reason = 'User account is inactive or suspended';
        return evaluation;
      }
      
      // 2. Get user role
      const userRole = user.role || 'free_user';
      const roleConfig = ACCESS_MATRIX.roles[userRole];
      
      if (!roleConfig) {
        evaluation.reason = 'Invalid user role';
        return evaluation;
      }
      
      evaluation.level = roleConfig.level;
      
      // 3. Check role-based permissions
      const hasPermission = this.checkRolePermission(roleConfig, action, resource);
      if (!hasPermission) {
        evaluation.reason = `Role '${userRole}' does not have permission for '${action}' on '${resource}'`;
        return evaluation;
      }
      
      // 4. Check resource ownership
      const ownershipCheck = this.checkResourceOwnership(user, resource, context);
      if (!ownershipCheck.allowed) {
        evaluation.reason = ownershipCheck.reason;
        return evaluation;
      }
      
      // 5. Check resource sensitivity
      const sensitivityCheck = this.checkResourceSensitivity(userRole, resource, action);
      if (!sensitivityCheck.allowed) {
        evaluation.reason = sensitivityCheck.reason;
        evaluation.restrictions = sensitivityCheck.restrictions;
        return evaluation;
      }
      
      // 6. Check session restrictions
      const sessionCheck = this.checkSessionRestrictions(user, roleConfig, context);
      if (!sessionCheck.allowed) {
        evaluation.reason = sessionCheck.reason;
        evaluation.restrictions = sessionCheck.restrictions;
        return evaluation;
      }
      
      // 7. Check time-based restrictions
      const timeCheck = this.checkTimeRestrictions(roleConfig, context);
      if (!timeCheck.allowed) {
        evaluation.reason = timeCheck.reason;
        evaluation.restrictions = timeCheck.restrictions;
        return evaluation;
      }
      
      // 8. Check IP restrictions
      const ipCheck = this.checkIPRestrictions(user, roleConfig, context);
      if (!ipCheck.allowed) {
        evaluation.reason = ipCheck.reason;
        evaluation.restrictions = ipCheck.restrictions;
        return evaluation;
      }
      
      // 9. Check MFA requirements
      const mfaCheck = this.checkMFARequirements(user, roleConfig, action, resource);
      if (!mfaCheck.allowed) {
        evaluation.reason = mfaCheck.reason;
        evaluation.restrictions = mfaCheck.restrictions;
        return evaluation;
      }
      
      // 10. Determine audit requirements
      evaluation.auditRequired = this.isAuditRequired(action, resource, roleConfig);
      evaluation.riskLevel = this.calculateRiskLevel(action, resource, userRole);
      
      evaluation.allowed = true;
      evaluation.reason = 'Access granted';
      
      return evaluation;
    } catch (error) {
      console.error('Access control evaluation error:', error);
      evaluation.reason = 'Access control evaluation failed';
      return evaluation;
    }
  }
  
  // Check role-based permissions
  static checkRolePermission(roleConfig, action, resource) {
    const permissions = roleConfig.permissions;
    
    // Check for wildcard permissions
    if (permissions['*'] && permissions['*'].includes('*')) {
      return true;
    }
    
    // Check for resource-specific permissions
    if (permissions[resource] && permissions[resource].includes(action)) {
      return true;
    }
    
    // Check for wildcard resource permissions
    if (permissions[resource] && permissions[resource].includes('*')) {
      return true;
    }
    
    return false;
  }
  
  // Check resource ownership
  static checkResourceOwnership(user, resource, context) {
    const resourceConfig = ACCESS_MATRIX.resources[resource];
    
    if (!resourceConfig) {
      return { allowed: false, reason: 'Unknown resource' };
    }
    
    // If no owner field, it's a system resource
    if (!resourceConfig.ownerField) {
      return { allowed: true };
    }
    
    // Check if user owns the resource
    const resourceOwner = context[resourceConfig.ownerField];
    if (resourceOwner && resourceOwner.toString() !== user.id.toString()) {
      return { allowed: false, reason: 'Resource ownership violation' };
    }
    
    return { allowed: true };
  }
  
  // Check resource sensitivity
  static checkResourceSensitivity(userRole, resource, action) {
    const resourceConfig = ACCESS_MATRIX.resources[resource];
    const roleConfig = ACCESS_MATRIX.roles[userRole];
    
    if (!resourceConfig || !roleConfig) {
      return { allowed: false, reason: 'Invalid resource or role configuration' };
    }
    
    const sensitivity = resourceConfig.sensitivity;
    const roleLevel = roleConfig.level;
    
    // Define sensitivity levels
    const sensitivityLevels = {
      'low': 10,
      'medium': 30,
      'high': 60,
      'critical': 90
    };
    
    const requiredLevel = sensitivityLevels[sensitivity] || 0;
    
    if (roleLevel < requiredLevel) {
      return {
        allowed: false,
        reason: `Insufficient role level for ${sensitivity} sensitivity resource`,
        restrictions: ['role_upgrade']
      };
    }
    
    return { allowed: true };
  }
  
  // Check session restrictions
  static checkSessionRestrictions(user, roleConfig, context) {
    const activeSessions = user.activeSessions || [];
    const maxSessions = roleConfig.restrictions.maxConcurrentSessions;
    
    if (activeSessions.length >= maxSessions) {
      return {
        allowed: false,
        reason: 'Maximum concurrent sessions exceeded',
        restrictions: ['session_cleanup']
      };
    }
    
    return { allowed: true };
  }
  
  // Check time-based restrictions
  static checkTimeRestrictions(roleConfig, context) {
    if (!roleConfig.restrictions.workingHoursOnly) {
      return { allowed: true };
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = roleConfig.restrictions.workingHoursStart || 8;
    const endHour = roleConfig.restrictions.workingHoursEnd || 18;
    
    if (currentHour < startHour || currentHour > endHour) {
      return {
        allowed: false,
        reason: 'Access outside working hours',
        restrictions: ['working_hours_override']
      };
    }
    
    return { allowed: true };
  }
  
  // Check IP restrictions
  static checkIPRestrictions(user, roleConfig, context) {
    const allowedIPs = roleConfig.restrictions.allowedIPs;
    
    if (!allowedIPs || allowedIPs.length === 0) {
      return { allowed: true };
    }
    
    const clientIP = context.clientIP || '';
    
    if (!allowedIPs.includes(clientIP)) {
      return {
        allowed: false,
        reason: 'Access from unauthorized IP address',
        restrictions: ['ip_whitelist']
      };
    }
    
    return { allowed: true };
  }
  
  // Check MFA requirements
  static checkMFARequirements(user, roleConfig, action, resource) {
    if (!roleConfig.restrictions.requireMFA) {
      return { allowed: true };
    }
    
    const actionConfig = ACCESS_MATRIX.actions[action];
    const resourceConfig = ACCESS_MATRIX.resources[resource];
    
    // Require MFA for high-risk actions or sensitive resources
    const requiresMFA = actionConfig?.riskLevel === 'high' || 
                       actionConfig?.riskLevel === 'critical' ||
                       resourceConfig?.sensitivity === 'high' ||
                       resourceConfig?.sensitivity === 'critical';
    
    if (requiresMFA && !user.mfaEnabled) {
      return {
        allowed: false,
        reason: 'Multi-factor authentication required',
        restrictions: ['mfa_setup']
      };
    }
    
    if (requiresMFA && !context.mfaVerified) {
      return {
        allowed: false,
        reason: 'Multi-factor authentication verification required',
        restrictions: ['mfa_verification']
      };
    }
    
    return { allowed: true };
  }
  
  // Determine if audit is required
  static isAuditRequired(action, resource, roleConfig) {
    const actionConfig = ACCESS_MATRIX.actions[action];
    const resourceConfig = ACCESS_MATRIX.resources[resource];
    
    // Always audit critical actions
    if (actionConfig?.riskLevel === 'critical') {
      return true;
    }
    
    // Always audit critical resources
    if (resourceConfig?.sensitivity === 'critical') {
      return true;
    }
    
    // Audit based on action configuration
    if (actionConfig?.auditRequired) {
      return true;
    }
    
    // Audit admin roles
    if (roleConfig.level >= 90) {
      return true;
    }
    
    return false;
  }
  
  // Calculate risk level
  static calculateRiskLevel(action, resource, userRole) {
    const actionConfig = ACCESS_MATRIX.actions[action];
    const resourceConfig = ACCESS_MATRIX.resources[resource];
    const roleConfig = ACCESS_MATRIX.roles[userRole];
    
    let riskScore = 0;
    
    // Base risk from action
    const actionRisk = {
      'low': 10,
      'medium': 30,
      'high': 60,
      'critical': 90
    };
    
    riskScore += actionRisk[actionConfig?.riskLevel] || 10;
    
    // Base risk from resource sensitivity
    const resourceRisk = {
      'low': 5,
      'medium': 20,
      'high': 50,
      'critical': 80
    };
    
    riskScore += resourceRisk[resourceConfig?.sensitivity] || 5;
    
    // Adjust based on role level (higher role = lower risk)
    riskScore -= (roleConfig?.level || 10) * 0.5;
    
    // Normalize to risk levels
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }
  
  // Get user permissions summary
  static getUserPermissions(user) {
    const userRole = user.role || 'free_user';
    const roleConfig = ACCESS_MATRIX.roles[userRole];
    
    if (!roleConfig) {
      return {
        role: userRole,
        level: 0,
        permissions: {},
        restrictions: {}
      };
    }
    
    return {
      role: userRole,
      level: roleConfig.level,
      permissions: roleConfig.permissions,
      restrictions: roleConfig.restrictions,
      description: roleConfig.description
    };
  }
  
  // Check if user can perform action on resource
  static async canPerformAction(user, action, resource, context = {}) {
    const evaluation = await this.checkAccess(user, action, resource, context);
    return evaluation.allowed;
  }
  
  // Get accessible resources for user
  static getAccessibleResources(user) {
    const userRole = user.role || 'free_user';
    const roleConfig = ACCESS_MATRIX.roles[userRole];
    
    if (!roleConfig) {
      return [];
    }
    
    const accessibleResources = [];
    
    Object.keys(roleConfig.permissions).forEach(resource => {
      if (resource === '*') {
        // User has access to all resources
        accessibleResources.push(...Object.keys(ACCESS_MATRIX.resources));
      } else {
        accessibleResources.push(resource);
      }
    });
    
    return [...new Set(accessibleResources)]; // Remove duplicates
  }
  
  // Generate access token with embedded permissions
  static generateAccessToken(user, permissions) {
    const tokenData = {
      userId: user.id,
      role: user.role,
      permissions: permissions,
      level: ACCESS_MATRIX.roles[user.role]?.level || 0,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(tokenData))
      .digest('hex');
  }
}

// Access Control Middleware
const accessControlMiddleware = (action, resource) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }
      
      const context = {
        clientIP: req.ip,
        userAgent: req.headers['user-agent'],
        mfaVerified: req.mfaVerified || false,
        ...req.body // Include request body for ownership checks
      };
      
      const evaluation = await AccessControlManager.checkAccess(
        user, 
        action, 
        resource, 
        context
      );
      
      if (!evaluation.allowed) {
        console.warn('Access denied:', {
          userId: user.id,
          action,
          resource,
          reason: evaluation.reason,
          restrictions: evaluation.restrictions
        });
        
        return res.status(403).json({
          message: 'Access denied',
          code: 'ACCESS_DENIED',
          reason: evaluation.reason,
          restrictions: evaluation.restrictions
        });
      }
      
      // Add evaluation to request for audit logging
      req.accessEvaluation = evaluation;
      
      // Log access if audit required
      if (evaluation.auditRequired) {
        await this.logAccess(req, user, action, resource, evaluation);
      }
      
      next();
    } catch (error) {
      console.error('Access control middleware error:', error);
      res.status(500).json({
        message: 'Access control evaluation failed',
        code: 'ACCESS_CONTROL_ERROR'
      });
    }
  };
};

// Audit logging method
const logAccess = async (req, user, action, resource, evaluation) => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    userRole: user.role,
    action,
    resource,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    riskLevel: evaluation.riskLevel,
    sessionId: req.sessionID,
    success: evaluation.allowed
  };
  
  console.log('Access Audit Log:', auditLog);
  
  // In production, store in database
  // await AuditLog.create(auditLog);
};

module.exports = {
  AccessControlManager,
  accessControlMiddleware,
  ACCESS_MATRIX,
  logAccess
};
