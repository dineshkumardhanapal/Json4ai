// middleware/credit.js
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // req.user is set by auth middleware, so we can access req.user._id
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // CRITICAL SECURITY CHECK: For one-time plans, allow access if plan is active by date.
    // Treat paid access as valid when planEndDate is in the future.
    if (user.plan !== 'free') {
      const now = new Date();
      if (user.planEndDate && new Date(user.planEndDate) <= now) {
        return res.status(402).json({
          message: 'Your plan has expired. Please purchase a new plan to continue.',
          currentPlan: user.plan,
          planEndDate: user.planEndDate,
          upgradeUrl: '/pricing.html'
        });
      }
      // If there is no planEndDate yet (fresh activation race), still allow and rely on usage limits
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