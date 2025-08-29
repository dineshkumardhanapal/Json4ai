// Environment variable validation
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS',
  'FRONTEND_URL',
  'CASHFREE_APP_ID',
  'CASHFREE_SECRET_KEY'
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
  

  
  // Validate email configuration
  if (process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('@')) {
    throw new Error('Invalid EMAIL_USER format');
  }
  
  // Validate Cashfree configuration
  if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_APP_ID.length < 10) {
    throw new Error('CASHFREE_APP_ID appears to be invalid');
  }
  
  if (process.env.CASHFREE_SECRET_KEY && process.env.CASHFREE_SECRET_KEY.length < 20) {
    throw new Error('CASHFREE_SECRET_KEY appears to be invalid');
  }
  
  console.log('✅ Environment variables validated successfully');
};

module.exports = { validateEnvironment };
