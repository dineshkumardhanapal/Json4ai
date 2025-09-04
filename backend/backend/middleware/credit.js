// middleware/credit.js
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // req.user is set by auth middleware, so we can access req.user._id
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // CRITICAL SECURITY CHECK: Verify subscription status before granting access
    if (user.plan !== 'free' && user.subscriptionStatus !== 'active') {
      return res.status(402).json({ 
        message: 'Your subscription is not active. Please complete payment or contact support.',
        currentPlan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        upgradeUrl: '/pricing.html'
      });
    }

    // Reset credits and usage based on plan
    user.resetDailyCredits();
    user.resetMonthlyUsage();
    await user.save();

    // Check if user can generate prompts
    if (!user.canGeneratePrompt()) {
      const dailyLimit = user.dailyLimit;
      const remainingCredits = user.remainingCredits;
      
      return res.status(402).json({ 
        message: `Daily limit reached (${dailyLimit} prompts/day). Please upgrade your plan for unlimited access.`,
        currentPlan: user.plan,
        dailyLimit: dailyLimit,
        remainingCredits: remainingCredits,
        upgradeUrl: '/pricing.html'
      });
    }

    req.userObj = user; // attach user for route
    next();
  } catch (err) {
    console.error('Credit middleware error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};