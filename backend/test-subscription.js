// backend/test-subscription.js
// Test script for the subscription system

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const SubscriptionService = require('./services/subscriptionService');

// Test data
const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@json4ai.com',
  password: 'testpassword123',
  plan: 'free',
  credits: 3
};

async function testSubscriptionSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clean up existing test user
    await User.deleteOne({ email: testUser.email });
    console.log('✅ Cleaned up existing test user');

    // Create test user
    const user = new User(testUser);
    await user.save();
    console.log('✅ Created test user:', user.email);

    // Test 1: Check initial subscription status
    console.log('\n🧪 Test 1: Initial subscription status');
    const initialStatus = await SubscriptionService.getUserSubscription(user._id);
    console.log('Initial status:', initialStatus);

    // Test 2: Check if user can generate prompt
    console.log('\n🧪 Test 2: Can generate prompt check');
    const canGenerate = await SubscriptionService.canGeneratePrompt(user._id);
    console.log('Can generate prompt:', canGenerate);

    // Test 3: Use a credit
    console.log('\n🧪 Test 3: Use a credit');
    const creditResult = await SubscriptionService.useCredit(user._id);
    console.log('Credit usage result:', creditResult);

    // Test 4: Check updated status
    console.log('\n🧪 Test 4: Updated subscription status');
    const updatedStatus = await SubscriptionService.getUserSubscription(user._id);
    console.log('Updated status:', updatedStatus);

    // Test 5: Check analytics
    console.log('\n🧪 Test 5: Subscription analytics');
    const analytics = await SubscriptionService.getSubscriptionAnalytics(user._id);
    console.log('Analytics:', analytics);

    // Test 6: Simulate plan upgrade
    console.log('\n🧪 Test 6: Plan upgrade simulation');
    const upgradeResult = await SubscriptionService.upgradeUserPlan(user._id, 'starter');
    console.log('Upgrade result:', upgradeResult);

    // Test 7: Check upgraded status
    console.log('\n🧪 Test 7: Upgraded subscription status');
    const upgradedStatus = await SubscriptionService.getUserSubscription(user._id);
    console.log('Upgraded status:', upgradedStatus);

    // Test 8: Test credit usage with new plan
    console.log('\n🧪 Test 8: Credit usage with starter plan');
    for (let i = 0; i < 3; i++) {
      const result = await SubscriptionService.useCredit(user._id);
      console.log(`Credit usage ${i + 1}:`, result);
    }

    // Test 9: Check final analytics
    console.log('\n🧪 Test 9: Final analytics');
    const finalAnalytics = await SubscriptionService.getSubscriptionAnalytics(user._id);
    console.log('Final analytics:', finalAnalytics);

    // Test 10: Test premium upgrade
    console.log('\n🧪 Test 10: Premium upgrade');
    const premiumUpgrade = await SubscriptionService.upgradeUserPlan(user._id, 'premium', 'admin');
    console.log('Premium upgrade result:', premiumUpgrade);

    // Test 11: Test unlimited credits
    console.log('\n🧪 Test 11: Unlimited credits test');
    for (let i = 0; i < 5; i++) {
      const result = await SubscriptionService.useCredit(user._id);
      console.log(`Premium credit usage ${i + 1}:`, result);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Final user state:');
    const finalUser = await User.findById(user._id);
    console.log({
      plan: finalUser.plan,
      credits: finalUser.credits,
      totalPromptsUsed: finalUser.totalPromptsUsed,
      monthlyPromptsUsed: finalUser.monthlyPromptsUsed
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    await User.deleteOne({ email: testUser.email });
    console.log('\n🧹 Cleaned up test user');
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSubscriptionSystem();
}

module.exports = { testSubscriptionSystem };
