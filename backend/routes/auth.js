const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { transporter } = require('../mailer');
const auth = require('../middleware/auth');
const { validateRegistration, validateLogin, validatePasswordUpdate } = require('../middleware/validation');
const { PasswordSecurity, JWTSecurity } = require('../middleware/authSecurity');
const { PasswordPolicyEnforcer } = require('../middleware/passwordPolicy');
const { AccessControlManager } = require('../middleware/accessControl');
const { ZeroTrustManager } = require('../middleware/zeroTrust');

// Google OAuth Verification
const { OAuth2Client } = require('google-auth-library');

// POST /api/register
router.post('/register', validateRegistration, async (req, res) => {
  try {
    console.log('Registration request body:', JSON.stringify(req.body, null, 2));
    console.log('Registration request keys:', Object.keys(req.body || {}));
    
    const { firstName, lastName, email, password } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      console.log('Missing required fields:', { firstName: !!firstName, lastName: !!lastName, email: !!email, password: !!password });
      return res.status(400).json({ 
        message: 'Missing required fields',
        errors: [
          { field: 'firstName', message: firstName ? 'Valid' : 'First name is required' },
          { field: 'lastName', message: lastName ? 'Valid' : 'Last name is required' },
          { field: 'email', message: email ? 'Valid' : 'Email is required' },
          { field: 'password', message: password ? 'Valid' : 'Password is required' }
        ].filter(err => err.message !== 'Valid')
      });
    }
    
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });

    // Enhanced password policy validation
    const userInfo = { firstName, lastName, email };
    const passwordValidation = PasswordPolicyEnforcer.validatePassword(password, userInfo);
    
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        recommendations: passwordValidation.recommendations,
        strength: passwordValidation.strength,
        compliance: passwordValidation.compliance
      });
    }
    
    // Enhanced password hashing with additional security
    const passwordData = await PasswordSecurity.hashPassword(password);
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate password expiry date
    const passwordExpiryDate = new Date();
    passwordExpiryDate.setDate(passwordExpiryDate.getDate() + 90); // 90 days

    await User.create({ 
      firstName, 
      lastName, 
      email, 
      password: passwordData.hash,
      passwordSalt: passwordData.salt,
      passwordRounds: passwordData.rounds,
      passwordCreatedAt: passwordData.timestamp,
      passwordExpiryDate,
      passwordHistory: [{
        hash: passwordData.hash,
        createdAt: passwordData.timestamp,
        expiresAt: passwordExpiryDate
      }],
      verified: false, 
      verifyToken: token,
      role: 'free_user',
      securityStatus: {
        riskScore: 0,
        lastRiskAssessment: new Date(),
        securityFlags: [],
        requiresPasswordChange: false,
        accountLocked: false
      }
    });

    const verifyLink = `${process.env.BACKEND_URL || 'https://json4ai.onrender.com'}/api/verify/${token}`;
    
    try {
      const { sendEmail } = require('../mailer');
      
      const emailResult = await sendEmail(
        email,
        'Verify your JSON4AI account',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">JSON4AI</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Account Verification Required</p>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Welcome to JSON4AI!</h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                Thank you for creating your account! To complete your registration and start using JSON4AI, 
                please verify your email address by clicking the button below.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyLink}" 
                   style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
                If the button doesn't work, you can also copy and paste this link into your browser:<br>
                <a href="${verifyLink}" style="color: #8b5cf6; word-break: break-all;">${verifyLink}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                This verification link will expire in 24 hours. If you didn't create this account, 
                you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2025 JSON4AI. All rights reserved.
              </p>
            </div>
          </div>
        `
      );
      
      console.log(`Verification email result:`, emailResult);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails - user can resend later
    }

    res.json({ message: 'Registration successful! Please check your email to verify your account before logging in.' });
  } catch (err) {
    console.error('Registration error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      message: 'Registration failed due to server error',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET /api/verify/:token
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verifyToken: req.params.token });
    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8"/>
          <title>Verification Failed – JSON4AI</title>
          <meta name="viewport" content="width=device-width,initial-scale=1"/>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #0a0a0a; color: white; }
            .error-icon { color: #ef4444; font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #ef4444; margin-bottom: 1rem; }
            p { color: #e5e7eb; margin-bottom: 2rem; }
            .btn { display: inline-block; padding: 0.75rem 1.5rem; background: #8b5cf6; color: white; text-decoration: none; border-radius: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="error-icon">❌</div>
          <h1>Verification Failed</h1>
          <p>This verification link is invalid or has expired.</p>
          <a href="${process.env.FRONTEND_URL || 'https://json4ai.netlify.app'}/register" class="btn">Register Again</a>
        </body>
        </html>
      `);
    }

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - user.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (tokenAge > twentyFourHours) {
      // Clear the expired token
      user.verifyToken = undefined;
      await user.save();
      
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8"/>
          <title>Verification Expired – JSON4AI</title>
          <meta name="viewport" content="width=device-width,initial-scale=1"/>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #0a0a0a; color: white; }
            .warning-icon { color: #f59e0b; font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #f59e0b; margin-bottom: 1rem; }
            p { color: #e5e7eb; margin-bottom: 2rem; }
            .btn { display: inline-block; padding: 0.75rem 1.5rem; background: #8b5cf6; color: white; text-decoration: none; border-radius: 0.5rem; margin: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="warning-icon">⏰</div>
          <h1>Verification Link Expired</h1>
          <p>This verification link has expired (24 hours). Please request a new verification email.</p>
          <a href="${process.env.FRONTEND_URL || 'https://json4ai.netlify.app'}/login" class="btn">Login</a>
          <a href="${process.env.FRONTEND_URL || 'https://json4ai.netlify.app'}/register" class="btn">Register Again</a>
        </body>
        </html>
      `);
    }

    // Check if already verified
    if (user.verified) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8"/>
          <title>Already Verified – JSON4AI</title>
          <meta name="viewport" content="width=device-width,initial-scale=1"/>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #0a0a0a; color: white; }
            .info-icon { color: #3b82f6; font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #3b82f6; margin-bottom: 1rem; }
            p { color: #e5e7eb; margin-bottom: 2rem; }
            .btn { display: inline-block; padding: 0.75rem 1.5rem; background: #8b5cf6; color: white; text-decoration: none; border-radius: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="info-icon">ℹ️</div>
          <h1>Already Verified</h1>
          <p>Your email has already been verified. You can now log in to your account.</p>
          <a href="${process.env.FRONTEND_URL || 'https://json4ai.netlify.app'}/login" class="btn">Login</a>
        </body>
        </html>
      `);
    }

    // Verify the user
    user.verified = true;
    user.verifyToken = undefined;
    await user.save();

    // Send HTML response directly instead of redirecting
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title>Email Verified – JSON4AI</title>
        <meta name="description" content="Your email has been verified successfully."/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-primary: #0a0a0a;
            --bg-secondary: #1a1a1a;
            --bg-card: #1e1e1e;
            --bg-gradient-start: #1a0b2e;
            --bg-gradient-end: #4c1d95;
            --accent-purple: #8b5cf6;
            --accent-purple-light: #a78bfa;
            --text-primary: #ffffff;
            --text-secondary: #e5e7eb;
            --text-muted: #9ca3af;
            --border-color: #374151;
            --radius-lg: 0.75rem;
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem;
          }
          .container {
            max-width: 450px;
            width: 100%;
            text-align: center;
          }
          .success-icon {
            text-align: center;
            margin-bottom: 1.5rem;
          }
          .success-icon svg {
            filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.3));
          }
          h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: var(--text-primary);
          }
          p {
            font-size: 1.1rem;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .btn {
            display: inline-block;
            padding: 0.875rem 2rem;
            border-radius: var(--radius-lg);
            font-weight: 600;
            font-size: 0.95rem;
            text-decoration: none;
            transition: all 0.2s;
            margin: 0.5rem;
          }
          .btn-primary {
            background: linear-gradient(135deg, var(--accent-purple), #7c3aed);
            color: var(--text-primary);
            box-shadow: var(--shadow-lg);
          }
          .btn-primary:hover {
            transform: translateY(-2px);
          }
          .btn-secondary {
            background: transparent;
            border: 2px solid var(--border-color);
            color: var(--text-secondary);
          }
          .btn-secondary:hover {
            border-color: var(--accent-purple);
            color: var(--accent-purple);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="2"/>
              <path d="M9 12l2 2 4-4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1>Email Verified!</h1>
          <p>Your account has been successfully verified. You can now log in to access your dashboard.</p>
          <a href="${process.env.FRONTEND_URL}/login.html" class="btn btn-primary">Continue to Login</a>
          <a href="${process.env.FRONTEND_URL}/index.html" class="btn btn-secondary">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Verification failed. Please try again.');
  }
});

// POST /api/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new verification token
    const token = crypto.randomBytes(32).toString('hex');
    user.verifyToken = token;
    await user.save();
    
    const verifyLink = `${process.env.BACKEND_URL || 'https://json4ai.onrender.com'}/api/verify/${token}`;
    
    try {
      const { sendEmail } = require('../mailer');
      
      await sendEmail(
        email,
        'Verify your JSON4AI account',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">JSON4AI</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Account Verification Required</p>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Verify Your Email</h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                You requested a new verification email. Click the button below to verify your email address.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyLink}" 
                   style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
                If the button doesn't work, you can also copy and paste this link into your browser:<br>
                <a href="${verifyLink}" style="color: #8b5cf6; word-break: break-all;">${verifyLink}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                This verification link will expire in 24 hours. If you didn't request this email, 
                you can safely ignore it.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2025 JSON4AI. All rights reserved.
              </p>
            </div>
          </div>
        `
      );
      
      res.json({ message: 'Verification email sent successfully' });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/manual-verify (Admin endpoint for manual verification)
router.post('/manual-verify', async (req, res) => {
  try {
    const { email, adminKey } = req.body;
    
    // Simple admin key check (in production, use proper admin authentication)
    if (adminKey !== 'json4ai_admin_2025') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: 'User is already verified' });
    }
    
    user.verified = true;
    user.verifyToken = undefined;
    await user.save();
    
    res.json({ 
      message: 'User verified successfully', 
      user: { 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        verified: user.verified 
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new verification token
    const token = crypto.randomBytes(32).toString('hex');
    user.verifyToken = token;
    await user.save();
    
    const verifyLink = `${process.env.BACKEND_URL || 'https://json4ai.onrender.com'}/api/verify/${token}`;
    
    const { sendEmail } = require('../mailer');
    
    await sendEmail(
      email,
      'Verify your JSON4AI account',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">JSON4AI</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Account Verification Required</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Verify Your Email</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
              You requested a new verification email. To complete your registration and start using JSON4AI, 
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyLink}" 
                 style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
              If the button doesn't work, you can also copy and paste this link into your browser:<br>
              <a href="${verifyLink}" style="color: #8b5cf6; word-break: break-all;">${verifyLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
              This verification link will expire in 24 hours. If you didn't request this email, 
              you can safely ignore it.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2025 JSON4AI. All rights reserved.
            </p>
          </div>
        </div>
      `
    );
    
    res.json({ message: 'Verification email sent successfully. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      // Log failed attempt for security monitoring
      console.warn(`Failed login attempt - User not found: ${email}, IP: ${req.ip}`);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    if (!user.verified) {
      return res.status(400).json({ message: 'Please verify your email before logging in' });
    }
    
    // Check for account lockout
    if (user.loginAttempts >= 5 && user.lockUntil && user.lockUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockUntil - new Date()) / 1000);
      return res.status(423).json({ 
        message: 'Account temporarily locked due to too many failed attempts',
        retryAfter: retryAfter
      });
    }
    
    // Enhanced password verification
    const validPassword = await PasswordSecurity.verifyPassword(password, user.password, user.passwordSalt);
    
    if (!validPassword) {
      // Increment failed attempts
      const updateData = {
        $inc: { loginAttempts: 1 },
        $set: { lastFailedLogin: new Date() }
      };
      
      // Lock account after 5 failed attempts for 15 minutes
      if (user.loginAttempts + 1 >= 5) {
        updateData.$set.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      await User.findByIdAndUpdate(user._id, updateData);
      
      console.warn(`Failed login attempt - Invalid password: ${email}, IP: ${req.ip}`);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Reset failed attempts on successful login
    await User.findByIdAndUpdate(user._id, {
      $unset: { 
        loginAttempts: 1, 
        lockUntil: 1, 
        lastFailedLogin: 1 
      },
      $set: { 
        lastLogin: new Date(),
        lastActivity: new Date()
      }
    });
    
    // Generate secure tokens using enhanced JWT security
    const { accessToken, refreshToken } = JWTSecurity.generateTokens(user._id, user.email);
    
    // Hash and store refresh token securely
    const hashedRefreshToken = await JWTSecurity.hashRefreshToken(refreshToken);
    user.refreshToken = hashedRefreshToken;
    await user.save();
    
    // Zero Trust evaluation is handled by middleware for protected routes
    // Login endpoint is excluded from Zero Trust evaluation
    
    // Update user's last known location and device info
    const deviceFingerprint = ZeroTrustManager.generateDeviceFingerprint(req);
    const location = await ZeroTrustManager.getIPLocation(req.ip);
    
    await User.findByIdAndUpdate(user._id, {
      $set: {
        lastKnownLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          country: location.country,
          city: location.city,
          timestamp: new Date()
        }
      },
      $addToSet: {
        trustedDevices: {
          fingerprint: deviceFingerprint,
          name: req.headers['user-agent'] || 'Unknown Device',
          lastUsed: new Date(),
          createdAt: new Date(),
          isActive: true
        }
      }
    });
    
    // Log successful login with Zero Trust evaluation
    console.log(`Successful login with Zero Trust: ${email}, IP: ${req.ip}, Risk Score: ${zeroTrustEvaluation.riskScore}`);
    
    res.json({ 
      message: 'Login successful!', 
      accessToken, 
      refreshToken,
      zeroTrustEvaluation: {
        riskScore: zeroTrustEvaluation.riskScore,
        factors: zeroTrustEvaluation.factors.map(f => ({
          factor: f.factor,
          message: f.message
        }))
      },
      user: { 
        id: user._id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email,
        plan: user.plan,
        dailyUsage: user.dailyUsage,
        credits: user.credits,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        securityStatus: user.securityStatus
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Authentication service temporarily unavailable' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save reset token to user
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();
    
    // Send reset email using the mailer module
    const resetLink = `${process.env.FRONTEND_URL || 'https://json4ai.com'}/reset-password.html?token=${resetToken}`;
    
    const { sendEmail } = require('../mailer');
    
    await sendEmail(
      email,
      'Reset your JSON4AI password',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">JSON4AI</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Reset Your Password</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
              We received a request to reset your password. Click the button below to create a new password.
              If you didn't request this, you can safely ignore this email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
              If the button doesn't work, you can also copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color: #8b5cf6; word-break: break-all;">${resetLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
              This reset link will expire in 1 hour for security reasons. 
              If you need a new link, please request another password reset.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2025 JSON4AI. All rights reserved.
            </p>
          </div>
        </div>
      `
    );
    
    res.json({ message: 'Password reset email sent successfully!' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    // Validate input
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    
    // Find user with valid reset token
    const user = await User.findOne({ 
      resetToken: token, 
      resetTokenExpiry: { $gt: Date.now() } 
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token. Please request a new password reset.' });
    }
    
    // Hash new password
    const hash = await bcrypt.hash(password, 10);
    
    // Update user password and clear reset token
    user.password = hash;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    
    res.json({ message: 'Password reset successfully!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
});

// POST /api/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    // Find user and verify refresh token hash
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidRefreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { 
        userId: user._id, 
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      accessToken: newAccessToken,
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      if (decoded.type === 'refresh') {
        // Invalidate refresh token
        await User.findByIdAndUpdate(decoded.id, { 
          $unset: { refreshToken: 1 } 
        });
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Even if token verification fails, still return success
    res.json({ message: 'Logged out successfully' });
  }
});

// POST /api/change-password - Change user password with enhanced security
router.post('/change-password', auth, validatePasswordUpdate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await PasswordSecurity.verifyPassword(
      currentPassword, 
      user.password, 
      user.passwordSalt
    );
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }
    
    // Enhanced password policy validation for new password
    const userInfo = { 
      firstName: user.firstName, 
      lastName: user.lastName, 
      email: user.email 
    };
    const passwordHistory = user.passwordHistory || [];
    const passwordValidation = PasswordPolicyEnforcer.validatePassword(newPassword, userInfo, passwordHistory);
    
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
        recommendations: passwordValidation.recommendations,
        strength: passwordValidation.strength,
        compliance: passwordValidation.compliance
      });
    }
    
    // Hash new password with enhanced security
    const passwordData = await PasswordSecurity.hashPassword(newPassword);
    
    // Calculate new password expiry date
    const passwordExpiryDate = new Date();
    passwordExpiryDate.setDate(passwordExpiryDate.getDate() + 90); // 90 days
    
    // Add to password history
    const newPasswordHistory = [
      {
        hash: passwordData.hash,
        createdAt: passwordData.timestamp,
        expiresAt: passwordExpiryDate
      },
      ...passwordHistory.slice(0, 11) // Keep last 12 passwords
    ];
    
    // Update user password with new security data
    await User.findByIdAndUpdate(user._id, {
      password: passwordData.hash,
      passwordSalt: passwordData.salt,
      passwordRounds: passwordData.rounds,
      passwordCreatedAt: passwordData.timestamp,
      passwordExpiryDate,
      passwordHistory: newPasswordHistory,
      passwordExpiryWarningSent: false,
      // Reset login attempts and lock status
      $unset: { 
        loginAttempts: 1, 
        lockUntil: 1, 
        lastFailedLogin: 1 
      },
      $set: {
        'securityStatus.requiresPasswordChange': false
      }
    });
    
    // Invalidate all existing refresh tokens for security
    await User.findByIdAndUpdate(user._id, {
      $unset: { refreshToken: 1 }
    });
    
    // Log password change
    console.log(`Password changed successfully for user: ${user.email}, IP: ${req.ip}`);
    
    res.json({ 
      message: 'Password changed successfully. Please log in again with your new password.',
      requiresReauth: true
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Password change failed. Please try again.' });
  }
});

// POST /api/check-password-strength - Check password strength with enhanced policy
router.post('/check-password-strength', async (req, res) => {
  try {
    const { password, userInfo } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    // Use enhanced password policy validation
    const validation = PasswordPolicyEnforcer.validatePassword(password, userInfo || {});
    
    res.json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      strength: validation.strength,
      compliance: validation.compliance,
      recommendations: validation.recommendations,
      strengthLevel: validation.strength >= 80 ? 'strong' : 
                    validation.strength >= 60 ? 'medium' : 
                    validation.strength >= 40 ? 'weak' : 'very weak'
    });
  } catch (error) {
    console.error('Password strength check error:', error);
    res.status(500).json({ message: 'Password strength check failed' });
  }
});

// POST /api/generate-secure-password - Generate secure password based on policy
router.post('/generate-secure-password', async (req, res) => {
  try {
    const { length = 16 } = req.body;
    
    if (length < 12 || length > 128) {
      return res.status(400).json({ 
        message: 'Password length must be between 12 and 128 characters' 
      });
    }
    
    const securePassword = PasswordPolicyEnforcer.generateSecurePassword(length);
    
    // Validate the generated password
    const validation = PasswordPolicyEnforcer.validatePassword(securePassword);
    
    res.json({
      password: securePassword,
      strength: validation.strength,
      compliance: validation.compliance,
      isValid: validation.isValid,
      length: securePassword.length
    });
  } catch (error) {
    console.error('Password generation error:', error);
    res.status(500).json({ message: 'Password generation failed' });
  }
});

// GET /api/password-policy - Get current password policy requirements
router.get('/password-policy', async (req, res) => {
  try {
    const { PASSWORD_POLICY } = require('../middleware/passwordPolicy');
    
    res.json({
      policy: {
        minLength: PASSWORD_POLICY.MIN_LENGTH,
        maxLength: PASSWORD_POLICY.MAX_LENGTH,
        requireUppercase: PASSWORD_POLICY.REQUIRE_UPPERCASE,
        requireLowercase: PASSWORD_POLICY.REQUIRE_LOWERCASE,
        requireNumbers: PASSWORD_POLICY.REQUIRE_NUMBERS,
        requireSpecialChars: PASSWORD_POLICY.REQUIRE_SPECIAL_CHARS,
        minUppercase: PASSWORD_POLICY.MIN_UPPERCASE,
        minLowercase: PASSWORD_POLICY.MIN_LOWERCASE,
        minNumbers: PASSWORD_POLICY.MIN_NUMBERS,
        minSpecialChars: PASSWORD_POLICY.MIN_SPECIAL_CHARS,
        allowedSpecialChars: PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS,
        passwordExpiryDays: PASSWORD_POLICY.PASSWORD_EXPIRY_DAYS,
        passwordHistoryCount: PASSWORD_POLICY.PASSWORD_HISTORY_COUNT
      },
      requirements: [
        `Minimum ${PASSWORD_POLICY.MIN_LENGTH} characters`,
        `At least ${PASSWORD_POLICY.MIN_UPPERCASE} uppercase letters`,
        `At least ${PASSWORD_POLICY.MIN_LOWERCASE} lowercase letters`,
        `At least ${PASSWORD_POLICY.MIN_NUMBERS} numbers`,
        `At least ${PASSWORD_POLICY.MIN_SPECIAL_CHARS} special characters`,
        'No common words or patterns',
        'No personal information',
        'No sequential characters',
        'No repeated characters',
        `Expires every ${PASSWORD_POLICY.PASSWORD_EXPIRY_DAYS} days`
      ]
    });
  } catch (error) {
    console.error('Password policy retrieval error:', error);
    res.status(500).json({ message: 'Failed to retrieve password policy' });
  }
});

// POST /api/auth/google - Google OAuth Login
router.post('/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    // Initialize Google OAuth client
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    if (!email) {
      return res.status(400).json({ message: 'Email not provided by Google' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // User exists, update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      user = new User({
        firstName,
        lastName,
        email,
        googleId,
        profilePicture: picture,
        isEmailVerified: true, // Google emails are pre-verified
        role: 'user',
        plan: 'free',
        credits: 3
      });
      
      await user.save();
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = JWTSecurity.generateTokens(user._id, user.email);
    user.refreshToken = await JWTSecurity.hashRefreshToken(refreshToken);
    await user.save();

    // Log successful Google login
    console.log(`✅ Google OAuth login successful for user: ${email}`);

    res.json({
      success: true,
      message: 'Google login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        plan: user.plan,
        credits: user.credits,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    
    if (error.message.includes('Token used too late')) {
      return res.status(400).json({ message: 'Google token has expired. Please try again.' });
    }
    
    if (error.message.includes('Invalid token signature')) {
      return res.status(400).json({ message: 'Invalid Google token. Please try again.' });
    }
    
    res.status(500).json({ 
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test email endpoint for debugging
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Test email sending using the mailer module
    const { sendEmail } = require('../mailer');
    
    await sendEmail(
      email,
      'JSON4AI Email Test',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 2rem;">🎉 JSON4AI Email Test</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Email system verification</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #8b5cf6; margin-top: 0;">✅ Email System Working!</h2>
            <p>This is a test email to verify that the email system is working correctly.</p>
            <p>If you received this email, the email configuration is working properly.</p>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p style="margin: 0; color: #065f46;"><strong>✓ Email Configuration:</strong> Working</p>
              <p style="margin: 5px 0 0 0; color: #065f46;"><strong>✓ SMTP Connection:</strong> Successful</p>
              <p style="margin: 5px 0 0 0; color: #065f46;"><strong>✓ Email Delivery:</strong> Confirmed</p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
              Sent at: ${new Date().toLocaleString()} (${new Date().toISOString()})
            </p>
          </div>
        </div>
      `
    );
    
    res.json({ 
      message: 'Test email sent successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ 
      message: 'Failed to send test email',
      error: error.message,
      details: 'Please check your email configuration (EMAIL_USER and EMAIL_PASS environment variables)'
    });
  }
});

module.exports = router;