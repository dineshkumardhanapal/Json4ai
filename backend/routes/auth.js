const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const transporter = require('../mailer');

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    await User.create({ firstName, lastName, email, password: hash, verified: false, verifyToken: token });

    const verifyLink = `${process.env.FRONTEND_URL}/api/verify/${token}`;
    await transporter.sendMail({
      from: '"JSON4AI" <json4ai@gmail.com>',
      to: email,
      subject: 'Verify your JSON4AI account',
      html: `
        <div style="font-family:Inter;color:#1f2937">
          <h2>Welcome to JSON4AI!</h2>
          <p>Click the link to verify your account:</p>
          <a href="${verifyLink}" style="background:#8b5cf6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Verify Email</a>
        </div>
      `
    });

    res.json({ message: 'Registration successful! Please check your email to verify your account before logging in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify email
router.get('/verify/:token', async (req, res) => {
  const user = await User.findOne({ verifyToken: req.params.token });
  if (!user) return res.status(400).send('Invalid or expired token');

  user.verified = true;
  user.verifyToken = undefined;
  await user.save();

  res.send(`
    <!doctype html>
    <html>
      <head><title>Email Verified – JSON4AI</title></head>
      <body style="text-align:center;font-family:Inter;padding:4rem">
        <h1>✅ Email verified!</h1>
        <p>You may now <a href="${process.env.FRONTEND_URL}/login.html" style="color:#8b5cf6">log in</a>.</p>
      </body>
    </html>
  `);
});

// Login (only verified users)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  if (!user.verified) return res.status(401).json({ message: 'Please verify your email' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;