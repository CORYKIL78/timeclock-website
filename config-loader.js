/**
 * Configuration Loader
 * Loads environment variables from .env-config.js or process.env
 * This file should be loaded FIRST in your HTML before other scripts
 */

// Configuration object - will be populated from environment variables
window.CONFIG = {
  // Discord OAuth
  DISCORD_CLIENT_ID: null,
  
  // Backend URLs
  WORKER_URL: null,
  REDIRECT_URI: null,
  
  // Discord Server
  GUILD_ID: null,
  REQUIRED_ROLE: null,
  
  // Admin Portal
  ADMINS: {}
};

/**
 * Load configuration from multiple sources
 * Priority: Query params > localStorage > .env-config.js > defaults
 */
function loadConfig() {
  // Try to load from .env-config.js (created by build process)
  if (typeof ENVIRONMENT_CONFIG !== 'undefined') {
    Object.assign(window.CONFIG, ENVIRONMENT_CONFIG);
  }
  
  // Try to load from localStorage (for development)
  const stored = localStorage.getItem('config');
  if (stored) {
    try {
      Object.assign(window.CONFIG, JSON.parse(stored));
    } catch (e) {
      console.warn('[CONFIG] Failed to parse stored config:', e);
    }
  }
  
  // Load from query parameters (useful for testing)
  const params = new URLSearchParams(window.location.search);
  for (let [key, value] of params) {
    if (key.startsWith('config_')) {
      const configKey = key.substring(7).toUpperCase();
      window.CONFIG[configKey] = value;
    }
  }
  
  // Validate required config
  if (!window.CONFIG.DISCORD_CLIENT_ID) {
    console.warn('[CONFIG] DISCORD_CLIENT_ID not set! OAuth will not work.');
  }
  
  if (!window.CONFIG.WORKER_URL) {
    console.warn('[CONFIG] WORKER_URL not set! API calls will fail.');
  }
  
  console.log('[CONFIG] Loaded configuration:', {
    WORKER_URL: window.CONFIG.WORKER_URL,
    REDIRECT_URI: window.CONFIG.REDIRECT_URI,
    GUILD_ID: window.CONFIG.GUILD_ID,
    ADMINS: Object.keys(window.CONFIG.ADMINS || {})
  });
  
  return window.CONFIG;
}

// Load config when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadConfig);
} else {
  loadConfig();
}

// Helper function to get config value with fallback
function getConfig(key, defaultValue = null) {
  return window.CONFIG[key] !== undefined ? window.CONFIG[key] : defaultValue;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadConfig, getConfig, CONFIG: window.CONFIG };
}
