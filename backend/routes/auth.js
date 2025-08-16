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
      from: '"JSON4AI" <noreply@json4ai.onrender.com>',
      to: email,
      subject: 'Verify your account',
      html: `<p>Click to verify: <a href="${verifyLink}">${verifyLink}</a></p>`
    });

    res.json({ message: 'Registration email sent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/verify/:token
router.get('/verify/:token', async (req, res) => {
  const user = await User.findOne({ verifyToken: req.params.token });
  if (!user) return res.status(400).send('Invalid or expired token');

  user.verified = true;
  user.verifyToken = undefined;
  await user.save();

  res.send('✅ Email verified! Close this tab and log in.');
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