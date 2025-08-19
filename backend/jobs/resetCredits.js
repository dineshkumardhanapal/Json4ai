const User = require('../models/User');

// Function to reset daily credits for all users
const resetDailyCredits = async () => {
  try {
    console.log('Starting daily credit reset...');
    
    const now = new Date();
    const users = await User.find({});
    let resetCount = 0;
    
    for (const user of users) {
      let needsUpdate = false;
      
      // Reset free plan credits daily
      if (user.plan === 'free') {
        const lastDate = new Date(user.lastFreeReset);
        if (now.toDateString() !== lastDate.toDateString()) {
          user.credits = 3;
          user.lastFreeReset = now;
          needsUpdate = true;
        }
      }
      
      // Reset starter plan credits monthly
      if (user.plan === 'starter') {
        const lastMonth = new Date(user.lastMonthlyReset);
        if (now.getMonth() !== lastMonth.getMonth() || now.getFullYear() !== lastMonth.getFullYear()) {
          user.credits = 30;
          user.lastMonthlyReset = now;
          user.monthlyPromptsUsed = 0;
          needsUpdate = true;
        }
      }
      
      // Premium users don't need credit resets
      
      if (needsUpdate) {
        await user.save();
        resetCount++;
      }
    }
    
    console.log(`Daily credit reset completed. Updated ${resetCount} users.`);
  } catch (error) {
    console.error('Error in daily credit reset:', error);
  }
};

// Function to reset monthly usage for all users
const resetMonthlyUsage = async () => {
  try {
    console.log('Starting monthly usage reset...');
    
    const now = new Date();
    const users = await User.find({});
    let resetCount = 0;
    
    for (const user of users) {
      const lastMonth = new Date(user.lastMonthlyReset);
      if (now.getMonth() !== lastMonth.getMonth() || now.getFullYear() !== lastMonth.getFullYear()) {
        user.monthlyPromptsUsed = 0;
        user.lastMonthlyReset = now;
        await user.save();
        resetCount++;
      }
    }
    
    console.log(`Monthly usage reset completed. Updated ${resetCount} users.`);
  } catch (error) {
    console.error('Error in monthly usage reset:', error);
  }
};

// Export functions for use in cron jobs or manual execution
module.exports = {
  resetDailyCredits,
  resetMonthlyUsage
};

// If this file is run directly, execute the reset
if (require.main === module) {
  console.log('Running credit reset manually...');
  resetDailyCredits()
    .then(() => resetMonthlyUsage())
    .then(() => {
      console.log('Manual credit reset completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Manual credit reset failed:', error);
      process.exit(1);
    });
}
