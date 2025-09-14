// Test script for registration endpoint
const fetch = require('node-fetch');

const API_BASE = 'https://json4ai.onrender.com/api';

async function testRegistration() {
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };

  console.log('Testing registration with:', testUser.email);

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Registration successful!');
    } else {
      console.log('❌ Registration failed');
      if (data.errors) {
        console.log('Validation errors:');
        data.errors.forEach(err => {
          console.log(`  - ${err.field}: ${err.message}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the test
testRegistration();
