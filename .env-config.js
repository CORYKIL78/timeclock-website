// Auto-generated from admin-credentials.json
// This file is gitignored and only for local development
// For production, use Cloudflare environment variables

// Environment Configuration (for config-loader.js)
window.ENVIRONMENT_CONFIG = window.ENVIRONMENT_CONFIG || {
  DISCORD_CLIENT_ID: null,
  WORKER_URL: null,
  REDIRECT_URI: null,
  GUILD_ID: null,
  REQUIRED_ROLE: null,
  ADMINS: {}
};

// Legacy CONFIG object for backward compatibility
window.CONFIG = window.CONFIG || {};
window.CONFIG.ADMINS = {
  "1088907566844739624": {
    "pin": "061021",
    "name": "Marcus Ray"
  },
  "1002932344799371354": {
    "pin": "486133",
    "name": "Appler Smith"
  },
  "1187751127039615086": {
    "pin": "638542",
    "name": "Sam Caster"
  },
  "926568979747713095": {
    "pin": "287183",
    "name": "Teejay Everil"
  },
  "1203762560059314192": {
    "pin": "315793",
    "name": "Noelle Holiday"
  }
};

// Add admins to ENVIRONMENT_CONFIG as well
window.ENVIRONMENT_CONFIG.ADMINS = window.CONFIG.ADMINS;

console.log('[ADMIN CONFIG] Loaded 5 admin(s) from local credentials');
