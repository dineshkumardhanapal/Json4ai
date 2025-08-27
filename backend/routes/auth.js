const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const transporter = require('../mailer');
const { validateRegistration, validateLogin } = require('../middleware/validation');

// POST /api/register
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    await User.create({ firstName, lastName, email, password: hash, verified: false, verifyToken: token });

    const verifyLink = `https://json4ai.onrender.com/api/verify/${token}`;
    await transporter.sendMail({
      from: '"JSON4AI" <json4ai@gmail.com>',
      to: email,
      subject: 'Verify your JSON4AI account',
      html: `
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
    });

    res.json({ message: 'Registration successful! Please check your email to verify your account before logging in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/verify/:token
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verifyToken: req.params.token });
    if (!user) return res.status(400).send('Invalid or expired token');

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
          <a href="https://json4ai.onrender.com/login.html" class="btn btn-primary">Continue to Login</a>
          <a href="https://json4ai.onrender.com/index.html" class="btn btn-secondary">Back to Home</a>
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
    
    const verifyLink = `https://json4ai.onrender.com/api/verify/${token}`;
    await transporter.sendMail({
      from: '"JSON4AI" <json4ai@gmail.com>',
      to: email,
      subject: 'Verify your JSON4AI account',
      html: `
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
    });
    
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
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.verified) return res.status(401).json({ message: 'Please verify your email' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    // Create access token with 15 minutes expiration (for security)
    const accessToken = jwt.sign(
      { 
        id: user._id, 
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    // Create refresh token with 7 days expiration
    const refreshToken = jwt.sign(
      { 
        id: user._id, 
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Store refresh token hash in user document
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = refreshTokenHash;
    user.lastLogin = new Date();
    await user.save();

    res.json({ 
      accessToken, 
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
        id: user._id, 
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    res.json({ 
      accessToken: newAccessToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
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

module.exports = router;