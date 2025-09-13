#!/usr/bin/env node

/**
 * Script to create a Super Admin user for testing the admin dashboard
 * Usage: node scripts/create-super-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Import User model
const User = require('../models/User');

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('⚠️  Super Admin already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Created: ${existingAdmin.createdAt}`);
      
      const shouldContinue = process.argv.includes('--force');
      if (!shouldContinue) {
        console.log('\n💡 To create a new super admin, use --force flag');
        process.exit(0);
      }
    }

    // Generate secure password or use from environment
    const password = process.env.SUPER_ADMIN_PASSWORD || generateSecurePassword();
    const saltRounds = 12;
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);
    const additionalSalt = crypto.randomBytes(32).toString('hex');

    // Create super admin user
    const superAdmin = new User({
      firstName: 'Super',
      lastName: 'Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@json4ai.com',
      password: passwordHash,
      passwordSalt: additionalSalt,
      passwordRounds: saltRounds,
      passwordCreatedAt: new Date(),
      passwordExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      role: 'super_admin',
      emailVerified: true,
      subscriptionStatus: 'active',
      subscriptionPlan: 'premium',
      subscriptionAmount: 0, // Free for admin
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      mfaEnabled: false,
      permissions: [
        {
          action: 'admin',
          resource: 'system_config',
          allowed: true,
          grantedAt: new Date(),
          grantedBy: 'system'
        },
        {
          action: 'admin',
          resource: 'user_management',
          allowed: true,
          grantedAt: new Date(),
          grantedBy: 'system'
        },
        {
          action: 'admin',
          resource: 'analytics',
          allowed: true,
          grantedAt: new Date(),
          grantedBy: 'system'
        },
        {
          action: 'admin',
          resource: 'security',
          allowed: true,
          grantedAt: new Date(),
          grantedBy: 'system'
        }
      ],
      securityStatus: {
        riskScore: 0,
        lastRiskAssessment: new Date(),
        securityFlags: [],
        requiresPasswordChange: false,
        accountLocked: false
      },
      behaviorPatterns: {
        averageSessionDuration: 0,
        typicalAccessTimes: [],
        commonIPs: [],
        typicalUserAgent: '',
        lastUpdated: new Date()
      }
    });

    // Save super admin
    await superAdmin.save();
    
    console.log('\n🎉 Super Admin created successfully!');
    console.log('📋 Account Details:');
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   Created: ${superAdmin.createdAt}`);
    
    console.log('\n🔐 Security Information:');
    console.log(`   Password Hash: ${passwordHash.substring(0, 20)}...`);
    console.log(`   Salt Rounds: ${saltRounds}`);
    console.log(`   Additional Salt: ${additionalSalt.substring(0, 20)}...`);
    console.log(`   Password Expiry: ${superAdmin.passwordExpiryDate}`);
    
    console.log('\n🛡️ Permissions:');
    superAdmin.permissions.forEach(permission => {
      console.log(`   - ${permission.action} on ${permission.resource}: ${permission.allowed ? '✅' : '❌'}`);
    });
    
    console.log('\n📝 Next Steps:');
    console.log('1. Save the password securely');
    console.log('2. Access the admin dashboard at /admin-dashboard.html');
    console.log('3. Login with the credentials above');
    console.log('4. Change the password after first login');
    console.log('5. Enable MFA for enhanced security');
    
    console.log('\n⚠️  Important Security Notes:');
    console.log('- This password is temporary and should be changed immediately');
    console.log('- Enable MFA for additional security');
    console.log('- Keep these credentials secure and confidential');
    console.log('- Consider using a password manager for secure storage');
    
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

function generateSecurePassword() {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required type
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Run the script
if (require.main === module) {
  createSuperAdmin();
}

// Also run if environment variables are set
if (process.env.CREATE_SUPER_ADMIN === 'true') {
  console.log('🔧 Environment variable CREATE_SUPER_ADMIN detected, creating super admin...');
  createSuperAdmin();
}

module.exports = { createSuperAdmin };
