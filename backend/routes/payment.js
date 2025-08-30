const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validatePaymentSubscription } = require('../middleware/validation');
const crypto = require('crypto');

// Razorpay configuration
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Webhook signature verification for Razorpay
function verifyRazorpayWebhookSignature(payload, signature) {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.warn('RAZORPAY_WEBHOOK_SECRET not set, skipping signature verification');
      return true;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Razorpay webhook signature verification error:', error);
    return false;
  }
}

// Plan configuration for Razorpay one-time payments
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

// POST /api/payment/create-order - Create Razorpay order
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
    
    // Create Razorpay order
    const orderOptions = {
      amount: plan.price * 100, // Razorpay expects amount in paise (smallest currency unit)
      currency: plan.currency,
      receipt: orderId,
      notes: {
        plan_type: planType,
        user_id: user._id.toString(),
        plan_name: plan.name,
        source: 'json4ai'
      },
      callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      callback_method: 'get'
    };

    try {
      console.log('Creating Razorpay order:', {
        orderId: orderId,
        amount: plan.price,
        currency: plan.currency,
        environment: process.env.NODE_ENV
      });

      // Create order using Razorpay API
      const order = await razorpay.orders.create(orderOptions);
      
      console.log('Razorpay order created:', {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status
      });
      
      // Store order details in user record for webhook processing
      await User.findByIdAndUpdate(user._id, {
        pendingOrderId: order.id, // Use Razorpay's order ID
        pendingPlanType: planType,
        orderCreatedAt: new Date()
      });

      // Return order details for frontend
      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID, // Frontend needs this for payment
        name: 'JSON4AI',
        description: `${plan.name} Plan - 1 Month Access`,
        prefill: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          contact: user.phone || '9999999999'
        },
        notes: {
          plan_type: planType,
          user_id: user._id.toString()
        }
      });
      
    } catch (razorpayError) {
      console.error('Razorpay API Error:', razorpayError);
      return res.status(500).json({
        error: 'Failed to create payment order',
        details: razorpayError.message || 'Please try again later or contact support if the issue persists.'
      });
    }

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment order. Please try again later.' 
    });
  }
});

// POST /api/payment/webhook - Razorpay webhook handler
router.post('/webhook', async (req, res) => {
  try {
    // Log webhook with IP for security monitoring
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Razorpay webhook received:', {
      clientIP: clientIP,
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    
    if (process.env.NODE_ENV === 'production' && process.env.RAZORPAY_WEBHOOK_SECRET) {
      if (!verifyRazorpayWebhookSignature(JSON.stringify(req.body), signature)) {
        console.error('Invalid Razorpay webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ Razorpay webhook signature verified successfully');
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Webhook signature verification disabled - add RAZORPAY_WEBHOOK_SECRET for production security');
      } else {
        console.log('ℹ️ Webhook signature verification disabled in development mode');
      }
    }
    
    const { 
      event,
      payload: {
        order = {},
        payment = {}
      } = {}
    } = req.body;

    console.log(`Processing Razorpay webhook event: ${event}`);

    // Handle different webhook events
    switch (event) {
      case 'order.paid':
        await handlePaymentSuccess(order, payment);
        break;
      case 'payment.failed':
        await handlePaymentFailed(order, payment);
        break;
      case 'order.payment_failed':
        await handlePaymentFailed(order, payment);
        break;
      default:
        console.log(`Unhandled Razorpay webhook event: ${event}`);
        // Log the full webhook data for debugging
        console.log('Webhook data:', JSON.stringify(req.body, null, 2));
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook handler error:', error);
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

// Handle payment dropped (user abandoned payment)
async function handlePaymentDropped(order, payment) {
  try {
    const { order_id } = order;
    console.log(`🚫 Payment dropped for order: ${order_id}`);
    
    // Find user by pending order ID and clear pending data
    const user = await User.findOne({ pendingOrderId: order_id });
    if (user) {
      await User.findByIdAndUpdate(user._id, {
        pendingOrderId: null,
        pendingPlanType: null,
        orderCreatedAt: null
      });
      
      console.log(`Cleared pending order data for dropped payment: ${user.email}`);
    }
    
  } catch (error) {
    console.error('Error handling payment drop:', error);
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

// POST /api/payment/verify-payment - Verify Razorpay payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const user = req.user;
    
    // Check if user has pending order
    if (user.pendingOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    // Verify payment signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');
    
    if (signature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    
    // Query Razorpay API to confirm payment status
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      
      if (payment.status === 'captured') {
        // Payment confirmed - activate plan
        await handlePaymentSuccess({ id: razorpay_order_id }, payment);
        res.json({ success: true, message: 'Payment verified and plan activated' });
      } else {
        res.json({ success: false, message: `Payment status: ${payment.status}` });
      }
      
    } catch (razorpayError) {
      console.error('Error fetching payment from Razorpay:', razorpayError);
      res.status(500).json({ error: 'Failed to verify payment with Razorpay' });
    }
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// GET /api/payment/plans - Get available plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

module.exports = router;
