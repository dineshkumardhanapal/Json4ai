const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const transporter = require('../mailer');

// POST /api/register
router.post('/register', async (req, res) => {
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

    // Redirect to the frontend verification success page
    res.redirect('https://json4ai.onrender.com/email-verified.html');
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.verified) return res.status(401).json({ message: 'Please verify your email' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;