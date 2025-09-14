// Debug script to test password validation
const testPassword = '-c7L)z6n?3]YVRkE';

console.log('Testing password:', testPassword);
console.log('Password length:', testPassword.length);

// Test basic requirements
const hasUpperCase = /[A-Z]/.test(testPassword);
const hasLowerCase = /[a-z]/.test(testPassword);
const hasNumbers = /\d/.test(testPassword);
const hasSpecialChar = /[@$!%*?&]/.test(testPassword);

console.log('Has uppercase:', hasUpperCase);
console.log('Has lowercase:', hasLowerCase);
console.log('Has numbers:', hasNumbers);
console.log('Has special char:', hasSpecialChar);

// Test regex from validation.js
const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
const regexTest = regex.test(testPassword);
console.log('Regex test:', regexTest);

if (!regexTest) {
  console.log('❌ Password fails regex validation');
  console.log('Regex pattern:', regex.toString());
} else {
  console.log('✅ Password passes regex validation');
}
