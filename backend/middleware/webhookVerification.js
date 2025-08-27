const crypto = require('crypto');

// Verify PayPal webhook signature
const verifyPayPalWebhook = (req, res, next) => {
  try {
    // Get the webhook signature from headers
    const signature = req.headers['paypal-transmission-sig'];
    const timestamp = req.headers['paypal-transmission-time'];
    const webhookId = req.headers['paypal-transmission-id'];
    const certUrl = req.headers['paypal-cert-url'];
    
    if (!signature || !timestamp || !webhookId || !certUrl) {
      return res.status(400).json({ error: 'Missing webhook signature headers' });
    }
    
    // In production, you should verify the certificate URL is from PayPal
    if (process.env.NODE_ENV === 'production') {
      const paypalDomain = process.env.FORCE_PAYPAL_PRODUCTION === 'true' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com';
      
      if (!certUrl.startsWith(paypalDomain)) {
        return res.status(400).json({ error: 'Invalid certificate URL' });
      }
    }
    
    // For now, we'll accept the webhook (in production, implement full signature verification)
    // TODO: Implement full PayPal webhook signature verification
    // This requires downloading PayPal's public certificate and verifying the signature
    
    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
};

// Verify webhook timestamp (prevent replay attacks)
const verifyWebhookTimestamp = (req, res, next) => {
  try {
    const timestamp = req.headers['paypal-transmission-time'];
    if (!timestamp) {
      return res.status(400).json({ error: 'Missing timestamp' });
    }
    
    const webhookTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - webhookTime);
    
    // Reject webhooks older than 5 minutes
    if (timeDiff > 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Webhook too old' });
    }
    
    next();
  } catch (error) {
    console.error('Timestamp verification error:', error);
    return res.status(400).json({ error: 'Timestamp verification failed' });
  }
};

module.exports = {
  verifyPayPalWebhook,
  verifyWebhookTimestamp
};
