const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validatePayPalSubscription } = require('../middleware/validation');
const { verifyPayPalWebhook, verifyWebhookTimestamp } = require('../middleware/webhookVerification');
const { 
  sendSubscriptionConfirmation, 
  sendSubscriptionUpdated, 
  sendSubscriptionCancelled, 
  sendPaymentFailed 
} = require('../mailer');

// PayPal configuration

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

// Plan configuration loaded

// Debug route removed for production security

// Test plans route removed for production security

// Config route removed for production security

// Test route removed for production security

// POST /api/paypal/create-subscription - Create PayPal subscription
router.post('/create-subscription', auth, validatePayPalSubscription, async (req, res) => {
  // Set CSP headers to allow PayPal resources and your own API
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://*.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "img-src 'self' data: https: blob: https://*.paypal.com https://*.paypalobjects.com",
      "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://api-m.sandbox.paypal.com https://api-m.paypal.com https://*.onrender.com https://json4ai.onrender.com",
      "frame-src 'self' https://*.paypal.com https://*.paypalobjects.com",
      "frame-ancestors 'self'",
      "form-action 'self' https://*.paypal.com"
    ].join('; ')
  });

  try {
    // Check if PayPal SDK is available
    // No SDK initialization needed, using REST API directly

    const { planType } = req.body;
    const user = req.user;

    // Creating subscription for user

    // Validate plan type
    if (!PLANS[planType]) {
      // Invalid plan type
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const plan = PLANS[planType];
    
    // Validate PayPal plan ID
    if (!plan.paypal_plan_id || plan.paypal_plan_id === 'P-XXXXXXXXXX') {
      // PayPal plan ID not configured
      return res.status(500).json({ 
        error: 'PayPal plan not configured. Please contact support.' 
      });
    }

    // Using configured PayPal plan ID

    // Check if user already has an active subscription
    if (user.paypalSubscriptionId && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    // Validate PayPal client
    // No client initialization needed, using REST API directly

    // Make direct HTTP request to PayPal subscription API
    // Add environment override for PayPal
    const forcePayPalProduction = process.env.FORCE_PAYPAL_PRODUCTION === 'true';
    const paypalUrl = (process.env.NODE_ENV === 'production' || forcePayPalProduction)
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
    
    // Getting PayPal access token
    
    const authResponse = await fetch(`${paypalUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text();
      throw new Error(`PayPal authentication failed: ${authError}`);
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Verify the plan exists before creating subscription
    const planCheckResponse = await fetch(`${paypalUrl}/v1/billing/plans/${plan.paypal_plan_id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!planCheckResponse.ok) {
      const planError = await planCheckResponse.text();
      throw new Error(`Plan verification failed: ${planError}`);
    }

    const planData = await planCheckResponse.json();
    // Plan verified successfully
    
    const subscriptionData = {
      plan_id: plan.paypal_plan_id,
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
      },
      // Add custom_id to help identify the subscription
      custom_id: `user_${user._id}_${planType}`
    };

    // Subscription data prepared

    // Create subscription
    const subscriptionResponse = await fetch(`${paypalUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.text();
      throw new Error(`PayPal subscription creation failed: ${errorData}`);
    }

    const subscription = await subscriptionResponse.json();

    // Update user with PayPal subscription details
    await User.findByIdAndUpdate(user._id, {
      paypalSubscriptionId: subscription.id,
      paypalPlanType: planType,
      subscriptionStatus: 'pending',
      // CRITICAL SECURITY FIX: Do NOT upgrade plan or grant credits until payment is confirmed
      // plan: planType, // REMOVED - Only set after payment confirmation
      // credits: planDetails.credits, // REMOVED - Only grant after payment confirmation
      currentPeriodStart: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    // Find approval URL
    const approvalLink = subscription.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      return res.status(500).json({ 
        error: 'PayPal approval URL not found. Please try again.' 
      });
    }

    res.json({ 
      subscriptionId: subscription.id,
      approvalUrl: approvalLink.href
    });

  } catch (error) {
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
router.post('/webhook', verifyPayPalWebhook, verifyWebhookTimestamp, async (req, res) => {
  try {
    const event = req.body;

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
      
      case 'BILLING.SUBSCRIPTION.PAYMENT_PENDING':
        await handleSubscriptionPaymentPending(event);
        break;
      
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCompleted(event);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentFailed(event);
        break;
      
      default:
        // Unhandled PayPal event type
    }

    res.json({ received: true });
  } catch (error) {
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

    // Get subscription details from PayPal using REST API
    const paypalUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authResponse = await fetch(`${paypalUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      throw new Error('PayPal authentication failed');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Get subscription
    const subscriptionResponse = await fetch(`${paypalUrl}/v1/billing/subscriptions/${user.paypalSubscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!subscriptionResponse.ok) {
      return res.json({ subscription: null });
    }

    const subscription = await subscriptionResponse.json();
    res.json({ subscription });
  } catch (error) {
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

    // Cancel subscription in PayPal using REST API
    const paypalUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authResponse = await fetch(`${paypalUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      throw new Error('PayPal authentication failed');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Cancel subscription
    const cancelResponse = await fetch(`${paypalUrl}/v1/billing/subscriptions/${user.paypalSubscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'User requested cancellation'
      })
    });

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.text();
      throw new Error('Failed to cancel subscription in PayPal');
    }

    // Update user
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'cancelled',
      cancelAtPeriodEnd: true
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
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

    // Reactivate subscription in PayPal using REST API
    const paypalUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authResponse = await fetch(`${paypalUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      throw new Error('PayPal authentication failed');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Reactivate subscription
    const reactivateResponse = await fetch(`${paypalUrl}/v1/billing/subscriptions/${user.paypalSubscriptionId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!reactivateResponse.ok) {
      const errorData = await reactivateResponse.text();
      throw new Error('Failed to reactivate subscription in PayPal');
    }

    // Update user
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false
    });

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Webhook event handlers
async function handleSubscriptionActivated(event) {
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) {
    return;
  }

  const planType = user.paypalPlanType;
  const planDetails = PLANS[planType];

  // SECURITY FIX: Only grant plan access and credits after subscription is ACTIVATED
  // This ensures payment has been processed and confirmed by PayPal
  const updates = {
    subscriptionStatus: 'active',
    plan: planType, // NOW safe to upgrade plan
    credits: planDetails.credits, // NOW safe to grant credits
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
  } catch (error) {
    // Email sending failed
  }
}

async function handleSubscriptionUpdated(event) {
  
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
  } catch (error) {
    // Email sending failed
  }
}

async function handleSubscriptionExpired(event) {
  
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

async function handleSubscriptionPaymentPending(event) {
  
  const subscriptionId = event.resource.id;
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // CRITICAL SECURITY FIX: Ensure user stays on free plan while payment is pending
  // This prevents access to paid features before payment confirmation
  await User.findByIdAndUpdate(user._id, {
    subscriptionStatus: 'payment_pending',
    plan: 'free', // Keep on free plan until payment is confirmed
    credits: 3, // Keep free plan credits
    // Do NOT upgrade plan or grant credits until payment is confirmed
  });
}

async function handlePaymentCompleted(event) {
  
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
  
  const subscriptionId = event.resource.custom_id; // You may need to adjust this
  const user = await User.findOne({ paypalSubscriptionId: subscriptionId });
  
  if (!user) return;

  // CRITICAL SECURITY FIX: Revert user to free plan on payment failure
  // This prevents users from accessing paid features without payment
  const updates = {
    subscriptionStatus: 'payment_failed',
    plan: 'free', // Revert to free plan
    credits: 3, // Reset to free plan credits
    paypalSubscriptionId: null, // Remove subscription ID
    paypalPlanType: null, // Remove plan type
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextBillingDate: null,
    cancelAtPeriodEnd: false
  };

  await User.findByIdAndUpdate(user._id, updates);

  // Send payment failed email
  try {
    const planDetails = {
      name: user.plan === 'starter' ? 'Starter' : 'Premium',
      price: user.plan === 'starter' ? 1.00 : 10.00
    };
    
    await sendPaymentFailed(user, planDetails);
  } catch (error) {
    // Email sending failed
  }
}

// Helper function to verify webhook signature (recommended for production)
async function verifyWebhookSignature(req) {
  // Implement webhook signature verification
  // This is important for production to ensure webhooks are from PayPal
  return true; // Placeholder
}

module.exports = router;
