// backend/test-paypal.js
// Test script for PayPal integration

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Test PayPal configuration
console.log('🔍 Testing PayPal Configuration...');
console.log('=====================================');

// Check environment variables
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('- PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('- PAYPAL_STARTER_PLAN_ID:', process.env.PAYPAL_STARTER_PLAN_ID ? '✅ Set' : '❌ Missing');
console.log('- PAYPAL_PREMIUM_PLAN_ID:', process.env.PAYPAL_PREMIUM_PLAN_ID ? '✅ Set' : '❌ Missing');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || '❌ Missing');

console.log('\n📋 PayPal Plan IDs:');
console.log('- Starter Plan ID:', process.env.PAYPAL_STARTER_PLAN_ID || 'NOT SET');
console.log('- Premium Plan ID:', process.env.PAYPAL_PREMIUM_PLAN_ID || 'NOT SET');

// Test PayPal SDK
console.log('\n🔧 Testing PayPal SDK...');
try {
  const paypal = require('@paypal/checkout-server-sdk');
  console.log('✅ PayPal SDK imported successfully');
  
  // Test environment creation
  let environment;
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
  
  // Test client creation
  const client = new paypal.core.PayPalHttpClient(environment);
  console.log('✅ PayPal client created successfully');
  
} catch (error) {
  console.error('❌ PayPal SDK test failed:', error.message);
}

// Test database connection
console.log('\n🗄️ Testing Database Connection...');
async function testDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
    
    // Test user model
    const userCount = await User.countDocuments();
    console.log(`✅ User model working - ${userCount} users in database`);
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

// Test environment file
console.log('\n📁 Environment File Check:');
console.log('- .env file exists:', require('fs').existsSync('.env') ? '✅ Yes' : '❌ No');
console.log('- .env.paypal.example exists:', require('fs').existsSync('.env.paypal.example') ? '✅ Yes' : '❌ No');

// Run database test
testDatabase().then(() => {
  console.log('\n🎯 PayPal Integration Test Complete!');
  console.log('\n📝 Next Steps:');
  console.log('1. Set your PayPal environment variables in .env file');
  console.log('2. Create subscription plans in PayPal Dashboard');
  console.log('3. Update the plan IDs in your .env file');
  console.log('4. Test the subscription flow');
  
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
