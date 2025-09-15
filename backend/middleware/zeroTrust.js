const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const validator = require('validator');

// Zero Trust Security Configuration
const ZERO_TRUST_CONFIG = {
  // Authentication requirements
  REQUIRE_MFA: true,                    // Multi-factor authentication required
  REQUIRE_DEVICE_VERIFICATION: true,    // Device fingerprinting required
  REQUIRE_LOCATION_VERIFICATION: true,  // Location-based verification
  
  // Session security
  SESSION_TIMEOUT_MINUTES: 15,          // Short session timeout
  MAX_CONCURRENT_SESSIONS: 3,           // Maximum concurrent sessions per user
  REQUIRE_SESSION_REFRESH: true,        // Require periodic session refresh
  
  // Access control
  DEFAULT_DENY: true,                   // Default deny all access
  REQUIRE_EXPLICIT_PERMISSIONS: true,   // Require explicit permissions for all actions
  AUDIT_ALL_ACTIONS: true,              // Audit all user actions
  
  // Risk assessment
  RISK_SCORE_THRESHOLD: 70,             // Risk score threshold for additional verification
  SUSPICIOUS_ACTIVITY_THRESHOLD: 5,     // Threshold for suspicious activity detection
  
  // Device security
  REQUIRE_SECURE_DEVICE: true,          // Require secure device characteristics
  BLOCK_UNKNOWN_DEVICES: true,          // Block unknown devices by default
  
  // Network security
  REQUIRE_SECURE_CONNECTION: true,     // Require HTTPS/TLS
  BLOCK_TOR_NETWORKS: true,            // Block Tor networks
  BLOCK_VPN_NETWORKS: false,           // Allow VPN networks (configurable)
  
  // Time-based access
  WORKING_HOURS_ONLY: false,           // Restrict to working hours only
  WORKING_HOURS_START: 8,              // Working hours start (24-hour format)
  WORKING_HOURS_END: 18,               // Working hours end (24-hour format)
  TIMEZONE_TOLERANCE_HOURS: 2,         // Timezone tolerance for location verification
};

// Zero Trust Security Manager
class ZeroTrustManager {
  constructor() {
    this.riskFactors = new Map();
    this.deviceFingerprints = new Map();
    this.userSessions = new Map();
    this.accessLogs = [];
  }
  
  // Main access control method
  static async evaluateAccess(req, user, action, resource) {
    const evaluation = {
      allowed: false,
      riskScore: 0,
      factors: [],
      requirements: [],
      auditLog: {
        timestamp: new Date().toISOString(),
        userId: user.id,
        action,
        resource,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        riskScore: 0
      }
    };
    
    try {
      // 1. Device verification
      const deviceResult = await this.verifyDevice(req, user);
      evaluation.factors.push(deviceResult);
      evaluation.riskScore += deviceResult.riskScore;
      
      // 2. Location verification
      const locationResult = await this.verifyLocation(req, user);
      evaluation.factors.push(locationResult);
      evaluation.riskScore += locationResult.riskScore;
      
      // 3. Session verification
      const sessionResult = await this.verifySession(req, user);
      evaluation.factors.push(sessionResult);
      evaluation.riskScore += sessionResult.riskScore;
      
      // 4. Permission verification
      const permissionResult = await this.verifyPermissions(user, action, resource);
      evaluation.factors.push(permissionResult);
      evaluation.riskScore += permissionResult.riskScore;
      
      // 5. Risk assessment
      const riskResult = await this.assessRisk(req, user, action);
      evaluation.factors.push(riskResult);
      evaluation.riskScore += riskResult.riskScore;
      
      // 6. Time-based access control
      const timeResult = await this.verifyTimeAccess(req, user);
      evaluation.factors.push(timeResult);
      evaluation.riskScore += timeResult.riskScore;
      
      // 7. Network security verification
      const networkResult = await this.verifyNetworkSecurity(req);
      evaluation.factors.push(networkResult);
      evaluation.riskScore += networkResult.riskScore;
      
      // 8. Behavioral analysis
      const behaviorResult = await this.analyzeBehavior(req, user, action);
      evaluation.factors.push(behaviorResult);
      evaluation.riskScore += behaviorResult.riskScore;
      
      // Calculate final decision
      evaluation.allowed = this.calculateAccessDecision(evaluation);
      evaluation.auditLog.riskScore = evaluation.riskScore;
      
      // Log access attempt
      await this.logAccessAttempt(evaluation);
      
      return evaluation;
    } catch (error) {
      console.error('Zero Trust evaluation error:', error);
      evaluation.allowed = false;
      evaluation.riskScore = 100; // Maximum risk on error
      evaluation.factors.push({
        factor: 'system_error',
        riskScore: 100,
        message: 'System error during access evaluation'
      });
      
      return evaluation;
    }
  }
  
  // Device verification
  static async verifyDevice(req, user) {
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    const result = {
      factor: 'device_verification',
      riskScore: 0,
      message: 'Device verification passed',
      deviceFingerprint,
      requirements: []
    };
    
    // Check if device is known
    const knownDevices = user.trustedDevices || [];
    const isKnownDevice = knownDevices.some(device => 
      device.fingerprint === deviceFingerprint
    );
    
    if (!isKnownDevice) {
      if (ZERO_TRUST_CONFIG.BLOCK_UNKNOWN_DEVICES) {
        result.riskScore += 50;
        result.message = 'Unknown device detected';
        result.requirements.push('device_registration');
      } else {
        result.riskScore += 20;
        result.message = 'Unknown device - additional verification required';
        result.requirements.push('device_verification');
      }
    }
    
    // Check device security characteristics
    if (ZERO_TRUST_CONFIG.REQUIRE_SECURE_DEVICE) {
      const securityChecks = this.performDeviceSecurityChecks(req);
      result.riskScore += securityChecks.riskScore;
      result.securityChecks = securityChecks;
    }
    
    return result;
  }
  
  // Location verification
  static async verifyLocation(req, user) {
    const result = {
      factor: 'location_verification',
      riskScore: 0,
      message: 'Location verification passed',
      requirements: []
    };
    
    if (!ZERO_TRUST_CONFIG.REQUIRE_LOCATION_VERIFICATION) {
      return result;
    }
    
    // Get user's IP location (simplified - in production, use a proper geolocation service)
    const ipLocation = await this.getIPLocation(req.ip);
    const userLocation = user.lastKnownLocation;
    
    if (userLocation) {
      const distance = this.calculateDistance(ipLocation, userLocation);
      const timeDiff = Date.now() - new Date(user.lastLocationUpdate).getTime();
      
      // Check if location change is physically possible
      const maxPossibleDistance = (timeDiff / (1000 * 60 * 60)) * 1000; // km per hour assumption
      
      if (distance > maxPossibleDistance) {
        result.riskScore += 40;
        result.message = 'Impossible location change detected';
        result.requirements.push('location_verification');
      } else if (distance > 100) { // More than 100km
        result.riskScore += 20;
        result.message = 'Significant location change detected';
      }
    }
    
    return result;
  }
  
  // Session verification
  static async verifySession(req, user) {
    const result = {
      factor: 'session_verification',
      riskScore: 0,
      message: 'Session verification passed',
      requirements: []
    };
    
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      result.riskScore += 100;
      result.message = 'No session token provided';
      return result;
    }
    
    try {
      const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
      
      // Check session age
      const sessionAge = Date.now() - (decoded.iat * 1000);
      const maxAge = ZERO_TRUST_CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
      
      if (sessionAge > maxAge) {
        result.riskScore += 50;
        result.message = 'Session expired';
        result.requirements.push('session_refresh');
      }
      
      // Check concurrent sessions
      const activeSessions = user.activeSessions || [];
      if (activeSessions.length >= ZERO_TRUST_CONFIG.MAX_CONCURRENT_SESSIONS) {
        result.riskScore += 30;
        result.message = 'Maximum concurrent sessions exceeded';
        result.requirements.push('session_cleanup');
      }
      
      // Check session activity
      const lastActivity = user.lastActivity || new Date();
      const inactivityTime = Date.now() - new Date(lastActivity).getTime();
      const maxInactivity = 30 * 60 * 1000; // 30 minutes
      
      if (inactivityTime > maxInactivity) {
        result.riskScore += 20;
        result.message = 'Session inactive for too long';
        result.requirements.push('activity_refresh');
      }
      
    } catch (error) {
      result.riskScore += 100;
      result.message = 'Invalid session token';
    }
    
    return result;
  }
  
  // Permission verification
  static async verifyPermissions(user, action, resource) {
    const result = {
      factor: 'permission_verification',
      riskScore: 0,
      message: 'Permission verification passed',
      requirements: []
    };
    
    // Get user permissions
    const userPermissions = user.permissions || [];
    const userRole = user.role || 'user';
    
    // Check if user has explicit permission for this action
    const hasPermission = userPermissions.some(permission => 
      permission.action === action && 
      permission.resource === resource &&
      permission.allowed === true
    );
    
    if (!hasPermission) {
      // Check role-based permissions
      const rolePermissions = this.getRolePermissions(userRole);
      const hasRolePermission = rolePermissions.some(permission => 
        permission.action === action && 
        permission.resource === resource
      );
      
      if (!hasRolePermission) {
        result.riskScore += 100;
        result.message = 'Insufficient permissions';
        return result;
      }
    }
    
    // Check for sensitive actions requiring additional verification
    const sensitiveActions = ['delete', 'admin', 'payment', 'password_change'];
    if (sensitiveActions.includes(action)) {
      result.riskScore += 20;
      result.message = 'Sensitive action detected';
      result.requirements.push('additional_verification');
    }
    
    return result;
  }
  
  // Risk assessment
  static async assessRisk(req, user, action) {
    const result = {
      factor: 'risk_assessment',
      riskScore: 0,
      message: 'Risk assessment passed',
      requirements: []
    };
    
    let riskScore = 0;
    
    // Check for suspicious IP patterns
    const suspiciousIPs = await this.checkSuspiciousIPs(req.ip);
    if (suspiciousIPs.isSuspicious) {
      riskScore += suspiciousIPs.riskScore;
    }
    
    // Check for unusual access patterns
    const accessPatterns = await this.checkAccessPatterns(user, req.ip);
    if (accessPatterns.isUnusual) {
      riskScore += accessPatterns.riskScore;
    }
    
    // Check for rapid successive requests
    const rapidRequests = await this.checkRapidRequests(req.ip);
    if (rapidRequests.isRapid) {
      riskScore += rapidRequests.riskScore;
    }
    
    // Check for known attack patterns
    const attackPatterns = await this.checkAttackPatterns(req);
    if (attackPatterns.detected) {
      riskScore += attackPatterns.riskScore;
    }
    
    result.riskScore = riskScore;
    if (riskScore > ZERO_TRUST_CONFIG.RISK_SCORE_THRESHOLD) {
      result.message = 'High risk detected';
      result.requirements.push('additional_verification');
    }
    
    return result;
  }
  
  // Time-based access control
  static async verifyTimeAccess(req, user) {
    const result = {
      factor: 'time_access_control',
      riskScore: 0,
      message: 'Time access control passed',
      requirements: []
    };
    
    if (!ZERO_TRUST_CONFIG.WORKING_HOURS_ONLY) {
      return result;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const userTimezone = user.timezone || 'UTC';
    
    // Convert to user's timezone (simplified)
    const userHour = this.convertToUserTimezone(currentHour, userTimezone);
    
    if (userHour < ZERO_TRUST_CONFIG.WORKING_HOURS_START || 
        userHour > ZERO_TRUST_CONFIG.WORKING_HOURS_END) {
      result.riskScore += 30;
      result.message = 'Access outside working hours';
      result.requirements.push('working_hours_override');
    }
    
    return result;
  }
  
  // Network security verification
  static async verifyNetworkSecurity(req) {
    const result = {
      factor: 'network_security',
      riskScore: 0,
      message: 'Network security verification passed',
      requirements: []
    };
    
    // Check for secure connection
    if (ZERO_TRUST_CONFIG.REQUIRE_SECURE_CONNECTION) {
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      if (!isSecure) {
        result.riskScore += 50;
        result.message = 'Insecure connection detected';
        result.requirements.push('secure_connection');
      }
    }
    
    // Check for Tor networks
    if (ZERO_TRUST_CONFIG.BLOCK_TOR_NETWORKS) {
      const isTor = await this.checkTorNetwork(req.ip);
      if (isTor) {
        result.riskScore += 80;
        result.message = 'Tor network detected';
        result.requirements.push('network_verification');
      }
    }
    
    // Check for VPN networks
    if (!ZERO_TRUST_CONFIG.BLOCK_VPN_NETWORKS) {
      const isVPN = await this.checkVPNNetwork(req.ip);
      if (isVPN) {
        result.riskScore += 20;
        result.message = 'VPN network detected';
      }
    }
    
    return result;
  }
  
  // Behavioral analysis
  static async analyzeBehavior(req, user, action) {
    const result = {
      factor: 'behavioral_analysis',
      riskScore: 0,
      message: 'Behavioral analysis passed',
      requirements: []
    };
    
    // Analyze user behavior patterns
    const behaviorPatterns = user.behaviorPatterns || {};
    const currentBehavior = this.extractBehaviorMetrics(req, action);
    
    // Compare with historical patterns
    const deviation = this.calculateBehaviorDeviation(behaviorPatterns, currentBehavior);
    
    if (deviation > 0.7) { // 70% deviation threshold
      result.riskScore += 40;
      result.message = 'Unusual behavior detected';
      result.requirements.push('behavioral_verification');
    }
    
    return result;
  }
  
  // Calculate final access decision
  static calculateAccessDecision(evaluation) {
    const totalRiskScore = evaluation.riskScore;
    const hasBlockingFactors = evaluation.factors.some(factor => 
      factor.riskScore >= 100
    );
    
    if (hasBlockingFactors) {
      return false;
    }
    
    if (totalRiskScore > ZERO_TRUST_CONFIG.RISK_SCORE_THRESHOLD) {
      return false;
    }
    
    return true;
  }
  
  // Helper methods
  static generateDeviceFingerprint(req) {
    const components = [
      req.headers['user-agent'],
      req.headers['accept-language'],
      req.headers['accept-encoding'],
      req.ip
    ];
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }
  
  static performDeviceSecurityChecks(req) {
    const checks = {
      riskScore: 0,
      details: {}
    };
    
    // Check for secure headers
    const secureHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security'
    ];
    
    let missingHeaders = 0;
    secureHeaders.forEach(header => {
      if (!req.headers[header]) {
        missingHeaders++;
      }
    });
    
    if (missingHeaders > 0) {
      checks.riskScore += missingHeaders * 5;
      checks.details.missingHeaders = missingHeaders;
    }
    
    return checks;
  }
  
  static async getIPLocation(ip) {
    // Simplified location detection - in production, use a proper geolocation service
    return {
      latitude: 0,
      longitude: 0,
      country: 'Unknown',
      city: 'Unknown'
    };
  }
  
  static calculateDistance(loc1, loc2) {
    // Simplified distance calculation
    return Math.sqrt(
      Math.pow(loc1.latitude - loc2.latitude, 2) + 
      Math.pow(loc1.longitude - loc2.longitude, 2)
    ) * 111; // Rough conversion to km
  }
  
  static getRolePermissions(role) {
    const rolePermissions = {
      admin: [
        { action: 'read', resource: '*' },
        { action: 'write', resource: '*' },
        { action: 'delete', resource: '*' },
        { action: 'admin', resource: '*' }
      ],
      user: [
        { action: 'read', resource: 'own_data' },
        { action: 'write', resource: 'own_data' }
      ],
      moderator: [
        { action: 'read', resource: '*' },
        { action: 'write', resource: 'content' },
        { action: 'moderate', resource: 'content' }
      ]
    };
    
    return rolePermissions[role] || [];
  }
  
  static async checkSuspiciousIPs(ip) {
    // Simplified suspicious IP check
    return {
      isSuspicious: false,
      riskScore: 0
    };
  }
  
  static async checkAccessPatterns(user, ip) {
    // Simplified access pattern check
    return {
      isUnusual: false,
      riskScore: 0
    };
  }
  
  static async checkRapidRequests(ip) {
    // Simplified rapid request check
    return {
      isRapid: false,
      riskScore: 0
    };
  }
  
  static async checkAttackPatterns(req) {
    // Simplified attack pattern detection
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /<script/i,
      /union.*select/i,
      /drop.*table/i
    ];
    
    const url = req.url;
    const userAgent = req.headers['user-agent'] || '';
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(userAgent)) {
        return {
          detected: true,
          riskScore: 80
        };
      }
    }
    
    return {
      detected: false,
      riskScore: 0
    };
  }
  
  static convertToUserTimezone(hour, timezone) {
    // Simplified timezone conversion
    return hour;
  }
  
  static async checkTorNetwork(ip) {
    // Simplified Tor network check
    return false;
  }
  
  static async checkVPNNetwork(ip) {
    // Simplified VPN network check
    return false;
  }
  
  static extractBehaviorMetrics(req, action) {
    return {
      timestamp: Date.now(),
      action,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      method: req.method
    };
  }
  
  static calculateBehaviorDeviation(historicalPatterns, currentBehavior) {
    // Simplified behavior deviation calculation
    return 0;
  }
  
  static async logAccessAttempt(evaluation) {
    // Log access attempt for audit trail
    console.log('Zero Trust Access Log:', evaluation.auditLog);
    
    // In production, store in database
    // await AccessLog.create(evaluation.auditLog);
  }
}

// Zero Trust Middleware
const zeroTrustMiddleware = async (req, res, next) => {
  try {
    // Skip Zero Trust for certain endpoints
    const skipEndpoints = [
      '/api/health', 
      '/api/status',
      '/api/register',
      '/api/login',
      '/api/forgot-password',
      '/api/reset-password',
      '/api/verify-email',
      '/api/verify',  // Add this to skip /api/verify/:token
      '/api/resend-verification',
      '/api/check-password-strength',
      '/api/generate-secure-password',
      '/api/password-policy',
      '/api/auth/google'
    ];
    
    // Check if current path matches any skip endpoint
    const shouldSkip = skipEndpoints.some(endpoint => {
      // Exact match or starts with endpoint
      return req.path === endpoint || req.path.startsWith(endpoint + '/');
    });
    
    if (shouldSkip) {
      console.log(`Zero Trust: Skipping authentication for ${req.path}`);
      return next();
    }
    
    // Get user from request (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    // Extract action and resource from request
    const action = req.method.toLowerCase();
    const resource = req.path;
    
    // Evaluate access using Zero Trust
    const evaluation = await ZeroTrustManager.evaluateAccess(req, user, action, resource);
    
    if (!evaluation.allowed) {
      // Log denied access
      console.warn('Zero Trust Access Denied:', {
        userId: user.id,
        action,
        resource,
        riskScore: evaluation.riskScore,
        factors: evaluation.factors
      });
      
      return res.status(403).json({
        message: 'Access denied by Zero Trust policy',
        code: 'ACCESS_DENIED',
        riskScore: evaluation.riskScore,
        requirements: evaluation.requirements,
        factors: evaluation.factors.map(f => ({
          factor: f.factor,
          message: f.message
        }))
      });
    }
    
    // Add evaluation to request for logging
    req.zeroTrustEvaluation = evaluation;
    
    next();
  } catch (error) {
    console.error('Zero Trust middleware error:', error);
    res.status(500).json({
      message: 'Security evaluation failed',
      code: 'SECURITY_ERROR'
    });
  }
};

module.exports = {
  ZeroTrustManager,
  zeroTrustMiddleware,
  ZERO_TRUST_CONFIG
};
