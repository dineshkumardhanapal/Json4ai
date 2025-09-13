const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const User = require('../models/User');
const { 
  sendSubscriptionConfirmation, 
  sendSubscriptionUpdated, 
  sendSubscriptionCancelled, 
  sendPaymentFailed 
} = require('../mailer');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Plan configuration
const PLANS = {
  'price_starter': {
    name: 'Starter',
    price: 1,
    credits: 30,
    features: [
      '30 JSON prompts per month',
      'Advanced prompt templates',
      'Priority support',
      'Export functionality'
    ]
  },
  'price_premium': {
    name: 'Premium',
    price: 10,
    credits: 100,
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

// POST /api/stripe/checkout - Create checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { priceId } = req.body;
    const user = req.user;

    // Validate price ID
    if (!PLANS[priceId]) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // Check if user already has an active subscription
    if (user.stripeSubscriptionId && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    // Create or retrieve Stripe customer
    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user._id.toString()
        }
      });
      
      // Update user with Stripe customer ID
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId: user._id.toString(),
        priceId: priceId
      },
      subscription_data: {
        metadata: {
          userId: user._id.toString(),
          priceId: priceId
        }
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/create-portal-session - Customer portal
router.post('/create-portal-session', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// GET /api/stripe/subscription - Get current subscription
router.get('/subscription', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeSubscriptionId) {
      return res.json({ subscription: null });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    res.json({ subscription });
  } catch (error) {
    console.error('Subscription retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription' });
  }
});

// POST /api/stripe/cancel - Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Cancel at period end
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update user
    await User.findByIdAndUpdate(user._id, {
      cancelAtPeriodEnd: true,
      subscriptionStatus: subscription.status
    });

    res.json({ message: 'Subscription will be canceled at the end of the current period' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST /api/stripe/reactivate - Reactivate subscription
router.post('/reactivate', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Reactivate subscription
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update user
    await User.findByIdAndUpdate(user._id, {
      cancelAtPeriodEnd: false,
      subscriptionStatus: subscription.status
    });

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// POST /api/stripe/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook event received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Webhook event handlers
async function handleCheckoutCompleted(session) {
  console.log('Checkout completed for session:', session.id);
  
  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await handleSubscriptionCreated(subscription);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  
  const userId = subscription.metadata.userId;
  const priceId = subscription.metadata.priceId;
  const planDetails = PLANS[priceId];
  
  if (!planDetails) {
    console.error('Unknown price ID:', priceId);
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  // Update user subscription details
  const updates = {
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    subscriptionStatus: subscription.status,
    plan: priceId === 'price_starter' ? 'starter' : 'premium',
    credits: planDetails.credits,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    nextBillingDate: new Date(subscription.current_period_end * 1000),
    lastPaymentDate: new Date(),
    planStartDate: new Date(),
    cancelAtPeriodEnd: false
  };

  if (subscription.trial_end) {
    updates.trialEnd = new Date(subscription.trial_end * 1000);
  }

  await User.findByIdAndUpdate(userId, updates);

  // Send confirmation email
  try {
    await sendSubscriptionConfirmation(user, {
      ...planDetails,
      nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString()
    });
    console.log('Subscription confirmation email sent to:', user.email);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  
  const userId = subscription.metadata.userId;
  const user = await User.findById(userId);
  
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  const updates = {
    subscriptionStatus: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    nextBillingDate: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  };

  await User.findByIdAndUpdate(userId, updates);

  // Send update email if plan changed
  if (subscription.metadata.priceId !== user.stripePriceId) {
    const newPlanDetails = PLANS[subscription.metadata.priceId];
    if (newPlanDetails) {
      try {
        await sendSubscriptionUpdated(user, {
          ...newPlanDetails,
          effectiveDate: new Date().toLocaleDateString()
        });
        console.log('Subscription update email sent to:', user.email);
      } catch (error) {
        console.error('Failed to send update email:', error);
      }
    }
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  const userId = subscription.metadata.userId;
  const user = await User.findById(userId);
  
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  // Update user to free plan
  await User.findByIdAndUpdate(userId, {
    plan: 'free',
    credits: 3,
    subscriptionStatus: 'canceled',
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextBillingDate: null,
    cancelAtPeriodEnd: false
  });

  // Send cancellation email
  try {
    const planDetails = {
      name: user.plan === 'starter' ? 'Starter' : 'Premium',
      accessUntil: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
      remainingCredits: user.credits
    };
    
    await sendSubscriptionCancelled(user, planDetails);
    console.log('Subscription cancellation email sent to:', user.email);
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded for invoice:', invoice.id);
  
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata.userId;
    
    // Update user payment info
    await User.findByIdAndUpdate(userId, {
      lastPaymentDate: new Date(),
      subscriptionStatus: subscription.status
    });

    // Reset monthly usage for starter plan
    const user = await User.findById(userId);
    if (user && user.plan === 'starter') {
      await User.findByIdAndUpdate(userId, {
        credits: 30,
        monthlyPromptsUsed: 0,
        lastMonthlyReset: new Date()
      });
    }
  }
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed for invoice:', invoice.id);
  
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata.userId;
    const user = await User.findById(userId);
    
    if (!user) return;

    // Update subscription status
    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: subscription.status
    });

    // Send payment failed email
    try {
      const planDetails = {
        name: user.plan === 'starter' ? 'Starter' : 'Premium',
        price: user.plan === 'starter' ? 1 : 10
      };
      
      await sendPaymentFailed(user, planDetails);
      console.log('Payment failed email sent to:', user.email);
    } catch (error) {
      console.error('Failed to send payment failed email:', error);
    }
  }
}

async function handleTrialWillEnd(subscription) {
  console.log('Trial will end for subscription:', subscription.id);
  
  const userId = subscription.metadata.userId;
  const user = await User.findById(userId);
  
  if (!user) return;

  // Send trial ending notification
  try {
    await sendEmail(
      user.email,
      '🔔 Your JSON4AI Trial is Ending Soon',
      `
        <h2>Hello ${user.firstName}!</h2>
        <p>Your JSON4AI trial will end in 3 days. To continue enjoying premium features, please ensure your payment method is up to date.</p>
        <p><a href="${process.env.FRONTEND_URL}/dashboard">Update Payment Method</a></p>
      `
    );
  } catch (error) {
    console.error('Failed to send trial ending email:', error);
  }
}

module.exports = router;