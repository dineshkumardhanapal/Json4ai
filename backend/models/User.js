const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: false, minlength: 8 }, // Made optional for Google OAuth
  googleId:  { type: String, unique: true, sparse: true }, // Google OAuth ID
  profilePicture: { type: String }, // Profile picture from Google
  passwordSalt: { type: String }, // Additional salt for enhanced security
  passwordRounds: { type: Number, default: 12 }, // bcrypt rounds used
  passwordCreatedAt: { type: Date, default: Date.now },
  // Login security fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastFailedLogin: { type: Date },
  
  // Zero Trust Security fields
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'moderator', 'premium_user', 'standard_user', 'free_user', 'suspended_user'],
    default: 'free_user' 
  },
  permissions: [{ 
    action: String, 
    resource: String, 
    allowed: { type: Boolean, default: true },
    grantedAt: { type: Date, default: Date.now },
    grantedBy: String
  }],
  trustedDevices: [{
    fingerprint: String,
    name: String,
    lastUsed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  lastKnownLocation: {
    latitude: Number,
    longitude: Number,
    country: String,
    city: String,
    timestamp: { type: Date, default: Date.now }
  },
  activeSessions: [{
    sessionId: String,
    deviceFingerprint: String,
    ip: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
  }],
  
  // MFA and Advanced Security
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: String,
  mfaBackupCodes: [String],
  mfaVerifiedAt: Date,
  
  // Password Policy Compliance
  passwordHistory: [{
    hash: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  passwordExpiryDate: Date,
  passwordExpiryWarningSent: { type: Boolean, default: false },
  
  // Behavioral Analysis
  behaviorPatterns: {
    averageSessionDuration: Number,
    typicalAccessTimes: [Number],
    commonIPs: [String],
    typicalUserAgent: String,
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Security Status
  securityStatus: {
    riskScore: { type: Number, default: 0 },
    lastRiskAssessment: Date,
    securityFlags: [String],
    requiresPasswordChange: { type: Boolean, default: false },
    accountLocked: { type: Boolean, default: false },
    lockReason: String
  },
  verified:  { type: Boolean, default: false },
  verifyToken: String,
  resetToken: String,
  resetTokenExpiry: Date,
  credits:   { type: Number, default: 3 }, // Only used for free plan
  plan:      { 
    type: String, 
    enum: ['free', 'starter', 'premium'], 
    default: 'free' 
  },
  // Plan management for one-time payments
  planStartDate: { type: Date },
  planEndDate: { type: Date }, // Plan expires after 30 days
  // Daily limits tracking
  dailyPromptsUsed: { type: Number, default: 0 },
  lastDailyReset: { type: Date, default: Date.now },
  // Legacy fields (keeping for backward compatibility)
  lastFreeReset: { type: Date, default: Date.now },
  totalPromptsUsed: { type: Number, default: 0 },
  monthlyPromptsUsed: { type: Number, default: 0 },
  lastMonthlyReset: { type: Date, default: Date.now },
  // Session management fields
  refreshToken: String,
  lastLogin: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  // Subscription fields
  subscriptionId: String,
  subscriptionPlatform: String, // Will be 'pinelabs' for Pine Labs
  subscriptionStatus: {
    type: String,
    enum: ['active', 'pending', 'cancelled', 'expired', 'payment_failed', 'suspended'],
    default: 'active'
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  // Billing information
  billingEmail: String,
  lastPaymentDate: Date,
  nextBillingDate: Date,
  // Pending order tracking for Razorpay
  pendingOrderId: String,
  razorpayOrderId: String, // Store Razorpay's order ID for verification
  pendingPlanType: String,
  pendingBillingPeriod: String, // 'monthly' or 'yearly'
  orderCreatedAt: Date
}, { timestamps: true });

// Virtual for checking if user has unlimited access
userSchema.virtual('hasUnlimitedAccess').get(function() {
  return this.plan === 'premium';
});

// Virtual for getting daily limit
userSchema.virtual('dailyLimit').get(function() {
  // Check if paid plan is still active
  if (this.plan !== 'free' && this.planEndDate && new Date(this.planEndDate) > new Date()) {
    const limits = {
      starter: 30,  // 30 prompts per day
      premium: 100  // 100 prompts per day
    };
    return limits[this.plan] || 3;
  }
  return 3; // Free plan or expired paid plan
});

// Virtual for getting remaining daily prompts
userSchema.virtual('remainingCredits').get(function() {
  const dailyLimit = this.dailyLimit;
  const used = this.dailyPromptsUsed || 0;
  return Math.max(0, dailyLimit - used);
});

// Method to check if user can generate prompts
userSchema.methods.canGeneratePrompt = function() {
  // Check if paid plan has expired
  if (this.plan !== 'free' && this.planEndDate && new Date(this.planEndDate) <= new Date()) {
    // Plan has expired, revert to free plan
    this.plan = 'free';
    this.planStartDate = null;
    this.planEndDate = null;
  }
  
  // Reset daily usage if needed
  this.resetDailyUsage();
  
  // Check daily limit
  const dailyLimit = this.dailyLimit;
  const dailyUsed = this.dailyPromptsUsed || 0;
  
  return dailyUsed < dailyLimit;
};

// Method to use a credit/prompt
userSchema.methods.useCredit = function() {
  if (!this.canGeneratePrompt()) {
    return false;
  }
  
  // Increment daily usage
  this.dailyPromptsUsed = (this.dailyPromptsUsed || 0) + 1;
  this.totalPromptsUsed = (this.totalPromptsUsed || 0) + 1;
  this.monthlyPromptsUsed = (this.monthlyPromptsUsed || 0) + 1;
  
  // For free plan, also decrement credits
  if (this.plan === 'free') {
    this.credits = Math.max(0, this.credits - 1);
  }
  
  return true;
};

// Method to reset daily usage
userSchema.methods.resetDailyUsage = function() {
  const now = new Date();
  const lastReset = new Date(this.lastDailyReset);
  
  // Reset if it's a new day
  if (now.toDateString() !== lastReset.toDateString()) {
    this.dailyPromptsUsed = 0;
    this.lastDailyReset = now;
    
    // For free plan, also reset credits
    if (this.plan === 'free') {
      this.credits = 3;
      this.lastFreeReset = now;
    }
    
    return true;
  }
  
  return false;
};

// Method to reset daily credits (for free plan)
userSchema.methods.resetDailyCredits = function() {
  const now = new Date();
  const lastDate = new Date(this.lastFreeReset);
  
  if (now.toDateString() !== lastDate.toDateString() && this.plan === 'free') {
    this.credits = 3;
    this.lastFreeReset = now;
    return true;
  }
  
  return false;
};

// Method to reset monthly usage (for starter plan)
userSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  const lastMonth = new Date(this.lastMonthlyReset);
  
  if (now.getMonth() !== lastMonth.getMonth() || now.getFullYear() !== lastMonth.getFullYear()) {
    this.monthlyPromptsUsed = 0;
    this.lastMonthlyReset = now;
    
    // Reset daily credits for starter plan as well
    if (this.plan === 'starter') {
      this.credits = 30;
    }
    
    return true;
  }
  
  return false;
};

module.exports = mongoose.model('User', userSchema);