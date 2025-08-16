const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/profile', auth, async (req, res) => {
  const user = await User.findById(req.user).select('-password');
  res.json(user);
});

router.put('/profile', auth, async (req, res) => {
  const { firstName, lastName } = req.body;
  await User.findByIdAndUpdate(req.user, { firstName, lastName });
  res.json({ ok: true });
});

module.exports = router;