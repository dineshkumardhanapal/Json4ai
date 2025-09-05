const router = require('express').Router();
const User = require('../models/User');
const { validateProfileUpdate } = require('../middleware/validation');
// Use the shared auth middleware to ensure consistent token handling
const auth = require('../middleware/auth');

// Get profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -verifyToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Reset credits and usage based on plan
    user.resetDailyCredits();
    user.resetMonthlyUsage();
    await user.save();
    
    res.json({
      ...user.toObject(),
      dailyLimit: user.dailyLimit,
      remainingCredits: user.remainingCredits,
      hasUnlimitedAccess: user.hasUnlimitedAccess
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/profile', auth, validateProfileUpdate, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { firstName, lastName }, 
      { new: true, runValidators: true }
    ).select('-password -verifyToken');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        ...user.toObject(),
        dailyLimit: user.dailyLimit,
        remainingCredits: user.remainingCredits,
        hasUnlimitedAccess: user.hasUnlimitedAccess
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Get usage information
router.get('/usage', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Reset credits and usage based on plan
    user.resetDailyCredits();
    user.resetMonthlyUsage();
    await user.save();
    
    res.json({
      plan: user.plan,
      dailyLimit: user.dailyLimit,
      remainingCredits: user.remainingCredits,
      totalPromptsUsed: user.totalPromptsUsed,
      monthlyPromptsUsed: user.monthlyPromptsUsed,
      hasUnlimitedAccess: user.hasUnlimitedAccess,
      planStartDate: user.planStartDate,
      planEndDate: user.planEndDate
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch usage information' });
  }
});

// Upgrade plan (admin function for now)
router.put('/plan', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || !['free', 'starter', 'premium'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan. Must be free, starter, or premium' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update plan and reset credits
    user.plan = plan;
    user.planStartDate = new Date();
    
    // Set credits based on new plan
    if (plan === 'free') {
      user.credits = 3;
    } else if (plan === 'starter') {
      user.credits = 30;
    }
    // Premium plan doesn't need credits (unlimited)
    
    await user.save();
    
    res.json({
      message: 'Plan upgraded successfully',
      newPlan: plan,
      dailyLimit: user.dailyLimit,
      remainingCredits: user.remainingCredits,
      hasUnlimitedAccess: user.hasUnlimitedAccess
    });
  } catch (error) {
    console.error('Plan upgrade error:', error);
    res.status(500).json({ message: 'Failed to upgrade plan' });
  }
});

module.exports = router;