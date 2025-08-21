const express = require('express');
const router = express.Router();
const Replicate = require('replicate');
const Prompt = require('../models/Prompt');
const User   = require('../models/User');
const creditCheck = require('../middleware/credit');
const auth = require('../middleware/auth');

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// POST /api/prompt/generate
router.post('/generate', auth, creditCheck, async (req, res) => {
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

    // Generate prompt using Llama-3.1-8B via Replicate
    const prompt = `You are a JSON prompt generator. Based on the user's comment, generate a structured JSON prompt that can be used for AI applications. The response should be valid JSON format.

User Comment: "${comment}"

Generate a JSON prompt that includes:
- A clear instruction or query
- Any specific parameters or constraints
- The expected output format
- Context or background information if relevant

Return only the JSON object, no additional text:`;

    const output = await replicate.run(
      "meta-llama/llama-3.1-8b-instruct:6b4c817dd9768399e6b659b8f5b2fd9f306090d80fe376e88d473c9d4ca2fcde",
      {
        input: {
          prompt: prompt,
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 50,
          repetition_penalty: 1.1
        }
      }
    );

    // Clean and parse the output
    let jsonPrompt;
    try {
      // Extract JSON from the response (remove any markdown formatting)
      const cleanOutput = Array.isArray(output) ? output.join('') : String(output);
      const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        jsonPrompt = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        jsonPrompt = {
          user_query: comment,
          generated_prompt: cleanOutput,
          structured: false,
          note: "AI response could not be parsed as JSON"
        };
      }
    } catch (parseError) {
      // Fallback if JSON parsing fails
      jsonPrompt = {
        user_query: comment,
        generated_prompt: Array.isArray(output) ? output.join('') : String(output),
        structured: false,
        note: "AI response could not be parsed as valid JSON"
      };
    }

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
      totalPromptsUsed: user.totalPromptsUsed,
      aiGenerated: true
    });
  } catch (error) {
    console.error('Prompt generation error:', error);
    
    // If it's a Replicate API error, provide specific feedback
    if (error.message.includes('REPLICATE_API_TOKEN') || error.message.includes('Unauthorized')) {
      return res.status(500).json({ 
        message: 'AI service temporarily unavailable. Please try again later.',
        error: 'API configuration issue'
      });
    }
    
    res.status(500).json({ message: 'Failed to generate prompt. Please try again.' });
  }
});

// GET /api/prompt/history
router.get('/history', auth, async (req, res) => {
  try {
    // User is already authenticated and available as req.user from auth middleware
    const prompts = await Prompt.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    console.error('Prompt history error:', error);
    res.status(500).json({ message: 'Failed to fetch prompt history' });
  }
});

// GET /api/prompt/usage
router.get('/usage', auth, async (req, res) => {
  try {
    // User is already authenticated and available as req.user from auth middleware
    const user = req.user;
    
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