// models/Prompt.js
const mongoose = require('mongoose');
const promptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment: String,
  prompt: String,
  model: { type: String, default: 'llama-3.1-8b-instruct' }
}, { timestamps: true });
module.exports = mongoose.model('Prompt', promptSchema);