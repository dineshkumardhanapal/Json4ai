const express = require('express');
const router = express.Router();
const Replicate = require('replicate');
const Prompt = require('../models/Prompt');
const User   = require('../models/User');
const creditCheck = require('../middleware/credit');
const auth = require('../middleware/auth');
const { validatePromptGeneration } = require('../middleware/validation');

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
router.post('/generate', auth, creditCheck, validatePromptGeneration, async (req, res) => {
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

    // Determine quality tier based on user's subscription plan
    const qualityTier = getQualityTier(user.plan);
    
    // Generate prompt using Llama-3.1-8B via Replicate with tiered quality
    const systemPrompt = generateSystemPrompt(qualityTier);
    const userPrompt = generateUserPrompt(comment, qualityTier);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Check if Replicate client is available
    if (!replicate) {
      return res.status(500).json({ 
        message: 'AI service not available. Please contact support.',
        error: 'Client not initialized'
      });
    }
    
    // Adjust model parameters based on quality tier
    const modelParams = getModelParameters(qualityTier);
    
    const output = await replicate.run(
      "meta/meta-llama-3-8b-instruct",
      {
        input: {
          prompt: fullPrompt,
          ...modelParams
        }
      }
    );

    // AI output received

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
          
          // Validate that we got a substantial JSON response based on quality tier
          const jsonString = JSON.stringify(jsonPrompt);
          const minLength = qualityTier === 'premium' ? 200 : 100;
          
          if (jsonString.length < minLength) {
            // JSON is too short for the quality tier, use enhanced fallback
            throw new Error(`Generated JSON too short for ${qualityTier} tier`);
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
      // Enhanced fallback with tiered quality structure
      jsonPrompt = generateFallbackJSON(comment, qualityTier, parseError.message);
    }

    const doc = await Prompt.create({ 
      userId: user._id, 
      comment, 
      prompt: JSON.stringify(jsonPrompt),
      qualityTier: qualityTier // Store the quality tier used
    });

    res.json({ 
      prompt: doc.prompt, 
      creditsLeft: user.remainingCredits,
      plan: user.plan,
      dailyLimit: user.dailyLimit,
      totalPromptsUsed: user.totalPromptsUsed,
      qualityTier: qualityTier,
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

// Helper function to determine quality tier based on user plan
function getQualityTier(userPlan) {
  switch (userPlan) {
    case 'starter':
      return 'standard';
    case 'premium':
      return 'premium';
    default:
      return 'free'; // Free users get basic quality
  }
}

// Generate system prompt based on quality tier
function generateSystemPrompt(qualityTier) {
  const basePrompt = `You are an expert JSON prompt generator with deep expertise in creating structured prompts for AI applications.`;
  
  switch (qualityTier) {
    case 'premium':
      return `${basePrompt} You excel at analyzing user requests and generating comprehensive JSON prompts that capture all nuances, requirements, and specifications with maximum detail and NLP sophistication.

Your JSON outputs should be:
- Extremely detailed and comprehensive (aim for 300+ words of structured content)
- Rich in natural language processing with sophisticated vocabulary and expressions
- Well-structured with logical organization and clear hierarchy
- Specific and actionable with concrete requirements and examples
- Professional and polished for enterprise use
- Include multiple nested levels and detailed sub-sections
- Use advanced NLP techniques for better AI understanding

IMPORTANT: Generate JSON that is substantial, detailed, and uses sophisticated language patterns. Think of this as creating a comprehensive specification document that leaves no room for interpretation and maximizes AI comprehension.`;
    
    case 'standard':
      return `${basePrompt} You are skilled at creating clear, structured JSON prompts that effectively communicate user requirements.

Your JSON outputs should be:
- Clear and well-structured (aim for 150-200 words of structured content)
- Use standard business language and clear terminology
- Well-organized with logical flow
- Specific enough to guide AI responses
- Professional and practical
- Include essential sections and key requirements

IMPORTANT: Generate JSON that is clear, structured, and provides sufficient detail for AI understanding without being overly complex.`;
    
    default: // free tier
      return `${basePrompt} You create basic JSON prompts that provide essential structure for AI responses.

Your JSON outputs should be:
- Simple and clear (aim for 100-150 words)
- Basic structure with key requirements
- Easy to understand and implement
- Focus on essential information only

IMPORTANT: Generate JSON that is simple, clear, and provides basic structure for AI responses.`;
  }
}

// Generate user prompt based on quality tier
function generateUserPrompt(comment, qualityTier) {
  const baseRequest = `User Request: "${comment}"`;
  
  switch (qualityTier) {
    case 'premium':
      return `${baseRequest}

Create a comprehensive, high-quality JSON prompt that includes:

1. **Main Instruction**: A detailed, sophisticated instruction that directly addresses what the user wants with advanced NLP
2. **Detailed Parameters**: 
   - Comprehensive requirements, constraints, and preferences
   - Technical specifications and implementation details
   - Quality standards, criteria, and success metrics
   - Performance expectations and benchmarks
   - Risk considerations and mitigation strategies
3. **Output Format**: 
   - Detailed structure and organization with multiple levels
   - Required sections, components, and sub-components
   - Formatting preferences and style guidelines
   - Length specifications and content depth requirements
4. **Context & Background**: 
   - Rich context to help the AI understand the request deeply
   - Target audience analysis and user personas
   - Industry-specific knowledge and domain expertise
   - Prerequisites, assumptions, and dependencies
   - Related concepts and reference materials
5. **Additional Requirements**: 
   - Sophisticated style, tone, and voice preferences
   - Detail level specifications with examples
   - Quality assurance and validation criteria
   - Success metrics and performance indicators
   - Integration considerations and compatibility requirements

The JSON should be comprehensive and sophisticated enough that an AI can generate an exceptional response without needing clarification. Use advanced NLP techniques and detailed specifications.

Return ONLY the JSON object:`;
    
    case 'standard':
      return `${baseRequest}

Create a clear, structured JSON prompt that includes:

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
    
    default: // free tier
      return `${baseRequest}

Create a basic JSON prompt that includes:

1. **Main Instruction**: What the user wants to achieve
2. **Basic Parameters**: Key requirements and constraints
3. **Output Format**: Expected structure and format
4. **Context**: Basic background information
5. **Requirements**: Essential specifications

The JSON should provide clear guidance for AI responses.

Return ONLY the JSON object:`;
  }
}

// Get model parameters based on quality tier
function getModelParameters(qualityTier) {
  switch (qualityTier) {
    case 'premium':
      return {
        max_new_tokens: 2000,        // More tokens for premium quality
        temperature: 0.1,            // Lower temperature for more focused output
        top_p: 0.95,                // Slightly more focused sampling
        top_k: 25,                  // More focused token selection
        repetition_penalty: 1.3,    // Higher penalty to avoid repetition
        do_sample: true,
        num_beams: 2,               // Use beam search for better quality
        length_penalty: 1.2,        // Encourage longer, more detailed output
        no_repeat_ngram_size: 4     // Larger n-gram size for better diversity
      };
    
    case 'standard':
      return {
        max_new_tokens: 1500,       // Standard token limit
        temperature: 0.2,           // Balanced creativity and focus
        top_p: 0.98,               // Standard sampling
        top_k: 30,                 // Standard token selection
        repetition_penalty: 1.2,   // Standard repetition penalty
        do_sample: true,
        num_beams: 1,              // Single beam for standard quality
        length_penalty: 1.1,       // Standard length penalty
        no_repeat_ngram_size: 3    // Standard n-gram size
      };
    
    default: // free tier
      return {
        max_new_tokens: 1000,      // Limited tokens for free tier
        temperature: 0.3,          // More creative for basic output
        top_p: 0.99,              // More random sampling
        top_k: 40,                // More random token selection
        repetition_penalty: 1.1,  // Lower repetition penalty
        do_sample: true,
        num_beams: 1,             // Single beam
        length_penalty: 1.0,      // No length penalty
        no_repeat_ngram_size: 2   // Smaller n-gram size
      };
  }
}

// Generate fallback JSON based on quality tier
function generateFallbackJSON(comment, qualityTier, errorMessage) {
  switch (qualityTier) {
    case 'premium':
      return {
        user_query: comment,
        main_instruction: `Generate a comprehensive, high-quality response about: ${comment}`,
        detailed_parameters: {
          scope: "comprehensive_and_detailed",
          depth: "maximum_detail",
          include_examples: true,
          include_step_by_step: true,
          include_best_practices: true,
          technical_level: "advanced",
          quality_standards: "excellent",
          performance_expectations: "outstanding",
          risk_considerations: "comprehensive",
          success_metrics: "detailed"
        },
        output_format: {
          structure: "multi_level_organization",
          include_executive_summary: true,
          include_detailed_sections: true,
          include_practical_implementations: true,
          include_resources_and_references: true,
          formatting: "professional_enterprise",
          length: "comprehensive_detailed"
        },
        context: {
          domain: "comprehensive_ai_education",
          target_audience: "professionals_and_experts",
          use_case: "enterprise_implementation",
          prerequisites: "intermediate_to_advanced_understanding",
          assumptions: "user_seeks_comprehensive_expert_guidance",
          industry_context: "modern_ai_applications"
        },
        additional_requirements: {
          tone: "professional_and_sophisticated",
          detail_level: "maximum_comprehensiveness",
          include_code_examples: true,
          include_best_practices: true,
          include_troubleshooting: true,
          include_integration_guidance: true,
          success_criteria: "comprehensive_understanding_and_actionable_implementation",
          quality_assurance: "enterprise_grade"
        },
        note: `Premium tier fallback (${errorMessage}) - using enhanced comprehensive structure`
      };
    
    case 'standard':
      return {
        user_query: comment,
        main_instruction: `Generate a clear, structured response about: ${comment}`,
        detailed_parameters: {
          scope: "structured_and_clear",
          depth: "moderate_detail",
          include_examples: true,
          include_step_by_step: true,
          technical_level: "intermediate",
          quality_standards: "good",
          performance_expectations: "reliable"
        },
        output_format: {
          structure: "organized_sections",
          include_summary: true,
          include_practical_steps: true,
          include_resources: true,
          formatting: "professional",
          length: "moderate"
        },
        context: {
          domain: "general_ai_education",
          target_audience: "developers_and_learners",
          use_case: "learning_and_implementation",
          prerequisites: "basic_understanding",
          assumptions: "user_wants_clear_guidance"
        },
        additional_requirements: {
          tone: "educational_and_practical",
          detail_level: "moderate",
          include_code_examples: true,
          include_best_practices: true,
          success_criteria: "clear_understanding_and_actionable_steps"
        },
        note: `Standard tier fallback (${errorMessage}) - using enhanced structured format`
      };
    
    default: // free tier
      return {
        user_query: comment,
        main_instruction: `Generate a basic response about: ${comment}`,
        basic_parameters: {
          scope: "basic",
          depth: "simple",
          include_examples: false,
          technical_level: "beginner"
        },
        output_format: {
          structure: "simple_sections",
          formatting: "basic",
          length: "concise"
        },
        context: {
          domain: "general",
          target_audience: "beginners",
          use_case: "basic_learning"
        },
        requirements: {
          tone: "simple_and_clear",
          detail_level: "basic"
        },
        note: `Free tier fallback (${errorMessage}) - using basic structure`
      };
  }
}