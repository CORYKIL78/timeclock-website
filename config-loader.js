/**
 * Configuration Loader
 * Loads environment variables from .env-config.js or process.env
 * This file should be loaded FIRST in your HTML before other scripts
 */

// Initialize CONFIG object immediately
window.CONFIG = window.CONFIG || {
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
 * Priority: ENVIRONMENT_CONFIG > localStorage > Query params > defaults
 */
function loadConfig() {
  // FIRST: Try to load from ENVIRONMENT_CONFIG (from .env-config.js)
  if (typeof ENVIRONMENT_CONFIG !== 'undefined') {
    console.log('[CONFIG] Found ENVIRONMENT_CONFIG, merging...');
    Object.assign(window.CONFIG, ENVIRONMENT_CONFIG);
  } else {
    console.warn('[CONFIG] ENVIRONMENT_CONFIG not found, using defaults');
  }
  
  // Try to load from localStorage (for development override)
  const stored = localStorage.getItem('config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      Object.assign(window.CONFIG, parsed);
      console.log('[CONFIG] Merged config from localStorage');
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
      console.log('[CONFIG] Override from query param:', configKey);
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
    DISCORD_CLIENT_ID: window.CONFIG.DISCORD_CLIENT_ID,
    ADMINS: Object.keys(window.CONFIG.ADMINS || {})
  });
  
  return window.CONFIG;
}

// Load config immediately
loadConfig();

// Also load on DOMContentLoaded as a fallback
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[CONFIG] Reloading config on DOMContentLoaded');
    loadConfig();
  });
}

// Helper function to get config value with fallback
function getConfig(key, defaultValue = null) {
  return window.CONFIG[key] !== undefined && window.CONFIG[key] !== null ? window.CONFIG[key] : defaultValue;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadConfig, getConfig, CONFIG: window.CONFIG };
}
