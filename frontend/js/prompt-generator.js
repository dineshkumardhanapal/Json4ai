const token = localStorage.getItem('token');
if (!token) location.href = 'login.html';

const logoutBtn = document.getElementById('logout');
logoutBtn && logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  location.href = 'index.html';
});

// Validate token before making API calls
const validateToken = async () => {
  try {
    console.log('🔐 Validating token...');
    console.log('🔑 Token length:', token ? token.length : 'No token');
    console.log('🔑 Token preview:', token ? `${token.substring(0, 20)}...` : 'No token');
    
    const res = await fetch('https://json4ai.onrender.com/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      // Token is invalid or expired
      console.log('❌ Token validation failed - redirecting to login');
      localStorage.clear();
      location.href = 'login.html';
      return false;
    }
    
    console.log('✅ Token validation successful');
    return true;
  } catch (error) {
    console.error('❌ Token validation error:', error);
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
    const res = await fetch('https://json4ai.onrender.com/api/prompt/usage', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.clear();
        location.href = 'login.html';
        return;
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
      <div class="status-icon">✅</div>
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
        <div class="status-icon">⏰</div>
        <div class="status-content">
          <h3>Daily Limit Reached</h3>
          <p>You've used all ${usage.dailyLimit} daily prompts. Credits reset in <strong>${hoursUntilReset} hours</strong>.</p>
          <a href="pricing.html" class="btn-primary">Upgrade Plan</a>
        </div>
      `;
    } else {
      usageStatus.className = 'usage-status-card status-limit-reached';
      usageStatus.innerHTML = `
        <div class="status-icon">🚫</div>
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
  console.log('🚀 Starting prompt generation...');
  
  // Validate token before proceeding
  const isValid = await validateToken();
  if (!isValid) return; // Will redirect to login if invalid
  
  console.log('✅ Token validated, proceeding with generation...');
  
  const generateBtn = document.getElementById('generate-btn');
  const btnText = generateBtn.querySelector('.btn-text');
  const btnLoading = generateBtn.querySelector('.btn-loading');
  
  try {
    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    generateBtn.disabled = true;
    
    console.log('📡 Making API call to generate prompt...');
    const res = await fetch('https://json4ai.onrender.com/api/prompt/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ comment })
    });
    
    console.log('📥 API response status:', res.status);
    
    if (!res.ok) {
      const errorData = await res.json();
      console.log('❌ API error:', errorData);
      
      if (res.status === 401) {
        // Token expired or invalid - redirect to login
        console.log('🔐 Unauthorized - redirecting to login');
        localStorage.clear();
        location.href = 'login.html';
        return;
      }
      
      if (res.status === 402) {
        // Credit limit reached
        console.log('💳 Credit limit reached');
        showError(errorData.message);
        loadUsageStatus(); // Refresh usage status
        return;
      }
      
      throw new Error(errorData.message || 'Failed to generate prompt');
    }
    
    const result = await res.json();
    console.log('✅ Prompt generated successfully:', result);
    
    // Display the result
    displayResult(comment, result.prompt);
    
    // Refresh usage status
    loadUsageStatus();
    
    // Load recent history
    loadRecentHistory();
    
    showSuccess('Prompt generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating prompt:', error);
    showError(error.message || 'Failed to generate prompt. Please try again.');
  } finally {
    // Reset button state
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    generateBtn.disabled = false;
  }
};

// Display generated result
const displayResult = (input, promptJson) => {
  const originalInputText = document.getElementById('original-input-text');
  const jsonOutput = document.getElementById('json-output');
  
  originalInputText.textContent = input;
  
  try {
    // Try to parse and format the JSON
    const parsed = JSON.parse(promptJson);
    jsonOutput.textContent = JSON.stringify(parsed, null, 2);
    jsonOutput.className = 'json-valid';
  } catch (e) {
    // If it's not valid JSON, display as-is
    jsonOutput.textContent = promptJson;
    jsonOutput.className = 'json-invalid';
  }
  
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth' });
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
    const res = await fetch('https://json4ai.onrender.com/api/prompt/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid - redirect to login
        localStorage.clear();
        location.href = 'login.html';
        return;
      }
      console.error('Failed to load history');
      return;
    }
    
    const prompts = await res.json();
    
    if (prompts.length > 0) {
      historyList.innerHTML = prompts.slice(0, 3).map(prompt => `
        <div class="history-item">
          <div class="history-icon">📝</div>
          <div class="history-content">
            <h4>${prompt.comment.substring(0, 60)}${prompt.comment.length > 60 ? '...' : ''}</h4>
            <p>Generated ${formatTimeAgo(new Date(prompt.createdAt))}</p>
          </div>
        </div>
      `).join('');
    } else {
      historyList.innerHTML = `
        <div class="history-item">
          <div class="history-icon">🎯</div>
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
        <div class="history-icon">⚠️</div>
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
  console.log('🚀 Initializing prompt generator page...');
  
  // Wait a bit to ensure localStorage is ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check if we have a token
  if (!token) {
    console.log('❌ No token found - redirecting to login');
    location.href = 'login.html';
    return;
  }
  
  console.log('🔑 Token found, validating...');
  console.log('🔑 Current URL:', window.location.href);
  console.log('🔑 Referrer:', document.referrer);
  
  // Validate token first
  const isValid = await validateToken();
  if (!isValid) return; // Will redirect to login if invalid
  
  console.log('✅ Authentication successful, loading page content...');
  
  // Load page content
  loadUsageStatus();
  loadRecentHistory();
  
  // Set up periodic token validation (every 5 minutes)
  setInterval(async () => {
    const stillValid = await validateToken();
    if (!stillValid) return; // Will redirect to login if invalid
  }, 5 * 60 * 1000); // 5 minutes
};

// Listen for storage changes (in case token is cleared from another tab/window)
window.addEventListener('storage', (e) => {
  if (e.key === 'token' && !e.newValue) {
    console.log('🔑 Token cleared from storage - redirecting to login');
    location.href = 'login.html';
  }
});

// Debug functionality
const debugCard = document.getElementById('debug-card');
const debugContent = document.getElementById('debug-content');

const updateDebugInfo = () => {
  if (debugCard && debugContent) {
    const tokenStatus = token ? 'Present' : 'Missing';
    const tokenLength = token ? token.length : 0;
    const currentUrl = window.location.href;
    const referrer = document.referrer;
    
    debugContent.innerHTML = `
      <p><strong>Token Status:</strong> <span id="token-status">${tokenStatus}</span></p>
      <p><strong>Token Length:</strong> <span id="token-length">${tokenLength}</span></p>
      <p><strong>Current URL:</strong> <span id="current-url">${currentUrl}</span></p>
      <p><strong>Referrer:</strong> <span id="referrer">${referrer}</span></p>
    `;
  }
};

const toggleDebug = () => {
  if (debugCard) {
    debugCard.style.display = debugCard.style.display === 'none' ? 'block' : 'none';
  }
};

const testTokenValidation = async () => {
  console.log('🧪 Testing token validation...');
  const isValid = await validateToken();
  if (isValid) {
    showSuccess('Token is valid!');
    updateDebugInfo();
  } else {
    showError('Token validation failed!');
  }
};

// Make functions global
window.toggleDebug = toggleDebug;
window.testTokenValidation = testTokenValidation;

// Show debug info initially (remove in production)
if (debugCard) {
  debugCard.style.display = 'block';
  updateDebugInfo();
}

// Start initialization
initializePage();
