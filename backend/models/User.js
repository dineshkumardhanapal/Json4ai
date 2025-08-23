const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true, minlength: 6 },
  verified:  { type: Boolean, default: false },
  verifyToken: String,
  credits:   { type: Number, default: 3 },
  plan:      { 
    type: String, 
    enum: ['free', 'starter', 'premium'], 
    default: 'free' 
  },
  lastFreeReset: { type: Date, default: Date.now },
  // Additional fields for better plan management
  planStartDate: { type: Date, default: Date.now },
  planEndDate: { type: Date },
  totalPromptsUsed: { type: Number, default: 0 },
  monthlyPromptsUsed: { type: Number, default: 0 },
  lastMonthlyReset: { type: Date, default: Date.now },
  // Session management fields
  refreshToken: String,
  lastLogin: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

// Virtual for checking if user has unlimited access
userSchema.virtual('hasUnlimitedAccess').get(function() {
  return this.plan === 'premium';
});

// Virtual for getting daily limit
userSchema.virtual('dailyLimit').get(function() {
  const limits = {
    free: 3,
    starter: 30,
    premium: Infinity
  };
  return limits[this.plan] || 3;
});

// Virtual for getting remaining credits
userSchema.virtual('remainingCredits').get(function() {
  if (this.plan === 'premium') return Infinity;
  return Math.max(0, this.credits);
});

// Method to check if user can generate prompts
userSchema.methods.canGeneratePrompt = function() {
  if (this.plan === 'premium') return true;
  return this.credits > 0;
};

// Method to use a credit
userSchema.methods.useCredit = function() {
  if (this.plan === 'premium') {
    this.totalPromptsUsed += 1;
    this.monthlyPromptsUsed += 1;
    return true;
  }
  
  if (this.credits > 0) {
    this.credits -= 1;
    this.totalPromptsUsed += 1;
    this.monthlyPromptsUsed += 1;
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