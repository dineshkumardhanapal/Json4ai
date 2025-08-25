// backend/services/subscriptionService.js
const User = require('../models/User');
const { sendSubscriptionConfirmation, sendSubscriptionUpdated } = require('../mailer');

class SubscriptionService {
  // Get user's current subscription status
  static async getUserSubscription(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        plan: user.plan,
        credits: user.credits,
        subscriptionStatus: user.subscriptionStatus,
        currentPeriodStart: user.currentPeriodStart,
        currentPeriodEnd: user.currentPeriodEnd,
        nextBillingDate: user.nextBillingDate,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        paypalSubscriptionId: user.paypalSubscriptionId,
        hasActiveSubscription: user.subscriptionStatus === 'active',
        remainingCredits: user.plan === 'premium' ? 'Unlimited' : user.credits,
        planFeatures: this.getPlanFeatures(user.plan)
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  // Get plan features based on plan type
  static getPlanFeatures(plan) {
    const features = {
      free: [
        '3 JSON prompts per day',
        'Basic prompt templates',
        'Community support'
      ],
      starter: [
        '30 JSON prompts per month',
        'Advanced prompt templates',
        'Priority support',
        'Export functionality',
        'Custom categories'
      ],
      premium: [
        '100 JSON prompts per month',
        'All Starter features',
        'Custom prompt templates',
        'API access',
        'White-label options',
        '24/7 priority support',
        'Advanced analytics'
      ]
    };

    return features[plan] || features.free;
  }

  // Check if user can generate a prompt
  static async canGeneratePrompt(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Premium users have unlimited access
      if (user.plan === 'premium') {
        return { canGenerate: true, reason: 'Premium plan' };
      }

      // Check if user has credits
      if (user.credits > 0) {
        return { canGenerate: true, reason: 'Has credits' };
      }

      // Check if daily reset is available for free plan
      if (user.plan === 'free') {
        const now = new Date();
        const lastReset = new Date(user.lastFreeReset);
        
        if (now.toDateString() !== lastReset.toDateString()) {
          return { canGenerate: true, reason: 'Daily reset available' };
        }
      }

      // Check if monthly reset is available for starter plan
      if (user.plan === 'starter') {
        const now = new Date();
        const lastMonthlyReset = new Date(user.lastMonthlyReset);
        
        if (now.getMonth() !== lastMonthlyReset.getMonth() || 
            now.getFullYear() !== lastMonthlyReset.getFullYear()) {
          return { canGenerate: true, reason: 'Monthly reset available' };
        }
      }

      return { 
        canGenerate: false, 
        reason: 'No credits remaining',
        nextReset: this.getNextResetTime(user)
      };
    } catch (error) {
      console.error('Error checking prompt generation:', error);
      throw error;
    }
  }

  // Get next reset time for user
  static getNextResetTime(user) {
    if (user.plan === 'free') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }

    if (user.plan === 'starter') {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }

    return null;
  }

  // Use a credit for prompt generation
  static async useCredit(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Premium users don't consume credits
      if (user.plan === 'premium') {
        await User.findByIdAndUpdate(userId, {
          $inc: { totalPromptsUsed: 1, monthlyPromptsUsed: 1 },
          lastActivity: new Date()
        });
        return { success: true, creditsRemaining: 'Unlimited' };
      }

      // Check if user can generate prompt
      const canGenerate = await this.canGeneratePrompt(userId);
      if (!canGenerate.canGenerate) {
        throw new Error(canGenerate.reason);
      }

      // Handle daily/monthly resets
      if (user.plan === 'free' && canGenerate.reason === 'Daily reset available') {
        await User.findByIdAndUpdate(userId, {
          credits: 2, // Reset to 3, then use 1
          lastFreeReset: new Date(),
          $inc: { totalPromptsUsed: 1 },
          lastActivity: new Date()
        });
        return { success: true, creditsRemaining: 2 };
      }

      if (user.plan === 'starter' && canGenerate.reason === 'Monthly reset available') {
        await User.findByIdAndUpdate(userId, {
          credits: 29, // Reset to 30, then use 1
          lastMonthlyReset: new Date(),
          monthlyPromptsUsed: 1,
          $inc: { totalPromptsUsed: 1 },
          lastActivity: new Date()
        });
        return { success: true, creditsRemaining: 29 };
      }

      // Use existing credit
      await User.findByIdAndUpdate(userId, {
        $inc: { credits: -1, totalPromptsUsed: 1, monthlyPromptsUsed: 1 },
        lastActivity: new Date()
      });

      const updatedUser = await User.findById(userId);
      return { 
        success: true, 
        creditsRemaining: updatedUser.credits 
      };
    } catch (error) {
      console.error('Error using credit:', error);
      throw error;
    }
  }

  // Get subscription analytics for user
  static async getSubscriptionAnalytics(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const planStartDate = new Date(user.planStartDate);
      const daysSincePlanStart = Math.floor((now - planStartDate) / (1000 * 60 * 60 * 24));

      return {
        currentPlan: user.plan,
        planStartDate: user.planStartDate,
        daysSincePlanStart,
        totalPromptsUsed: user.totalPromptsUsed,
        monthlyPromptsUsed: user.monthlyPromptsUsed,
        creditsRemaining: user.plan === 'premium' ? 'Unlimited' : user.credits,
        subscriptionStatus: user.subscriptionStatus,
        nextBillingDate: user.nextBillingDate,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd
      };
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  }

  // Upgrade user plan (for admin use)
  static async upgradeUserPlan(userId, planType) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const planDetails = this.getPlanDetails(planType);
      if (!planDetails) {
        throw new Error('Invalid plan type');
      }

      // Update user plan (this will be handled by PayPal webhook)
      const updates = {
        plan: planType,
        credits: planDetails.credits,
        planStartDate: new Date(),
        lastPlanUpdate: new Date()
      };

      await User.findByIdAndUpdate(userId, updates);
      return { success: true, plan: planType, credits: planDetails.credits };
    } catch (error) {
      console.error('Plan upgrade error:', error);
      throw error;
    }
  }

  // Get plan details
  static getPlanDetails(plan) {
    const plans = {
      free: { credits: 3, price: 0 },
      starter: { credits: 30, price: 1 },
      premium: { credits: Infinity, price: 10 }
    };

    return plans[plan] || plans.free;
  }

  // Process subscription renewal
  static async processSubscriptionRenewal(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Reset monthly usage for starter plan
      if (user.plan === 'starter') {
        await User.findByIdAndUpdate(userId, {
          credits: 30,
          monthlyPromptsUsed: 0,
          lastMonthlyReset: new Date()
        });
        console.log(`Monthly credits reset for user ${userId}`);
      }

      // Premium plan has unlimited credits, no reset needed
      return { success: true };
    } catch (error) {
      console.error('Subscription renewal error:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
