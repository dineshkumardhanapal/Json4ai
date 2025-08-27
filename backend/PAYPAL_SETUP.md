# PayPal Subscription Setup Guide for JSON4AI

This guide covers setting up PayPal subscriptions for JSON4AI, replacing the Stripe integration with PayPal's subscription system.

## 🚀 **PayPal Setup Overview**

PayPal provides:
- **Subscription Management**: Recurring billing for your plans
- **Global Payment Support**: Excellent coverage in India and worldwide
- **Webhook Integration**: Real-time subscription updates
- **Sandbox Testing**: Test environment for development
- **Production Ready**: Live environment for real payments

## 📋 **Prerequisites**

1. **PayPal Business Account**: Create at [paypal.com](https://paypal.com)
2. **PayPal Developer Account**: Sign up at [developer.paypal.com](https://developer.paypal.com)
3. **Node.js**: Version 18 or higher
4. **MongoDB**: Running instance
5. **Environment Variables**: Configure your `.env` file

## 🔧 **Environment Variables**

### **Required Variables**
```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here

# PayPal Plan IDs (you'll create these)
PAYPAL_STARTER_PLAN_ID=P-XXXXXXXXXX
PAYPAL_PREMIUM_PLAN_ID=P-XXXXXXXXXX

# PayPal Environment Override (set to 'true' to force production API even in development)
FORCE_PAYPAL_PRODUCTION=false

# Other required variables
MONGO_URI=mongodb://localhost:27017/json4ai
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_key_here
EMAIL_USER=json4ai@gmail.com
EMAIL_PASS=your_gmail_app_password_here
```

## 🏗️ **PayPal Dashboard Setup**

### **1. Create PayPal App**

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Log in with your PayPal account
3. Navigate to "My Apps & Credentials"
4. Click "Create App"
5. Name your app (e.g., "JSON4AI Subscriptions")
6. Choose "Business" account type
7. Copy your Client ID and Secret

### **2. Create Subscription Plans**

#### **Starter Plan ($1/month)**
1. Go to PayPal Dashboard → Products & Services → Subscriptions
2. Click "Create Plan"
3. Fill in details:
   - **Plan Name**: JSON4AI Starter
   - **Description**: 30 JSON prompts per month
   - **Billing Cycle**: Monthly
   - **Amount**: $1.00 USD
   - **Currency**: USD
4. Save and copy the Plan ID (starts with `P-`)

#### **Premium Plan ($10/month)**
1. Create another plan:
   - **Plan Name**: JSON4AI Premium
   - **Description**: 100 JSON prompts per month
   - **Billing Cycle**: Monthly
   - **Amount**: $10.00 USD
   - **Currency**: USD
2. Save and copy the Plan ID

### **3. Configure Webhooks**

1. Go to PayPal Dashboard → Webhooks
2. Click "Add Webhook"
3. **Webhook URL**: `https://yourdomain.com/api/paypal/webhook`
4. **Events to listen for**:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
5. Copy the webhook ID

## 🧪 **Testing Setup**

### **1. Sandbox Environment**
- Use sandbox credentials for development
- Test with sandbox PayPal accounts
- Sandbox plans and webhooks
- Set `NODE_ENV=development` and `FORCE_PAYPAL_PRODUCTION=false`

### **2. Production Environment**
- Switch to live credentials
- Use real PayPal accounts
- Live plans and webhooks
- Set `NODE_ENV=production` OR `FORCE_PAYPAL_PRODUCTION=true`

### **3. Environment Override**
- Use `FORCE_PAYPAL_PRODUCTION=true` to force production API even when `NODE_ENV=development`
- Useful for testing production credentials in development environment
- Helps avoid environment mismatch issues

## 📱 **Frontend Integration**

### **1. Update Pricing Page**
```javascript
// Replace Stripe checkout with PayPal subscription
async function subscribeToPlan(planType) {
  try {
    const response = await fetch('/api/paypal/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ planType })
    });

    const data = await response.json();
    
    if (data.approvalUrl) {
      // Redirect to PayPal for approval
      window.location.href = data.approvalUrl;
    }
  } catch (error) {
    console.error('Subscription error:', error);
  }
}
```

### **2. Success/Cancel Handling**
```javascript
// Handle return from PayPal
function handlePayPalReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const canceled = urlParams.get('canceled');

  if (success === 'true') {
    showSuccessMessage('Subscription activated successfully!');
  } else if (canceled === 'true') {
    showInfoMessage('Subscription was canceled');
  }
}
```

## 🔄 **Webhook Events**

### **Event Types Handled**
1. **`BILLING.SUBSCRIPTION.ACTIVATED`** - New subscription started
2. **`BILLING.SUBSCRIPTION.UPDATED`** - Plan changes or updates
3. **`BILLING.SUBSCRIPTION.CANCELLED`** - Subscription cancelled
4. **`BILLING.SUBSCRIPTION.EXPIRED`** - Subscription expired
5. **`PAYMENT.CAPTURE.COMPLETED`** - Payment successful
6. **`PAYMENT.CAPTURE.DENIED`** - Payment failed

### **Webhook Security**
- Verify webhook signatures in production
- Use HTTPS endpoints
- Validate event data

## 💳 **Subscription Flow**

### **1. User Flow**
1. User selects plan on pricing page
2. Frontend calls `/api/paypal/create-subscription`
3. Backend creates PayPal subscription
4. User redirected to PayPal for approval
5. User approves subscription
6. PayPal sends webhook events
7. Backend processes webhooks and updates user

### **2. Billing Cycle**
- **Monthly billing**: Automatic every 30 days
- **Payment processing**: PayPal handles all payment logic
- **Failed payments**: Automatic retry and notification

## 🔒 **Security Considerations**

### **1. Environment Variables**
- Never commit PayPal credentials to Git
- Use different credentials for sandbox/production
- Rotate secrets regularly

### **2. Webhook Verification**
- Implement webhook signature verification
- Validate webhook payload
- Use HTTPS for all webhook endpoints

### **3. User Authentication**
- Verify user authentication on all endpoints
- Validate subscription ownership
- Implement rate limiting

## 🚀 **Deployment Steps**

### **1. Environment Setup**
```bash
# Install PayPal SDK
npm install @paypal/checkout-server-sdk

# Update environment variables
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_STARTER_PLAN_ID=P-XXXXXXXXXX
PAYPAL_PREMIUM_PLAN_ID=P-XXXXXXXXXX
```

### **2. Test PayPal Configuration**
```bash
# Test authentication and plan verification
node test-paypal-auth.js

# This will verify:
# - Environment configuration
# - PayPal credentials
# - Plan IDs
# - API connectivity
```

### **3. Test Webhooks**
```bash
# Use PayPal webhook simulator
# Or test with sandbox environment
```

### **3. Go Live**
1. Switch to production credentials
2. Update webhook URLs
3. Test with real PayPal accounts
4. Monitor webhook delivery

## 📊 **Monitoring & Maintenance**

### **1. Webhook Monitoring**
- Check webhook delivery status
- Monitor for failed webhooks
- Review webhook logs

### **2. Subscription Analytics**
- Track subscription conversions
- Monitor payment success rates
- Analyze user behavior

### **3. Error Handling**
- Log all webhook errors
- Implement retry logic
- Alert on critical failures

## 🔧 **Troubleshooting**

### **Common Issues**

1. **Client Authentication Failed**
   - **Cause**: Environment mismatch between credentials and API endpoint
   - **Solution**: 
     - For production credentials: Set `FORCE_PAYPAL_PRODUCTION=true`
     - For sandbox credentials: Ensure `NODE_ENV=development` and `FORCE_PAYPAL_PRODUCTION=false`
   - **Test**: Run `node test-paypal-auth.js` to verify configuration

2. **Webhook Not Received**
   - Check webhook URL configuration
   - Verify webhook is active
   - Check server logs

3. **Subscription Not Activating**
   - Verify webhook events
   - Check user database updates
   - Review PayPal subscription status

4. **Payment Failures**
   - Check PayPal account status
   - Verify payment method
   - Review error logs

### **Environment Configuration Issues**

1. **Wrong PayPal API Endpoint**
   - **Symptoms**: "Client Authentication failed" error
   - **Check**: Verify `NODE_ENV` and `FORCE_PAYPAL_PRODUCTION` settings
   - **Fix**: Align environment variables with your PayPal credentials

2. **Credential Mismatch**
   - **Symptoms**: Authentication succeeds but plans not found
   - **Check**: Ensure plan IDs match the environment (sandbox vs production)
   - **Fix**: Use plan IDs from the correct PayPal environment

### **Debug Mode**
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 💰 **Pricing & Fees**

### **PayPal Fees**
- **Domestic**: 2.9% + $0.30 per transaction
- **International**: 4.4% + fixed fee
- **Subscription**: Same fee structure
- **No monthly fees**

### **Cost Optimization**
- Monitor transaction volumes
- Consider PayPal Business account benefits
- Review fee structures regularly

## 📞 **Support Resources**

### **PayPal Support**
- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal Business Support](https://www.paypal.com/us/smarthelp/contact-us)
- [PayPal Community Forums](https://www.paypal-community.com/)

### **JSON4AI Support**
- Check application logs
- Review webhook delivery
- Monitor subscription status

---

## 🎯 **Quick Checklist**

- [ ] Create PayPal Business account
- [ ] Set up PayPal Developer app
- [ ] Create subscription plans
- [ ] Configure webhooks
- [ ] Update environment variables
- [ ] Test sandbox environment
- [ ] Deploy to production
- [ ] Monitor webhook delivery
- [ ] Test live subscriptions

**Remember**: Always test thoroughly in sandbox before going live. PayPal provides excellent tools for testing and debugging subscription flows.
