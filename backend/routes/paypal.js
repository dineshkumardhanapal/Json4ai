const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { 
  sendSubscriptionConfirmation, 
  sendSubscriptionUpdated, 
  sendSubscriptionCancelled, 
  sendPaymentFailed 
} = require('../mailer');

// PayPal configuration
let environment;
let client;

try {
  console.log('Initializing PayPal client...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PAYPAL_CLIENT_ID exists:', !!process.env.PAYPAL_CLIENT_ID);
  console.log('PAYPAL_CLIENT_SECRET exists:', !!process.env.PAYPAL_CLIENT_SECRET);
  
  if (process.env.NODE_ENV === 'production') {
    environment = new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    console.log('Using PayPal Live environment');
  } else {
    environment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    console.log('Using PayPal Sandbox environment');
  }
  
  client = new paypal.core.PayPalHttpClient(environment);
  console.log('PayPal client initialized successfully');
} catch (error) {
  console.error('Failed to initialize PayPal client:', error);
  client = null;
}

// Plan configuration
const PLANS = {
  'starter': {
    name: 'Starter',
    price: 1.00,
    credits: 30,
    paypal_plan_id: process.env.PAYPAL_STARTER_PLAN_ID,
    features: [
      '30 JSON prompts per month',
      'Advanced prompt templates',
      'Priority support',
      'Export functionality'
    ]
  },
  'premium': {
    name: 'Premium',
    price: 10.00,
    credits: 100,
    paypal_plan_id: process.env.PAYPAL_PREMIUM_PLAN_ID,
    features: [
      '100 JSON prompts per month',
      'All Starter features',
      'Custom prompt templates',
      'API access',
      'White-label options',
      '24/7 priority support'
    ]
  }
};

// Log plan configuration for debugging
console.log('PayPal Plans Configuration:');
Object.keys(PLANS).forEach(planKey => {
  const plan = PLANS[planKey];
  console.log(`- ${planKey}: ${plan.name} - Plan ID: ${plan.paypal_plan_id || 'NOT SET'}`);
});

// GET /api/paypal/debug - Debug PayPal configuration (remove in production)
router.get('/debug', (req, res) => {
  try {
    const debugInfo = {
      environment: process.env.NODE_ENV,
      paypalClientId: process.env.PAYPAL_CLIENT_ID ? 'Set' : 'Missing',
      paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ? 'Set' : 'Missing',
      starterPlanId: process.env.PAYPAL_STARTER_PLAN_ID || 'Missing',
      premiumPlanId: process.env.PAYPAL_PREMIUM_PLAN_ID || 'Missing',
      frontendUrl: process.env.FRONTEND_URL || 'Missing',
      paypalClientInitialized: !!client,
      availablePlans: Object.keys(PLANS),
      planDetails: Object.keys(PLANS).map(planKey => ({
        plan: planKey,
        name: PLANS[planKey].name,
        paypalPlanId: PLANS[planKey].paypal_plan_id || 'Not Set'
      }))
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/paypal/create-subscription - Create PayPal subscription
router.post('/create-subscription', auth, async (req, res) => {
  try {
    const { planType } = req.body;
    const user = req.user;

    console.log('Creating subscription for user:', user.email, 'plan:', planType);

    // Validate plan type
    if (!PLANS[planType]) {
      console.error('Invalid plan type:', planType);
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const plan = PLANS[planType];
    
    // Validate PayPal plan ID
    if (!plan.paypal_plan_id || plan.paypal_plan_id === 'P-XXXXXXXXXX') {
      console.error('PayPal plan ID not configured for plan:', planType);
      return res.status(500).json({ 
        error: 'PayPal plan not configured. Please contact support.' 
      });
    }

    console.log('Using PayPal plan ID:', plan.paypal_plan_id);

    // Check if user already has an active subscription
    if (user.paypalSubscriptionId && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    // Validate PayPal client
    if (!client) {
      console.error('PayPal client not initialized');
      return res.status(500).json({ 
        error: 'Payment service not available. Please try again later.' 
      });
    }

    // Create PayPal subscription
    const request = new paypal.subscriptions.SubscriptionsPostRequest();
    request.requestBody({
      plan_id: plan.paypal_plan_id,
      start_time: new Date().toISOString(),
      subscriber: {
        name: {
          given_name: user.firstName,
          surname: user.lastName
        },
        email_address: user.email
      },
      application_context: {
        brand_name: 'JSON4AI',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`
      }
    });

    console.log('Executing PayPal subscription request...');
    const subscription = await client.execute(request);
    console.log('PayPal subscription created:', subscription.result.id);

    // Update user with PayPal subscription details
    await User.findByIdAndUpdate(user._id, {
      paypalSubscriptionId: subscription.result.id,
      paypalPlanType: planType,
      subscriptionStatus: 'pending',
      plan: planType,
      currentPeriodStart: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    // Find approval URL
    const approvalLink = subscription.result.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      console.error('No approval URL found in PayPal response');
      return res.status(500).json({ 
        error: 'PayPal approval URL not found. Please try again.' 
      });
    }

    console.log('Subscription created successfully, redirecting to:', approvalLink.href);

    res.json({ 
      subscriptionId: subscription.result.id,
      approvalUrl: approvalLink.href
    });

  } catch (error) {
    console.error('PayPal subscription creation error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('PAYPAL_CLIENT_ID') || error.message.includes('PAYPAL_CLIENT_SECRET')) {
      return res.status(500).json({ 
        error: 'PayPal configuration error. Please contact support.' 
      });
    }
    
    if (error.message.includes('plan_id')) {
      return res.status(500).json({ 
        error: 'Invalid PayPal plan configuration. Please contact support.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create subscription. Please try again later.' 
    });
  }
});

// POST /api/paypal/webhook - PayPal webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('PayPal webhook received:', event.event_type);

    // Verify webhook signature (recommended for production)
    // await verifyWebhookSignature(req);

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event);
        break;
      
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
      
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handleSubscriptionExpired(event);
        break;
      
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCompleted(event);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentFailed(event);
        break;
      
      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// GET /api/paypal/subscription - Get current subscription
router.get('/subscription', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.paypalSubscriptionId) {
      return res.json({ subscription: null });
    }

    // Get subscription details from PayPal
    const request = new paypal.subscriptions.SubscriptionsGetRequest(user.paypalSubscriptionId);
    const subscription = await client.execute(request);

    res.json({ subscription: subscription.result });
  } catch (error) {
    console.error('Subscription retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription' });
  }
});

// POST /api/paypal/cancel - Cancel subscription
router.post('/cancel', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.paypalSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Cancel subscription in PayPal
    const request = new paypal.subscriptions.SubscriptionsCancelRequest(user.paypalSubscriptionId);
    request.requestBody({
      reason: 'User requested cancellation'
    });

    await client.execute(request);

    // Update user
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'cancelled',
      cancelAtPeriodEnd: true
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST /api/paypal/reactivate - Reactivate subscription
router.post('/reactivate', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.paypalSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Reactivate subscription in PayPal
    const request = new paypal.subscriptions.SubscriptionsActivateRequest(user.paypalSubscriptionId);
    await client.execute(request);

    // Update user
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false
    });

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Webhook event handlers
async function handleSubscriptionActivated(event) {
  console.log('Subscription activated:', event.resource.id);
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) {
    console.error('User not found for subscription:', subscriptionId);
    return;
  }

  const planType = user.paypalPlanType;
  const planDetails = PLANS[planType];

  // Update user subscription details
  const updates = {
    subscriptionStatus: 'active',
    plan: planType,
    credits: planDetails.credits,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastPaymentDate: new Date(),
    planStartDate: new Date(),
    cancelAtPeriodEnd: false
  };

  await User.findByIdAndUpdate(user._id, updates);

  // Send confirmation email
  try {
    await sendSubscriptionConfirmation(user, {
      ...planDetails,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
    });
    console.log('Subscription confirmation email sent to:', user.email);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
}

async function handleSubscriptionUpdated(event) {
  console.log('Subscription updated:', event.resource.id);
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  const updates = {
    subscriptionStatus: event.resource.status,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };

  await User.findByIdAndUpdate(user._id, updates);
}

async function handleSubscriptionCancelled(event) {
  console.log('Subscription cancelled:', event.resource.id);
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // Update user to free plan
  await User.findByIdAndUpdate(user._id, {
    plan: 'free',
    credits: 3,
    subscriptionStatus: 'cancelled',
    paypalSubscriptionId: null,
    paypalPlanType: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextBillingDate: null,
    cancelAtPeriodEnd: false
  });

  // Send cancellation email
  try {
    const planDetails = {
      name: user.plan === 'starter' ? 'Starter' : 'Premium',
      accessUntil: new Date().toLocaleDateString(),
      remainingCredits: user.credits
    };
    
    await sendSubscriptionCancelled(user, planDetails);
    console.log('Subscription cancellation email sent to:', user.email);
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
  }
}

async function handleSubscriptionExpired(event) {
  console.log('Subscription expired:', event.resource.id);
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // Update user to free plan
  await User.findByIdAndUpdate(user._id, {
    plan: 'free',
    credits: 3,
    subscriptionStatus: 'expired'
  });
}

async function handlePaymentCompleted(event) {
  console.log('Payment completed:', event.resource.id);
  
  const subscriptionId = event.resource.custom_id; // You may need to adjust this
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // Update user payment info
  await User.findByIdAndUpdate(user._id, {
    lastPaymentDate: new Date()
  });

  // Reset monthly usage for starter plan
  if (user.plan === 'starter') {
    await User.findByIdAndUpdate(user._id, {
      credits: 30,
      monthlyPromptsUsed: 0,
      lastMonthlyReset: new Date()
    });
  }
}

async function handlePaymentFailed(event) {
  console.log('Payment failed:', event.resource.id);
  
  const subscriptionId = event.resource.custom_id; // You may need to adjust this
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // Update subscription status
  await User.findByIdAndUpdate(user._id, {
    subscriptionStatus: 'payment_failed'
  });

  // Send payment failed email
  try {
    const planDetails = {
      name: user.plan === 'starter' ? 'Starter' : 'Premium',
      price: user.plan === 'starter' ? 1.00 : 10.00
    };
    
    await sendPaymentFailed(user, planDetails);
    console.log('Payment failed email sent to:', user.email);
  } catch (error) {
    console.error('Failed to send payment failed email:', error);
  }
}

// Helper function to verify webhook signature (recommended for production)
async function verifyWebhookSignature(req) {
  // Implement webhook signature verification
  // This is important for production to ensure webhooks are from PayPal
  return true; // Placeholder
}

module.exports = router;
