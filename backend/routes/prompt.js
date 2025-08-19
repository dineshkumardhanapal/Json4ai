const express = require('express');
const router = express.Router();
const Prompt = require('../models/Prompt');
const User   = require('../models/User');
const creditCheck = require('../middleware/credit');

// POST /api/prompt/generate
router.post('/generate', creditCheck, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'Missing comment' });

    const user = req.userObj;
    
    // Use credit using the new method
    if (!user.useCredit()) {
      return res.status(402).json({ 
        message: 'No credits remaining. Please upgrade your plan for unlimited access.',
        currentPlan: user.plan,
        dailyLimit: user.dailyLimit
      });
    }
    
    await user.save();

    // Dummy AI output (replace with Llama call in M3)
    const jsonPrompt = { "user_query": comment, "structured": true };

    const doc = await Prompt.create({ 
      userId: user._id, 
      comment, 
      prompt: JSON.stringify(jsonPrompt) 
    });

    res.json({ 
      prompt: doc.prompt, 
      creditsLeft: user.remainingCredits,
      plan: user.plan,
      dailyLimit: user.dailyLimit,
      totalPromptsUsed: user.totalPromptsUsed
    });
  } catch (error) {
    console.error('Prompt generation error:', error);
    res.status(500).json({ message: 'Failed to generate prompt' });
  }
});

// GET /api/prompt/history
router.get('/history', creditCheck, async (req, res) => {
  try {
    const prompts = await Prompt.find({ userId: req.userObj._id }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    console.error('Prompt history error:', error);
    res.status(500).json({ message: 'Failed to fetch prompt history' });
  }
});

// GET /api/prompt/usage
router.get('/usage', creditCheck, async (req, res) => {
  try {
    const user = req.userObj;
    res.json({
      plan: user.plan,
      dailyLimit: user.dailyLimit,
      remainingCredits: user.remainingCredits,
      totalPromptsUsed: user.totalPromptsUsed,
      monthlyPromptsUsed: user.monthlyPromptsUsed,
      hasUnlimitedAccess: user.hasUnlimitedAccess
    });
  } catch (error) {
    console.error('Usage info error:', error);
    res.status(500).json({ message: 'Failed to fetch usage information' });
  }
});

module.exports = router;