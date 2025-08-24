const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const User = require('../models/User');
const { 
  sendSubscriptionConfirmation, 
  sendSubscriptionUpdated, 
  sendSubscriptionCancelled, 
  sendPaymentFailed 
} = require('../mailer');

// PayPal configuration
let environment;
if (process.env.NODE_ENV === 'production') {
  environment = new paypal.core.LiveEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
} else {
  environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
}

const client = new paypal.core.PayPalHttpClient(environment);

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

// POST /api/paypal/create-subscription - Create PayPal subscription
router.post('/create-subscription', async (req, res) => {
  try {
    const { planType } = req.body;
    const user = req.user;

    // Validate plan type
    if (!PLANS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Check if user already has an active subscription
    if (user.paypalSubscriptionId && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    const plan = PLANS[planType];

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

    const subscription = await client.execute(request);

    // Update user with PayPal subscription details
    await User.findByIdAndUpdate(user._id, {
      paypalSubscriptionId: subscription.result.id,
      paypalPlanType: planType,
      subscriptionStatus: 'pending',
      plan: planType,
      currentPeriodStart: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    res.json({ 
      subscriptionId: subscription.result.id,
      approvalUrl: subscription.result.links.find(link => link.rel === 'approve').href
    });

  } catch (error) {
    console.error('PayPal subscription creation error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
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
router.get('/subscription', async (req, res) => {
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
router.post('/cancel', async (req, res) => {
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
router.post('/reactivate', async (req, res) => {
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
