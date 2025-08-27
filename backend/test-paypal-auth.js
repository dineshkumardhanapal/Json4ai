// backend/test-paypal-auth.js
// Test script for PayPal authentication

require('dotenv').config();
const fetch = require('node-fetch');

async function testPayPalAuth() {
  console.log('🔍 Testing PayPal Authentication...');
  console.log('=====================================');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- FORCE_PAYPAL_PRODUCTION:', process.env.FORCE_PAYPAL_PRODUCTION);
  console.log('- PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('- PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('- PAYPAL_STARTER_PLAN_ID:', process.env.PAYPAL_STARTER_PLAN_ID || '❌ Missing');
  console.log('- PAYPAL_PREMIUM_PLAN_ID:', process.env.PAYPAL_PREMIUM_PLAN_ID || '❌ Missing');

  // Determine PayPal URL
  const forcePayPalProduction = process.env.FORCE_PAYPAL_PRODUCTION === 'true';
  const paypalUrl = (process.env.NODE_ENV === 'production' || forcePayPalProduction)
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  console.log('\nPayPal Configuration:');
  console.log('- Using PayPal URL:', paypalUrl);
  console.log('- Environment Type:', paypalUrl.includes('sandbox') ? 'Sandbox' : 'Production');

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.log('\n❌ Missing PayPal credentials. Please check your .env file.');
    return;
  }

  try {
    console.log('\n🔐 Testing PayPal Authentication...');
    
    // Test authentication
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
      console.log('❌ PayPal authentication failed:');
      console.log('- Status:', authResponse.status);
      console.log('- Error:', authError);
      
      if (authError.includes('invalid_client')) {
        console.log('\n💡 Troubleshooting Tips:');
        console.log('1. Check if you\'re using the right credentials for the environment');
        console.log('2. If using production credentials, set FORCE_PAYPAL_PRODUCTION=true');
        console.log('3. If using sandbox credentials, set NODE_ENV=development and FORCE_PAYPAL_PRODUCTION=false');
        console.log('4. Verify your PayPal app is active in the correct environment');
      }
      
      return;
    }

    const authData = await authResponse.json();
    console.log('✅ PayPal authentication successful!');
    console.log('- Access Token:', authData.access_token ? 'Received' : 'Missing');
    console.log('- Token Type:', authData.token_type);
    console.log('- Expires In:', authData.expires_in, 'seconds');

    // Test plan verification
    console.log('\n📋 Testing Plan Verification...');
    
    if (process.env.PAYPAL_STARTER_PLAN_ID && process.env.PAYPAL_STARTER_PLAN_ID !== 'P-XXXXXXXXXX') {
      try {
        const planResponse = await fetch(`${paypalUrl}/v1/billing/plans/${process.env.PAYPAL_STARTER_PLAN_ID}`, {
          headers: {
            'Authorization': `Bearer ${authData.access_token}`
          }
        });

        if (planResponse.ok) {
          const planData = await planResponse.json();
          console.log('✅ Starter Plan verified:');
          console.log('- Plan ID:', planData.id);
          console.log('- Name:', planData.name);
          console.log('- Status:', planData.status);
        } else {
          console.log('❌ Starter Plan verification failed:', planResponse.status);
        }
      } catch (error) {
        console.log('❌ Starter Plan verification error:', error.message);
      }
    }

    if (process.env.PAYPAL_PREMIUM_PLAN_ID && process.env.PAYPAL_PREMIUM_PLAN_ID !== 'P-XXXXXXXXXX') {
      try {
        const planResponse = await fetch(`${paypalUrl}/v1/billing/plans/${process.env.PAYPAL_PREMIUM_PLAN_ID}`, {
          headers: {
            'Authorization': `Bearer ${authData.access_token}`
          }
        });

        if (planResponse.ok) {
          const planData = await planResponse.json();
          console.log('✅ Premium Plan verified:');
          console.log('- Plan ID:', planData.id);
          console.log('- Name:', planData.name);
          console.log('- Status:', planData.status);
        } else {
          console.log('❌ Premium Plan verification failed:', planResponse.status);
        }
      } catch (error) {
        console.log('❌ Premium Plan verification error:', error.message);
      }
    }

    console.log('\n🎉 PayPal authentication test completed successfully!');

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPayPalAuth().then(() => {
    console.log('\n📝 Next Steps:');
    console.log('1. If authentication failed, check your credentials and environment settings');
    console.log('2. If using production credentials, set FORCE_PAYPAL_PRODUCTION=true');
    console.log('3. If using sandbox credentials, ensure NODE_ENV=development');
    console.log('4. Verify your PayPal app is active in the correct environment');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testPayPalAuth };
