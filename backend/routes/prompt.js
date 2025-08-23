const express = require('express');
const router = express.Router();
const Replicate = require('replicate');
const Prompt = require('../models/Prompt');
const User   = require('../models/User');
const creditCheck = require('../middleware/credit');
const auth = require('../middleware/auth');

// Initialize Replicate client
let replicate;
try {
  replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
} catch (error) {
  console.error('Failed to initialize Replicate client:', error);
  replicate = null;
}

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

    // Check if Replicate API token is available
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ 
        message: 'AI service configuration error. Please contact support.',
        error: 'Missing API token'
      });
    }

    // Generate prompt using Llama-3.1-8B via Replicate
    const systemPrompt = `You are an expert JSON prompt generator with deep expertise in creating highly detailed, structured prompts for AI applications. You excel at analyzing user requests and generating comprehensive JSON prompts that capture all nuances, requirements, and specifications.

Your JSON outputs should be:
- Highly detailed and comprehensive (aim for 200+ words of structured content)
- Well-structured with logical organization and clear hierarchy
- Specific and actionable with concrete requirements
- Professional and polished for enterprise use
- Rich in detail to eliminate ambiguity
- Include multiple nested levels when appropriate

IMPORTANT: Generate JSON that is substantial and detailed, not minimal. Think of this as creating a comprehensive specification document that leaves no room for interpretation.

Always return valid JSON with no additional text, markdown, or explanations.`;

    const userPrompt = `User Request: "${comment}"

Create a detailed JSON prompt that includes:

1. **Main Instruction**: A clear, specific instruction that directly addresses what the user wants
2. **Detailed Parameters**: 
   - Specific requirements, constraints, or preferences
   - Technical specifications if applicable
   - Quality standards or criteria
   - Performance expectations
3. **Output Format**: 
   - Expected structure and organization
   - Required sections or components
   - Formatting preferences
   - Length specifications
4. **Context & Background**: 
   - Relevant context to help the AI understand the request
   - Target audience or use case
   - Any specific industry or domain knowledge needed
   - Prerequisites or assumptions
5. **Additional Requirements**: 
   - Style, tone, or voice preferences
   - Detail level specifications
   - Examples or references that should be included
   - Success criteria or quality metrics

The JSON should be comprehensive enough that an AI can generate a high-quality response without needing clarification. Think of this as creating a detailed specification document in JSON format.

Return ONLY the JSON object:`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Check if Replicate client is available
    if (!replicate) {
      return res.status(500).json({ 
        message: 'AI service not available. Please contact support.',
        error: 'Client not initialized'
      });
    }
    
    const output = await replicate.run(
      "meta/meta-llama-3-8b-instruct",
      {
        input: {
          prompt: fullPrompt,
          max_new_tokens: 1500,
          temperature: 0.2,
          top_p: 0.98,
          top_k: 30,
          repetition_penalty: 1.2,
          do_sample: true,
          num_beams: 1,
          length_penalty: 1.1,
          no_repeat_ngram_size: 3
        }
      }
    );

    // Log output for debugging (remove in production)
    console.log('Raw AI Output:', output);
    console.log('Output length:', Array.isArray(output) ? output.join('').length : String(output).length);



    // Clean and parse the output
    let jsonPrompt;
    try {
      // Extract JSON from the response (remove any markdown formatting)
      const cleanOutput = Array.isArray(output) ? output.join('') : String(output);
      
      // Try multiple JSON extraction patterns
      let jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        // Try to find JSON after common prefixes
        jsonMatch = cleanOutput.match(/(?:```json\s*|\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[0].startsWith('```json')) {
          jsonMatch = jsonMatch[0].replace(/```json\s*/, '').match(/\{[\s\S]*\}/);
        }
      }
      
      if (jsonMatch) {
        try {
          jsonPrompt = JSON.parse(jsonMatch[0]);
          
          // Validate that we got a substantial JSON response
          const jsonString = JSON.stringify(jsonPrompt);
          if (jsonString.length < 100) {
            // JSON is too short, use enhanced fallback
            throw new Error('Generated JSON too short');
          }
          
        } catch (jsonError) {
          // JSON parsing failed, use enhanced fallback
          throw new Error('Invalid JSON format');
        }
      } else {
        // No JSON found, use enhanced fallback
        throw new Error('No JSON structure found');
      }
      
    } catch (parseError) {
      // Enhanced fallback with comprehensive structure
      jsonPrompt = {
        user_query: comment,
        main_instruction: `Generate a comprehensive response about: ${comment}`,
        detailed_parameters: {
          scope: "comprehensive",
          depth: "detailed",
          include_examples: true,
          include_step_by_step: true,
          technical_level: "intermediate",
          quality_standards: "high",
          performance_expectations: "excellent"
        },
        output_format: {
          structure: "organized_sections",
          include_summary: true,
          include_practical_steps: true,
          include_resources: true,
          formatting: "professional",
          length: "comprehensive"
        },
        context: {
          domain: "general_ai_education",
          target_audience: "developers_and_learners",
          use_case: "learning_and_implementation",
          prerequisites: "basic_understanding",
          assumptions: "user_wants_detailed_guidance"
        },
        additional_requirements: {
          tone: "educational_and_practical",
          detail_level: "comprehensive",
          include_code_examples: true,
          include_best_practices: true,
          include_troubleshooting: true,
          success_criteria: "clear_understanding_and_actionable_steps"
        },
        note: `AI response parsing failed (${parseError.message}) - using enhanced fallback structure`
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