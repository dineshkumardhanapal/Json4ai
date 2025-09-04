// Environment variable validation
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_USER',
  'EMAIL_PASS',
  'FRONTEND_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
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
  
  // Validate Razorpay configuration
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.length < 10) {
    throw new Error('RAZORPAY_KEY_ID appears to be invalid');
  }
  
  if (process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET.length < 20) {
    throw new Error('RAZORPAY_KEY_SECRET appears to be invalid');
  }
  
  console.log('✅ Environment variables validated successfully');
};

module.exports = { validateEnvironment };
