const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// middleware
const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get profile
router.get('/profile', auth, async (req, res) => {
  const user = await User.findById(req.userId).select('-password');
  res.json(user);
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  const { firstName, lastName } = req.body;
  await User.findByIdAndUpdate(req.userId, { firstName, lastName });
  res.json({ ok: true });
});

module.exports = router;