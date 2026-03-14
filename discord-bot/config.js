/**
 * Bot Configuration
 * Loads sensitive data from environment variables
 */

require('dotenv').config();

module.exports = {
    // Discord Bot Token
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN,
    
    // Discord Application/Client ID
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    
    // Discord Guild/Server ID
    GUILD_ID: process.env.DISCORD_GUILD_ID,
    
    // Admin Role ID for permission checks
    ADMIN_ROLE_ID: process.env.DISCORD_ADMIN_ROLE_ID || '',
    
    // Backend API URL
    BACKEND_URL: process.env.BACKEND_URL || 'https://timeclock-backend.marcusray.workers.dev',
    
    // Validate required config
    validate() {
        const missing = [];

        // Accept either DISCORD_BOT_TOKEN or DISCORD_TOKEN for compatibility.
        if (!process.env.DISCORD_BOT_TOKEN && !process.env.DISCORD_TOKEN) {
            missing.push('DISCORD_BOT_TOKEN (or DISCORD_TOKEN)');
        }

        if (!process.env.DISCORD_GUILD_ID) {
            missing.push('DISCORD_GUILD_ID');
        }
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease check your .env file.`);
        }
    }
};
