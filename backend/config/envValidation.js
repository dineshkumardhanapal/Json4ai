// Environment variable validation
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_STARTER_PLAN_ID',
  'PAYPAL_PREMIUM_PLAN_ID',
  'FRONTEND_URL'
];

const validateEnvironment = () => {
  const missingVars = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validate JWT secrets are strong enough
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  
  // Validate MongoDB URI format
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb://') && !process.env.MONGO_URI.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB URI format');
  }
  
  // Validate PayPal plan IDs
  if (process.env.PAYPAL_STARTER_PLAN_ID && process.env.PAYPAL_STARTER_PLAN_ID === 'P-XXXXXXXXXX') {
    throw new Error('PAYPAL_STARTER_PLAN_ID must be set to a valid PayPal plan ID');
  }
  
  if (process.env.PAYPAL_PREMIUM_PLAN_ID && process.env.PAYPAL_PREMIUM_PLAN_ID === 'P-XXXXXXXXXX') {
    throw new Error('PAYPAL_PREMIUM_PLAN_ID must be set to a valid PayPal plan ID');
  }
  
  // Validate email configuration
  if (process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('@')) {
    throw new Error('Invalid EMAIL_USER format');
  }
  
  console.log('✅ Environment variables validated successfully');
};

module.exports = { validateEnvironment };
