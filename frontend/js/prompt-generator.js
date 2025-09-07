// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication using session manager - wait for session manager to initialize
  setTimeout(() => {
    if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
      location.href = 'login.html';
      return;
    }
    
    // Initialize page if authenticated
    initializePage();
  }, 100);

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Logout button clicked');
      
      if (window.sessionManager) {
        await window.sessionManager.logout();
      } else {
        localStorage.clear();
        location.href = 'index.html';
      }
    });
  }
});

// Global flag to allow demo mode when API is unavailable
if (typeof window.apiUnavailable === 'undefined') {
  window.apiUnavailable = false;
}

// Validate token before making API calls
const validateToken = async () => {
  try {
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      console.log('No access token available for validation');
      window.sessionManager.forceLogout('No access token available');
      return false;
    }
    
    console.log('Validating token...');
    
    const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('Token validation response:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url
    });
    
    if (res.status === 401) {
      // Token is invalid or expired - let session manager handle this
      console.log('Token expired during validation');
      window.sessionManager.forceLogout('Token expired during validation');
      return false;
    }
    
    if (res.status === 404) {
      console.log('API endpoint not found - server may be down');
      // Switch to demo mode when API is down
      window.apiUnavailable = true;
      return true;
    }
    
    if (!res.ok) {
      console.log('Token validation failed with status:', res.status);
      return false;
    }
    
    console.log('Token validation successful');
    // Ensure we exit demo mode if server is back
    window.apiUnavailable = false;
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

// DOM elements
const usageStatus = document.getElementById('usage-status');
const generatorForm = document.getElementById('generator-form');
const promptForm = document.getElementById('prompt-form');
const resultCard = document.getElementById('result-card');
const historyList = document.getElementById('history-list');

// Load usage status and check if user can generate prompts
const loadUsageStatus = async () => {
  try {
    // If API is unavailable, show demo mode notice and enable form
    if (window.apiUnavailable) {
      usageStatus.className = 'usage-status-card status-limit-reached';
      usageStatus.innerHTML = `
        <div class="status-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <div class="status-content">
          <h3>Service Unavailable</h3>
          <p>The server is unreachable. You can still generate a prompt in Demo mode.</p>
        </div>
      `;
      generatorForm.style.display = 'block';
      const submitBtn = promptForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      console.log('No access token available, redirecting to login');
      window.sessionManager.forceLogout('No access token available');
      return;
    }
    
    console.log('Loading usage status with token:', accessToken ? 'present' : 'missing');
    
    const res = await fetch('https://json4ai.onrender.com/api/prompt/usage', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('Usage status response:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        window.sessionManager.forceLogout('Token expired during usage check');
        return;
      }
      
      // Check if it's a subscription status issue
      if (res.status === 402) {
        const errorData = await res.json();
        if (errorData.subscriptionStatus && errorData.subscriptionStatus !== 'active') {
          // User has a plan but subscription is not active
          usageStatus.className = 'usage-status-card status-limit-reached';
          usageStatus.innerHTML = `
            <div class="status-icon">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="status-content">
              <h3>Subscription Not Active</h3>
              <p>Your subscription status is: <strong>${errorData.subscriptionStatus}</strong>. Please complete payment or contact support.</p>
              <a href="pricing.html" class="btn-primary">Complete Payment</a>
            </div>
          `;
          
          // Disable the form
          generatorForm.style.display = 'none';
          return;
        }
      }
      
      throw new Error('Failed to load usage information');
    }
    
    const usage = await res.json();
    updateUsageStatus(usage);
    
  } catch (error) {
    console.error('Error loading usage:', error);
    showError('Failed to load usage information');
  }
};

// Update usage status display
const updateUsageStatus = (usage) => {
  const canGenerate = usage.remainingCredits > 0 || usage.hasUnlimitedAccess;
  
  if (canGenerate) {
    usageStatus.className = 'usage-status-card status-available';
    usageStatus.innerHTML = `
      <div class="status-icon">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <div class="status-content">
        <h3>Ready to Generate</h3>
        <p>${usage.hasUnlimitedAccess ? 'Unlimited access' : `${usage.remainingCredits} credits remaining`} • ${usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)} Plan</p>
      </div>
    `;
    
    // Enable the form
    generatorForm.style.display = 'block';
    promptForm.querySelector('button[type="submit"]').disabled = false;
    
  } else {
    // Check if it's a daily limit issue
    const now = new Date();
    const lastReset = new Date(localStorage.getItem('lastFreeReset') || Date.now());
    const hoursUntilReset = 24 - Math.floor((now - lastReset) / (1000 * 60 * 60));
    
    if (hoursUntilReset > 0) {
      usageStatus.className = 'usage-status-card status-limit-reached';
      usageStatus.innerHTML = `
        <div class="status-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="status-content">
          <h3>Daily Limit Reached</h3>
          <p>You've used all ${usage.dailyLimit} daily prompts. Credits reset in <strong>${hoursUntilReset} hours</strong>.</p>
          <a href="pricing.html" class="btn-primary">Upgrade Plan</a>
        </div>
      `;
    } else {
      usageStatus.className = 'usage-status-card status-limit-reached';
      usageStatus.innerHTML = `
        <div class="status-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"></path>
          </svg>
        </div>
        <div class="status-content">
          <h3>No Credits Remaining</h3>
          <p>You've used all available credits. Please upgrade your plan for unlimited access.</p>
          <a href="pricing.html" class="btn-primary">Upgrade Plan</a>
        </div>
      `;
    }
    
    // Disable the form
    generatorForm.style.display = 'none';
  }
};

// Handle prompt generation
const generatePrompt = async (comment) => {
  console.log('Starting prompt generation for:', comment);
  // If server is down, immediately use demo mode
  if (window.apiUnavailable) {
    showDemoModeOption(comment);
    return;
  }
  
  // Check if user is logged in
  if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
    showError('Please log in to generate prompts.');
    setTimeout(() => {
      location.href = 'login.html';
    }, 2000);
    return;
  }
  
  // Validate token before proceeding
  const isValid = await validateToken();
  if (!isValid) {
    console.log('Token validation failed, cannot generate prompt');
    return; // Will redirect to login if invalid
  }
  
  const generateBtn = document.getElementById('generate-btn');
  const btnText = generateBtn.querySelector('.btn-text');
  const btnLoading = generateBtn.querySelector('.btn-loading');
  
  try {
    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    generateBtn.disabled = true;
    
    // Show progress indicator
    showGenerationProgress();
    
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      showError('No access token available. Please log in again.');
      return;
    }
    
    console.log('Making API request to generate prompt...');
    
    const res = await fetch('https://json4ai.onrender.com/api/prompt/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ comment })
    });
    
    console.log('Prompt generation response:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url
    });
    
    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch (e) {
        errorData = { message: 'Unknown error occurred' };
      }
      
      if (res.status === 401) {
        // Token expired or invalid - let session manager handle this
        window.sessionManager.forceLogout('Token expired during prompt generation');
        return;
      }
      
      if (res.status === 402) {
        // Credit limit reached
        showError(errorData.message);
        hideGenerationProgress();
        loadUsageStatus(); // Refresh usage status
        return;
      }
      
      if (res.status === 404) {
        showError('API endpoint not found. Please check if the service is running.');
        hideGenerationProgress();
        // Show demo mode option
        showDemoModeOption(comment);
        return;
      }
      
      if (res.status === 500) {
        showError('Server error occurred. Please try again later.');
        hideGenerationProgress();
        return;
      }
      
      throw new Error(errorData.message || `Failed to generate prompt (Status: ${res.status})`);
    }
    
    const result = await res.json();
    
    // Complete progress animation
    completeGenerationProgress();
    
    // Display the result with typing effect
    displayResultWithTyping(comment, result.prompt, result.qualityTier);
    
    // Refresh usage status
    loadUsageStatus();
    
    // Load recent history
    loadRecentHistory();
    
    showSuccess('Prompt generated successfully!');
    
  } catch (error) {
    console.error('Error generating prompt:', error);
    showError(error.message || 'Failed to generate prompt. Please try again.');
    hideGenerationProgress();
  } finally {
    // Reset button state
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    generateBtn.disabled = false;
  }
};

// Show generation progress with animations
const showGenerationProgress = () => {
  const progressCard = document.getElementById('generation-progress');
  const resultCard = document.getElementById('result-card');
  
  // Hide result card if visible
  resultCard.style.display = 'none';
  
  // Show progress card
  progressCard.style.display = 'block';
  progressCard.scrollIntoView({ behavior: 'smooth' });
  
  // Start progress animation
  startProgressAnimation();
};

// Start progress animation
const startProgressAnimation = () => {
  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const statusMessage = document.getElementById('status-message');
  
  let currentStep = 0;
  let progress = 0;
  
  // Step 1: Analyzing Input
  setTimeout(() => {
    updateStep(steps[0], 'active');
    progressText.textContent = 'Analyzing your input...';
    statusMessage.textContent = 'Understanding your requirements and preparing the AI model...';
    progress = 25;
    progressFill.style.width = `${progress}%`;
  }, 500);
  
  // Step 2: Processing Request
  setTimeout(() => {
    updateStep(steps[0], 'completed');
    updateStep(steps[1], 'active');
    progressText.textContent = 'Processing your request...';
    statusMessage.textContent = 'Sending your request to our advanced AI system...';
    progress = 50;
    progressFill.style.width = `${progress}%`;
  }, 2000);
  
  // Step 3: Generating JSON
  setTimeout(() => {
    updateStep(steps[1], 'completed');
    updateStep(steps[2], 'active');
    progressText.textContent = 'Generating JSON structure...';
    statusMessage.textContent = 'Creating a well-structured JSON prompt based on your input...';
    progress = 75;
    progressFill.style.width = `${progress}%`;
  }, 3500);
  
  // Step 4: Finalizing
  setTimeout(() => {
    updateStep(steps[2], 'completed');
    updateStep(steps[3], 'active');
    progressText.textContent = 'Finalizing your prompt...';
    statusMessage.textContent = 'Adding final touches and validating the JSON structure...';
    progress = 90;
    progressFill.style.width = `${progress}%`;
  }, 5000);
};

// Update step status
const updateStep = (stepId, status) => {
  const step = document.getElementById(stepId);
  step.className = `step ${status}`;
};

// Complete generation progress
const completeGenerationProgress = () => {
  const progressCard = document.getElementById('generation-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const statusMessage = document.getElementById('status-message');
  
  // Complete final step
  updateStep('step-4', 'completed');
  
  // Complete progress bar
  progressFill.style.width = '100%';
  progressText.textContent = 'Generation complete!';
  statusMessage.textContent = 'Your AI-generated prompt is ready!';
  
  // Hide progress after a short delay
  setTimeout(() => {
    hideGenerationProgress();
  }, 1500);
};

// Hide generation progress
const hideGenerationProgress = () => {
  const progressCard = document.getElementById('generation-progress');
  progressCard.style.display = 'none';
  
  // Reset progress
  const progressFill = document.getElementById('progress-fill');
  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  
  progressFill.style.width = '0%';
  steps.forEach(stepId => {
    const step = document.getElementById(stepId);
    step.className = 'step';
  });
};

// Display result with typing effect
const displayResultWithTyping = (input, promptJson, qualityTier = null) => {
  const originalInputText = document.getElementById('original-input-text');
  const jsonOutput = document.getElementById('json-output');
  
  originalInputText.textContent = input;
  
  // Show result card
  const resultCard = document.getElementById('result-card');
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth' });
  
  // Display quality tier information if available
  if (qualityTier) {
    displayQualityTier(qualityTier);
  }
  
  // Start typing effect for JSON
  startTypingEffect(promptJson, jsonOutput);
};

// Start typing effect for JSON output
const startTypingEffect = (text, outputElement) => {
  let index = 0;
  const speed = 30; // Characters per second
  
  // Clear output
  outputElement.textContent = '';
  outputElement.classList.add('typing');
  
  // Function to type next character
  const typeNextChar = () => {
    if (index < text.length) {
      // Add next character
      outputElement.textContent += text[index];
      index++;
      
      // Continue typing
      setTimeout(typeNextChar, speed);
    } else {
      // Typing complete
      outputElement.classList.remove('typing');
      
      // Try to format as JSON
      try {
        const parsed = JSON.parse(text);
        outputElement.textContent = JSON.stringify(parsed, null, 2);
        outputElement.className = 'json-valid';
      } catch (e) {
        // If it's not valid JSON, keep as-is
        outputElement.className = 'json-invalid';
      }
    }
  };
  
  // Start typing
  typeNextChar();
};

// Display quality tier information
const displayQualityTier = (qualityTier) => {
  const qualityInfo = document.getElementById('quality-info');
  if (qualityInfo) {
    const tierLabels = {
      'free': 'Basic Quality',
      'standard': 'Standard Quality',
      'premium': 'Premium Quality'
    };
    const tierDescriptions = {
      'free': 'Basic structure with essential information',
      'standard': 'Clear structure with moderate detail and NLP',
      'premium': 'Maximum detail with advanced NLP and comprehensive content'
    };
    
    qualityInfo.innerHTML = `
      <div class="quality-badge quality-${qualityTier}">
        <span class="quality-icon">${qualityTier === 'premium' ? '⭐' : qualityTier === 'standard' ? '✨' : '📝'}</span>
        <span class="quality-label">${tierLabels[qualityTier]}</span>
      </div>
      <p class="quality-description">${tierDescriptions[qualityTier]}</p>
    `;
    qualityInfo.style.display = 'block';
  }
};

// Copy JSON to clipboard
const copyToClipboard = async () => {
  const jsonOutput = document.getElementById('json-output');
  
  try {
    await navigator.clipboard.writeText(jsonOutput.textContent);
    showSuccess('JSON copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
    showError('Failed to copy to clipboard');
  }
};

// Start new prompt
const startNewPrompt = () => {
  resultCard.style.display = 'none';
  promptForm.reset();
  document.getElementById('prompt-input').focus();
};

// Load recent generation history
const loadRecentHistory = async () => {
  try {
    if (window.apiUnavailable) {
      // Skip server call in demo mode
      historyList.innerHTML = `
        <div class="history-item">
          <div class="history-icon">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="history-content">
            <h4>No Generations Yet</h4>
            <p>Server is unavailable. Generate a prompt in Demo mode above.</p>
          </div>
        </div>`;
      return;
    }
    const accessToken = window.sessionManager.getAccessToken();
    if (!accessToken) {
      console.log('No access token available for history');
      return;
    }
    
    const res = await fetch('https://json4ai.onrender.com/api/prompt/history', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid - let session manager handle this
        window.sessionManager.forceLogout('Token expired during history load');
        return;
      }
      console.error('Failed to load history');
      return;
    }
    
    const prompts = await res.json();
    
    if (prompts.length > 0) {
      historyList.innerHTML = prompts.slice(0, 3).map(prompt => `
        <div class="history-item">
          <div class="history-icon">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="history-content">
            <h4>${prompt.comment.substring(0, 60)}${prompt.comment.length > 60 ? '...' : ''}</h4>
            <p>Generated ${formatTimeAgo(new Date(prompt.createdAt))}</p>
          </div>
        </div>
      `).join('');
    } else {
      historyList.innerHTML = `
        <div class="history-item">
          <div class="history-icon">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="history-content">
            <h4>No Generations Yet</h4>
            <p>Start generating prompts to see your history here</p>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error loading history:', error);
    historyList.innerHTML = `
      <div class="history-item">
        <div class="history-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path>
          </svg>
        </div>
        <div class="history-content">
          <h4>Failed to Load History</h4>
          <p>Please refresh the page to try again</p>
        </div>
      </div>
    `;
  }
};

// Format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
};

// Ensure a global showInfo function exists without redeclaring if already provided by notifications.js
if (typeof window.showInfo !== 'function') {
  window.showInfo = function(message) {
    if (window.showNotification) {
      window.showNotification(message, 'info');
    } else {
      // Fallback notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: #3b82f6;
        color: white;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10001;
        max-width: 300px;
        word-wrap: break-word;
      `;
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 5000);
    }
  };
}

// Show demo mode option when API is unavailable
const showDemoModeOption = (comment) => {
  const demoPrompt = {
    user_query: comment,
    main_instruction: `Generate a comprehensive response about: ${comment}`,
    detailed_parameters: {
      scope: "comprehensive_and_detailed",
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
    note: "Demo mode - API service unavailable"
  };
  
  // Display the demo result
  displayResultWithTyping(comment, JSON.stringify(demoPrompt, null, 2), 'standard');
  
  // Show info message
  window.showInfo('Demo mode: API service is currently unavailable. This is a sample JSON prompt.');
};

// Event listeners
promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const comment = document.getElementById('prompt-input').value.trim();
  if (comment) {
    generatePrompt(comment);
  }
});

document.getElementById('copy-btn')?.addEventListener('click', copyToClipboard);
document.getElementById('new-prompt-btn')?.addEventListener('click', startNewPrompt);

// Initialize page
const initializePage = async () => {
  // Wait a bit to ensure localStorage is ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check if we have a token
  if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
    console.log('User not logged in, redirecting to login');
    location.href = 'login.html';
    return;
  }
  
  console.log('User is logged in, initializing page...');
  
  // Validate token first
  const isValid = await validateToken();
  
  if (!isValid) {
    console.log('Token validation failed');
    return; // Will redirect to login if invalid
  }
  
  console.log('Token is valid, loading page content...');
  
  // Load page content
  try {
    await loadUsageStatus();
    await loadRecentHistory();
  } catch (error) {
    console.error('Error loading page content:', error);
    // Show error message to user
    if (usageStatus) {
      usageStatus.className = 'usage-status-card status-limit-reached';
      usageStatus.innerHTML = `
        <div class="status-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <div class="status-content">
          <h3>Service Unavailable</h3>
          <p>Unable to connect to the server. Please check your internet connection and try again.</p>
        </div>
      `;
    }
  }
  
  // Set up periodic token validation (every 5 minutes)
  setInterval(async () => {
    const stillValid = await validateToken();
    if (!stillValid) return; // Will redirect to login if invalid
  }, 5 * 60 * 1000); // 5 minutes
};

// Listen for storage changes (in case token is cleared from another tab/window)
window.addEventListener('storage', (e) => {
  if (e.key === 'accessToken' && !e.newValue) {
    // Token was cleared from another tab/window
    if (window.sessionManager) {
      window.sessionManager.forceLogout('Token cleared from another tab');
    } else {
      location.href = 'login.html';
    }
  }
});

// Debug functionality


// Page initialization is now handled in DOMContentLoaded event above
