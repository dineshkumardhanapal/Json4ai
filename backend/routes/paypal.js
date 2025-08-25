const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
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
let paypal;

try {
  console.log('Initializing PayPal client...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PAYPAL_CLIENT_ID exists:', !!process.env.PAYPAL_CLIENT_ID);
  console.log('PAYPAL_CLIENT_SECRET exists:', !!process.env.PAYPAL_CLIENT_SECRET);
  
  // Try different import approaches for PayPal SDK v1.0.3
  try {
    // Method 1: Standard import
    paypal = require('@paypal/checkout-server-sdk');
    console.log('✅ PayPal SDK imported successfully (Method 1)');
  } catch (importError1) {
    console.log('❌ Method 1 failed:', importError1.message);
    
    try {
      // Method 2: Try specific path
      paypal = require('@paypal/checkout-server-sdk/lib');
      console.log('✅ PayPal SDK imported successfully (Method 2)');
    } catch (importError2) {
      console.log('❌ Method 2 failed:', importError2.message);
      
      try {
        // Method 3: Try core module
        paypal = require('@paypal/checkout-server-sdk/lib/core');
        console.log('✅ PayPal SDK imported successfully (Method 3)');
      } catch (importError3) {
        console.log('❌ Method 3 failed:', importError3.message);
        throw new Error('All PayPal SDK import methods failed');
      }
    }
  }
  
  if (process.env.NODE_ENV === 'production') {
    environment = new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    console.log('✅ Live environment created');
  } else {
    environment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    console.log('✅ Sandbox environment created');
  }
  
  client = new paypal.core.PayPalHttpClient(environment);
  console.log('✅ PayPal client created successfully');
  
  // Test PayPal SDK structure
  console.log('🔍 PayPal SDK structure test:');
  console.log('- paypal.core exists:', !!paypal.core);
  console.log('- paypal.subscriptions exists:', !!paypal.subscriptions);
  console.log('- paypal.orders exists:', !!paypal.orders);
  console.log('- paypal.payments exists:', !!paypal.payments);
  
  // Log all available properties
  console.log('📋 Available paypal properties:', Object.keys(paypal));
  
  if (paypal.subscriptions) {
    console.log('📋 Available subscription properties:', Object.keys(paypal.subscriptions));
  }
  
  if (paypal.orders) {
    console.log('📋 Available order properties:', Object.keys(paypal.orders));
  }
  
  // Check for specific classes
  const availableClasses = [];
  if (paypal.subscriptions) {
    ['SubscriptionsCreateRequest', 'SubscriptionsGetRequest', 'SubscriptionsCancelRequest', 'SubscriptionsActivateRequest'].forEach(className => {
      if (paypal.subscriptions[className]) {
        availableClasses.push(`paypal.subscriptions.${className}`);
      }
    });
  }
  
  if (paypal.orders) {
    ['OrdersCreateRequest', 'OrdersGetRequest'].forEach(className => {
      if (paypal.orders[className]) {
        availableClasses.push(`paypal.orders.${className}`);
      }
    });
  }
  
  console.log('✅ Available PayPal classes:', availableClasses);
  
} catch (error) {
  console.error('❌ Failed to initialize PayPal client:', error);
  client = null;
  paypal = null;
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

// GET /api/paypal/config - Check PayPal configuration (remove in production)
router.get('/config', (req, res) => {
  try {
    const configInfo = {
      nodeEnv: process.env.NODE_ENV,
      paypalClientId: process.env.PAYPAL_CLIENT_ID ? 
        `${process.env.PAYPAL_CLIENT_ID.substring(0, 8)}...` : 'Missing',
      paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ? 
        `${process.env.PAYPAL_CLIENT_SECRET.substring(0, 8)}...` : 'Missing',
      starterPlanId: process.env.PAYPAL_STARTER_PLAN_ID || 'Missing',
      premiumPlanId: process.env.PAYPAL_PREMIUM_PLAN_ID || 'Missing',
      frontendUrl: process.env.FRONTEND_URL || 'Missing',
      paypalSdkLoaded: !!paypal,
      paypalClientInitialized: !!client,
      environmentType: environment ? environment.constructor.name : 'Not created',
      availableModules: paypal ? Object.keys(paypal) : [],
      subscriptionClasses: paypal && paypal.subscriptions ? Object.keys(paypal.subscriptions) : [],
      orderClasses: paypal && paypal.orders ? Object.keys(paypal.orders) : []
    };
    
    res.json(configInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/paypal/test - Test PayPal SDK structure (remove in production)
router.get('/test', (req, res) => {
  try {
    const testInfo = {
      paypalSdkLoaded: !!paypal,
      paypalClientInitialized: !!client,
      environment: process.env.NODE_ENV,
      availableModules: paypal ? Object.keys(paypal) : [],
      subscriptionClasses: paypal && paypal.subscriptions ? Object.keys(paypal.subscriptions) : [],
      orderClasses: paypal && paypal.orders ? Object.keys(paypal.orders) : [],
      coreClasses: paypal && paypal.core ? Object.keys(paypal.core) : []
    };
    
    res.json(testInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/paypal/create-subscription - Create PayPal subscription
router.post('/create-subscription', auth, async (req, res) => {
  try {
    // Check if PayPal SDK is available
    if (!paypal || !client) {
      console.error('PayPal SDK not initialized');
      return res.status(500).json({ 
        error: 'Payment service not available. Please try again later.' 
      });
    }

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

    // Create PayPal subscription using REST API since SDK doesn't have subscription classes
    console.log('Creating subscription using PayPal REST API...');
    
    const subscriptionData = {
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
    };

    // Make direct HTTP request to PayPal subscription API
    const paypalUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // First, get access token
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
      console.error('PayPal auth failed:', authError);
      throw new Error('PayPal authentication failed');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

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
      console.error('PayPal subscription creation failed:', errorData);
      throw new Error(`PayPal subscription creation failed: ${errorData}`);
    }

    const subscription = await subscriptionResponse.json();
    console.log('PayPal subscription created:', subscription.id);

    // Update user with PayPal subscription details
    await User.findByIdAndUpdate(user._id, {
      paypalSubscriptionId: subscription.id,
      paypalPlanType: planType,
      subscriptionStatus: 'pending',
      plan: planType,
      currentPeriodStart: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    // Find approval URL
    const approvalLink = subscription.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      console.error('No approval URL found in PayPal response');
      return res.status(500).json({ 
        error: 'PayPal approval URL not found. Please try again.' 
      });
    }

    console.log('Subscription created successfully, redirecting to:', approvalLink.href);

    res.json({ 
      subscriptionId: subscription.id,
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
      console.error('PayPal cancel failed:', errorData);
      throw new Error('Failed to cancel subscription in PayPal');
    }

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
      console.error('PayPal reactivate failed:', errorData);
      throw new Error('Failed to reactivate subscription in PayPal');
    }

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
