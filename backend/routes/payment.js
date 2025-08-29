const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validatePaymentSubscription } = require('../middleware/validation');

// Plan configuration for Cashfree one-time payments
const PLANS = {
  'starter': {
    name: 'Starter',
    price: 299, // INR 299 per month
    currency: 'INR',
    dailyLimit: 30, // 30 prompts per day
    duration: 30, // 30 days (1 month)
    features: [
      '30 JSON prompts per day',
      'Valid for 1 month',
      'Advanced prompt templates',
      'Priority support',
      'Export functionality'
    ]
  },
  'premium': {
    name: 'Premium',
    price: 999, // INR 999 per month
    currency: 'INR',
    dailyLimit: 100, // 100 prompts per day
    duration: 30, // 30 days (1 month)
    features: [
      '100 JSON prompts per day',
      'Valid for 1 month',
      'All Starter features',
      'Custom prompt templates',
      'API access',
      'White-label options',
      '24/7 priority support'
    ]
  }
};

// POST /api/payment/create-order - Create Cashfree one-time payment
router.post('/create-order', auth, async (req, res) => {
  try {
    const { planType } = req.body;
    const user = req.user;

    // Validate plan type
    if (!PLANS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const plan = PLANS[planType];

    // Check if user already has an active plan
    if (user.plan !== 'free' && user.planEndDate && new Date(user.planEndDate) > new Date()) {
      return res.status(400).json({ 
        error: 'You already have an active plan',
        details: `Your current ${user.plan} plan is valid until ${new Date(user.planEndDate).toLocaleDateString()}`
      });
    }

    // TODO: Implement Cashfree payment gateway integration
    // For now, return a placeholder response
    return res.status(503).json({ 
      error: 'Cashfree payment integration coming soon!',
      details: `${plan.name} plan (₹${plan.price} for 1 month) will be available once Cashfree integration is complete.`,
      plan: plan
    });

    // Future Cashfree integration will go here:
    /*
    // 1. Create Cashfree payment order
    // 2. Generate payment URL
    // 3. Update user with pending payment
    // 4. Return payment URL for redirect
    
    const paymentOrder = await createCashfreeOrder({
      order_amount: plan.price,
      order_currency: plan.currency,
      order_id: `order_${user._id}_${Date.now()}`,
      customer_details: {
        customer_id: user._id.toString(),
        customer_name: `${user.firstName} ${user.lastName}`,
        customer_email: user.email
      },
      order_meta: {
        plan_type: planType,
        user_id: user._id.toString()
      },
      order_note: `${plan.name} Plan - 1 Month Access`,
      return_url: `${process.env.FRONTEND_URL}/pricing?success=true&plan=${planType}`,
      notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`
    });

    res.json({ 
      orderId: paymentOrder.order_id,
      paymentUrl: paymentOrder.payment_link
    });
    */

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment order. Please try again later.' 
    });
  }
});

// POST /api/payment/webhook - Cashfree webhook handler
router.post('/webhook', async (req, res) => {
  try {
    // TODO: Implement Cashfree webhook verification and handling
    console.log('Cashfree webhook received:', req.body);
    
    // Future implementation will handle:
    // - Payment success -> Activate plan for 30 days
    // - Payment failure -> Keep user on free plan
    // - Refund -> Deactivate plan
    
    const { order_id, order_status, order_amount, order_currency } = req.body;
    
    if (order_status === 'PAID') {
      // Extract user ID from order_id or order_meta
      // Activate the purchased plan
      console.log(`Payment successful for order: ${order_id}, amount: ${order_amount} ${order_currency}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// GET /api/payment/plan - Get current plan information
router.get('/plan', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user has an active paid plan
    const isActivePlan = user.plan !== 'free' && user.planEndDate && new Date(user.planEndDate) > new Date();
    
    res.json({ 
      plan: {
        type: user.plan,
        isActive: isActivePlan,
        startDate: user.planStartDate,
        endDate: user.planEndDate,
        dailyLimit: user.plan === 'starter' ? 30 : user.plan === 'premium' ? 100 : 3,
        dailyUsed: user.dailyPromptsUsed || 0,
        lastResetDate: user.lastFreeReset
      }
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: 'Failed to retrieve plan information' });
  }
});

// GET /api/payment/plans - Get available plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

module.exports = router;
