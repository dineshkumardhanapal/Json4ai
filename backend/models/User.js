const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true, minlength: 6 },
  verified:  { type: Boolean, default: false },
  verifyToken: String,
  credits:   { type: Number, default: 3 },
  plan:      { type: String, enum: ['free','starter','premium'], default: 'free' },
  lastFreeReset: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);