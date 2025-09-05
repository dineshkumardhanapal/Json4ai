// backend/legacy/subscriptionRenewal.js (moved)
const cron = require('node-cron');
const User = require('../models/User');
const { sendSubscriptionConfirmation } = require('../mailer');

// Daily job to reset free plan credits
const dailyCreditReset = cron.schedule('0 0 * * *', async () => {
  console.log('Running daily credit reset job...');
  
  try {
    const users = await User.find({ 
      plan: 'free',
      lastFreeReset: { 
        $lt: new Date(new Date().setHours(0, 0, 0, 0)) 
      }
    });

    for (const user of users) {
      await User.findByIdAndUpdate(user._id, {
        credits: 3,
        lastFreeReset: new Date()
      });
      
      console.log(`Reset credits for user ${user.email} (Free plan)`);
    }

    console.log(`Daily credit reset completed. ${users.length} users processed.`);
  } catch (error) {
    console.error('Daily credit reset job error:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Monthly job to reset starter plan credits
const monthlyCreditReset = cron.schedule('0 0 1 * *', async () => {
  console.log('Running monthly credit reset job...');
  
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const users = await User.find({ 
      plan: 'starter',
      lastMonthlyReset: { $lt: lastMonth }
    });

    for (const user of users) {
      await User.findByIdAndUpdate(user._id, {
        credits: 30,
        monthlyPromptsUsed: 0,
        lastMonthlyReset: new Date()
      });
      
      console.log(`Reset monthly credits for user ${user.email} (Starter plan)`);
    }

    console.log(`Monthly credit reset completed. ${users.length} users processed.`);
  } catch (error) {
    console.error('Monthly credit reset job error:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Daily job to check subscription status and send notifications
const subscriptionStatusCheck = cron.schedule('0 9 * * *', async () => {
  console.log('Running subscription status check job...');
  
  try {
    const now = new Date();
    
    // Check for plans ending soon (3 days)
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    
    const endingPlans = await User.find({
      plan: { $in: ['starter', 'premium'] },
      planEndDate: { 
        $gte: now,
        $lte: threeDaysFromNow
      }
    });

    for (const user of endingPlans) {
      try {
        // Send plan ending reminder
        await sendEmail(
          user.email,
          '🔔 Your JSON4AI Plan is Ending Soon',
          `
            <h2>Hello ${user.firstName}!</h2>
            <p>Your JSON4AI plan will end on ${new Date(user.planEndDate).toLocaleDateString()}.</p>
            <p>To continue enjoying premium features, please purchase a new plan.</p>
            <p><a href="${process.env.FRONTEND_URL}/pricing">Buy New Plan</a></p>
          `
        );
        
        console.log(`Sent ending reminder to user ${user.email}`);
      } catch (error) {
        console.error(`Failed to send ending reminder to ${user.email}:`, error);
      }
    }

    // Check for past due payments
    const pastDueUsers = await User.find({
      subscriptionStatus: 'past_due'
    });

    for (const user of pastDueUsers) {
      try {
        // Send payment reminder
        await sendEmail(
          user.email,
          '⚠️ Payment Required - Your JSON4AI Subscription',
          `
            <h2>Hello ${user.firstName}!</h2>
            <p>Your JSON4AI subscription payment is past due. Please update your payment method to avoid service interruption.</p>
            <p><a href="${process.env.FRONTEND_URL}/dashboard">Update Payment Method</a></p>
          `
        );
        
        console.log(`Sent payment reminder to user ${user.email}`);
      } catch (error) {
        console.error(`Failed to send payment reminder to ${user.email}:`, error);
      }
    }

    console.log(`Plan status check completed. ${endingPlans.length} ending plans, ${pastDueUsers.length} past due users.`);
  } catch (error) {
    console.error('Subscription status check job error:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Weekly job to send usage reports
const weeklyUsageReport = cron.schedule('0 10 * * 1', async () => {
  console.log('Running weekly usage report job...');
  
  try {
    const users = await User.find({
      plan: { $in: ['starter', 'premium'] }
    });

    for (const user of users) {
      try {
        // Only send if user has used prompts
        if (user.monthlyPromptsUsed > 0) {
          await sendEmail(
            user.email,
            '📊 Your Weekly JSON4AI Usage Report',
            `
              <h2>Hello ${user.firstName}!</h2>
              <p>Here's your weekly usage summary:</p>
              <ul>
                <li><strong>Current Plan:</strong> ${user.plan}</li>
                <li><strong>Prompts Used This Month:</strong> ${user.monthlyPromptsUsed}</li>
                <li><strong>Daily Limit:</strong> ${user.dailyLimit}</li>
                <li><strong>Plan Valid Until:</strong> ${user.planEndDate ? new Date(user.planEndDate).toLocaleDateString() : 'N/A'}</li>
              </ul>
              <p><a href="${process.env.FRONTEND_URL}/dashboard">View Full Analytics</a></p>
            `
          );
          
          console.log(`Sent usage report to user ${user.email}`);
        }
      } catch (error) {
        console.error(`Failed to send usage report to ${user.email}:`, error);
      }
    }

    console.log(`Weekly usage report completed. ${users.length} users processed.`);
  } catch (error) {
    console.error('Weekly usage report job error:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Helper function to send emails (placeholder - should use your mailer service)
async function sendEmail(to, subject, html) {
  // This is a placeholder - you should use your actual mailer service
  console.log(`Would send email to ${to}: ${subject}`);
  // Uncomment the line below when you have your mailer service ready
  // return await sendEmail(to, subject, html);
}

// Start all jobs
function startJobs() {
  dailyCreditReset.start();
  monthlyCreditReset.start();
  subscriptionStatusCheck.start();
  weeklyUsageReport.start();
  
  console.log('All subscription renewal jobs started');
}

// Stop all jobs
function stopJobs() {
  dailyCreditReset.stop();
  monthlyCreditReset.stop();
  subscriptionStatusCheck.stop();
  weeklyUsageReport.stop();
  
  console.log('All subscription renewal jobs stopped');
}

// Manual trigger functions for testing
async function triggerDailyReset() {
  console.log('Manually triggering daily credit reset...');
  await dailyCreditReset.fire();
}

async function triggerMonthlyReset() {
  console.log('Manually triggering monthly credit reset...');
  await monthlyCreditReset.fire();
}

async function triggerStatusCheck() {
  console.log('Manually triggering subscription status check...');
  await subscriptionStatusCheck.fire();
}

async function triggerUsageReport() {
  console.log('Manually triggering weekly usage report...');
  await weeklyUsageReport.fire();
}

module.exports = {
  startJobs,
  stopJobs,
  triggerDailyReset,
  triggerMonthlyReset,
  triggerStatusCheck,
  triggerUsageReport,
  dailyCreditReset,
  monthlyCreditReset,
  subscriptionStatusCheck,
  weeklyUsageReport
};
