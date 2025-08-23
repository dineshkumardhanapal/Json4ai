const express = require('express');
const router = express.Router();
const Replicate = require('replicate');
const Prompt = require('../models/Prompt');
const User   = require('../models/User');
const creditCheck = require('../middleware/credit');
const auth = require('../middleware/auth');

// Initialize Replicate client
console.log('🔧 Initializing Replicate client...');
console.log('🔑 REPLICATE_API_TOKEN available:', !!process.env.REPLICATE_API_TOKEN);
console.log('🔑 Token length:', process.env.REPLICATE_API_TOKEN ? process.env.REPLICATE_API_TOKEN.length : 'N/A');

let replicate;
try {
  replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  console.log('✅ Replicate client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Replicate client:', error);
  replicate = null;
}

// POST /api/prompt/generate
router.post('/generate', auth, creditCheck, async (req, res) => {
  try {
    console.log('🚀 Starting prompt generation...');
    console.log('🔑 User authenticated:', req.user._id);
    console.log('💬 Comment received:', req.body.comment);
    
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'Missing comment' });

    const user = req.userObj;
    console.log('👤 User object loaded:', user.plan, 'plan, credits:', user.remainingCredits);
    
    // Use credit using the new method
    if (!user.useCredit()) {
      console.log('❌ No credits remaining');
      return res.status(402).json({ 
        message: 'No credits remaining. Please upgrade your plan for unlimited access.',
        currentPlan: user.plan,
        dailyLimit: user.dailyLimit
      });
    }
    
    console.log('✅ Credit used, saving user...');
    await user.save();
    console.log('💾 User saved successfully');

    // Check if Replicate API token is available
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not found in environment');
      return res.status(500).json({ 
        message: 'AI service configuration error. Please contact support.',
        error: 'Missing API token'
      });
    }

    console.log('🔑 Replicate API token found, length:', process.env.REPLICATE_API_TOKEN.length);

    // Generate prompt using Llama-3.1-8B via Replicate
    const prompt = `You are a JSON prompt generator. Based on the user's comment, generate a structured JSON prompt that can be used for AI applications. The response should be valid JSON format.

User Comment: "${comment}"

Generate a JSON prompt that includes:
- A clear instruction or query
- Any specific parameters or constraints
- The expected output format
- Context or background information if relevant

Return only the JSON object, no additional text:`;

    console.log('📝 Sending prompt to Llama-3.1-8B...');
    console.log('📡 Replicate client config:', { auth: process.env.REPLICATE_API_TOKEN ? 'Token present' : 'No token' });
    
    // Check if Replicate client is available
    if (!replicate) {
      console.error('❌ Replicate client not initialized');
      return res.status(500).json({ 
        message: 'AI service not available. Please contact support.',
        error: 'Client not initialized'
      });
    }
    
    const output = await replicate.run(
      "meta/meta-llama-3-8b-instruct",
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

    console.log('🤖 AI response received:', typeof output, Array.isArray(output) ? output.length : 'not array');
    console.log('📄 Raw output preview:', String(output).substring(0, 200));

    // Clean and parse the output
    let jsonPrompt;
    try {
      // Extract JSON from the response (remove any markdown formatting)
      const cleanOutput = Array.isArray(output) ? output.join('') : String(output);
      const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        jsonPrompt = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON parsed successfully');
      } else {
        // Fallback if no JSON found
        jsonPrompt = {
          user_query: comment,
          generated_prompt: cleanOutput,
          structured: false,
          note: "AI response could not be parsed as JSON"
        };
        console.log('⚠️ No JSON found, using fallback');
      }
    } catch (parseError) {
      // Fallback if JSON parsing fails
      jsonPrompt = {
        user_query: comment,
        generated_prompt: Array.isArray(output) ? output.join('') : String(output),
        structured: false,
        note: "AI response could not be parsed as valid JSON"
      };
      console.log('⚠️ JSON parsing failed, using fallback:', parseError.message);
    }

    console.log('💾 Saving prompt to database...');
    const doc = await Prompt.create({ 
      userId: user._id, 
      comment, 
      prompt: JSON.stringify(jsonPrompt) 
    });
    console.log('✅ Prompt saved to database');

    res.json({ 
      prompt: doc.prompt, 
      creditsLeft: user.remainingCredits,
      plan: user.plan,
      dailyLimit: user.dailyLimit,
      totalPromptsUsed: user.totalPromptsUsed,
      aiGenerated: true
    });
    
    console.log('🎉 Prompt generation completed successfully');
  } catch (error) {
    console.error('❌ Prompt generation error:', error);
    console.error('🔍 Error stack:', error.stack);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // If it's a Replicate API error, provide specific feedback
    if (error.message.includes('REPLICATE_API_TOKEN') || error.message.includes('Unauthorized')) {
      return res.status(500).json({ 
        message: 'AI service temporarily unavailable. Please try again later.',
        error: 'API configuration issue'
      });
    }
    
    // If it's a Replicate API error, provide more specific feedback
    if (error.message.includes('replicate') || error.message.includes('Replicate')) {
      return res.status(500).json({ 
        message: 'AI service error. Please check your Replicate API configuration.',
        error: 'Replicate API issue'
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