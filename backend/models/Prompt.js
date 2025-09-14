// models/Prompt.js
const mongoose = require('mongoose');
const promptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment: String,
  prompt: String,
  model: { type: String, default: 'llama-3.1-8b-instruct' },
  qualityTier: { 
    type: String, 
    enum: ['free', 'standard', 'premium'], 
    default: 'free' 
  },
  // Add expiration field for TTL
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, { timestamps: true });

// Create TTL index for automatic cleanup
promptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Prompt', promptSchema);