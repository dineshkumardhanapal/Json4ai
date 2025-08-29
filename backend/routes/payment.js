const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validatePaymentSubscription } = require('../middleware/validation');
const fetch = require('node-fetch');
const crypto = require('crypto');

// Cashfree configuration
const CASHFREE_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cashfree.com/pg' 
  : 'https://sandbox.cashfree.com/pg';

// Helper function to create Cashfree headers
function getCashfreeHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': '2022-09-01'
  };
}

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

    // Generate unique order ID
    const orderId = `order_${user._id}_${Date.now()}`;
    
    // Create Cashfree payment order
    const orderRequest = {
      order_amount: plan.price,
      order_currency: plan.currency,
      order_id: orderId,
      customer_details: {
        customer_id: user._id.toString(),
        customer_name: `${user.firstName} ${user.lastName}`,
        customer_email: user.email,
        customer_phone: user.phone || '9999999999' // Default phone if not provided
      },
      order_meta: {
        plan_type: planType,
        user_id: user._id.toString(),
        plan_name: plan.name
      },
      order_note: `${plan.name} Plan - 1 Month Access`,
      order_tags: {
        source: 'json4ai',
        plan: planType
      },
      order_splits: []
    };

    try {
      // Create order using Cashfree API
      const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
        method: 'POST',
        headers: getCashfreeHeaders(),
        body: JSON.stringify(orderRequest)
      });

      const responseData = await response.json();
      
      if (response.ok && responseData.payment_session_id) {
        // Store order details in user record for webhook processing
        await User.findByIdAndUpdate(user._id, {
          pendingOrderId: orderId,
          pendingPlanType: planType,
          orderCreatedAt: new Date()
        });

        // Generate payment URL - Cashfree provides this directly
        const paymentUrl = `https://payments${process.env.NODE_ENV === 'production' ? '' : '-test'}.cashfree.com/pay/order/${responseData.payment_session_id}`;

        res.json({
          success: true,
          orderId: orderId,
          paymentUrl: paymentUrl,
          paymentSessionId: responseData.payment_session_id
        });
      } else {
        console.error('Cashfree API Error:', responseData);
        throw new Error(responseData.message || 'Invalid response from Cashfree');
      }
    } catch (cashfreeError) {
      console.error('Cashfree API Error:', cashfreeError);
      return res.status(500).json({
        error: 'Failed to create payment order',
        details: cashfreeError.message || 'Please try again later or contact support if the issue persists.'
      });
    }

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
    console.log('Cashfree webhook received:', req.body);
    
    const { 
      type, 
      data: {
        order = {},
        payment = {}
      } = {}
    } = req.body;

    // Handle different webhook events
    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      await handlePaymentSuccess(order, payment);
    } else if (type === 'PAYMENT_FAILED_WEBHOOK') {
      await handlePaymentFailed(order, payment);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Handle successful payment
async function handlePaymentSuccess(order, payment) {
  try {
    const { order_id, order_amount, order_currency } = order;
    console.log(`✅ Payment successful for order: ${order_id}, amount: ${order_amount} ${order_currency}`);
    
    // Find user by pending order ID
    const user = await User.findOne({ pendingOrderId: order_id });
    if (!user) {
      console.error(`User not found for order: ${order_id}`);
      return;
    }

    const planType = user.pendingPlanType;
    const plan = PLANS[planType];
    
    if (!plan) {
      console.error(`Invalid plan type: ${planType}`);
      return;
    }

    // Calculate plan end date (30 days from now)
    const planStartDate = new Date();
    const planEndDate = new Date();
    planEndDate.setDate(planEndDate.getDate() + plan.duration);

    // Activate the plan
    await User.findByIdAndUpdate(user._id, {
      plan: planType,
      planStartDate: planStartDate,
      planEndDate: planEndDate,
      // Reset daily usage for new plan
      dailyPromptsUsed: 0,
      lastDailyReset: new Date(),
      // Clear pending order data
      pendingOrderId: null,
      pendingPlanType: null,
      orderCreatedAt: null,
      // Update activity
      lastActivity: new Date()
    });

    console.log(`✅ Plan activated: ${planType} for user ${user.email} until ${planEndDate.toLocaleDateString()}`);
    
    // TODO: Send success email notification
    // await sendPlanActivationEmail(user, plan, planEndDate);
    
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(order, payment) {
  try {
    const { order_id } = order;
    console.log(`❌ Payment failed for order: ${order_id}`);
    
    // Find user by pending order ID and clear pending data
    const user = await User.findOne({ pendingOrderId: order_id });
    if (user) {
      await User.findByIdAndUpdate(user._id, {
        pendingOrderId: null,
        pendingPlanType: null,
        orderCreatedAt: null
      });
      
      console.log(`Cleared pending order data for user: ${user.email}`);
    }
    
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

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
