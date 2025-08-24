# Stripe Subscription Setup Guide for JSON4AI

## Prerequisites

1. **Stripe Account**: Create a Stripe account at [stripe.com](https://stripe.com)
2. **Node.js**: Version 18 or higher
3. **MongoDB**: Running instance
4. **Environment Variables**: Configure your `.env` file

## Environment Variables

Create a `.env` file in your backend directory with the following variables:

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/json4ai

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Email Configuration (Gmail)
EMAIL_USER=json4ai@gmail.com
EMAIL_PASS=muvi_bvft_mavn_oixi

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (replace with your actual price IDs)
STRIPE_STARTER_PRICE_ID=price_starter
STRIPE_PREMIUM_PRICE_ID=price_premium
```

## Stripe Dashboard Setup

### 1. Create Products and Prices

1. Go to your Stripe Dashboard → Products
2. Create two products:

   **Starter Plan:**
   - Name: "JSON4AI Starter"
   - Price: $1/month
   - Billing: Recurring (monthly)
   - Price ID: Copy this ID (starts with `price_`)

   **Premium Plan:**
   - Name: "JSON4AI Premium"
   - Price: $10/month
   - Billing: Recurring (monthly)
   - Price ID: Copy this ID (starts with `price_`)

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Copy the webhook signing secret (starts with `whsec_`)

### 3. Update Price IDs

Update your `.env` file with the actual price IDs from Stripe:

```env
STRIPE_STARTER_PRICE_ID=price_1Oxxxxxxxxx
STRIPE_PREMIUM_PRICE_ID=price_1Oxxxxxxxx
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

## Testing the System

### 1. Test Webhook Endpoint

Use Stripe CLI to test webhooks locally:

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:5000/api/stripe/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
```

### 2. Test Subscription Flow

1. Create a test user account
2. Navigate to pricing page
3. Select a plan and proceed to checkout
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete the subscription
6. Check email for confirmation
7. Verify user plan and credits in database

## API Endpoints

### Stripe Routes

- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/create-portal-session` - Customer portal
- `GET /api/stripe/subscription` - Get current subscription
- `POST /api/stripe/cancel` - Cancel subscription
- `POST /api/stripe/reactivate` - Reactivate subscription
- `POST /api/stripe/webhook` - Stripe webhook handler

### Subscription Service

The system includes a comprehensive subscription service with:
- Credit management
- Plan upgrades/downgrades
- Usage tracking
- Automatic renewals
- Email notifications

## Cron Jobs

The system automatically runs these jobs:

- **Daily Credit Reset**: Resets free plan credits at midnight UTC
- **Monthly Credit Reset**: Resets starter plan credits on the 1st of each month
- **Subscription Status Check**: Daily check for ending subscriptions and past due payments
- **Weekly Usage Reports**: Sends usage summaries to subscribers

## Email Templates

The system sends automated emails for:
- Subscription confirmation
- Plan updates
- Subscription cancellation
- Payment failures
- Trial ending reminders
- Usage reports

## Security Features

- Webhook signature verification
- User authentication middleware
- Credit validation
- Subscription status tracking
- Secure payment processing

## Monitoring

Monitor your system through:
- Stripe Dashboard for payment status
- Application logs for webhook events
- Database for user subscription status
- Email delivery reports

## Troubleshooting

### Common Issues

1. **Webhook failures**: Check webhook secret and endpoint URL
2. **Email not sending**: Verify Gmail app password
3. **Credits not resetting**: Check cron job logs
4. **Subscription not updating**: Verify webhook events are being received

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

### Logs

Check server logs for:
- Webhook event processing
- Email sending status
- Credit reset operations
- Subscription updates

## Production Deployment

1. Update environment variables for production
2. Use production Stripe keys
3. Configure production webhook endpoints
4. Set up monitoring and alerting
5. Enable SSL/TLS
6. Configure proper logging

## Support

For issues related to:
- **Stripe**: Contact Stripe Support
- **Application**: Check logs and documentation
- **Email**: Verify Gmail configuration
- **Database**: Check MongoDB connection and logs
