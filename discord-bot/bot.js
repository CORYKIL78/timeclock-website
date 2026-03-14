/**
 * Discord Bot Main File
 * Commission Quote Management System
 * 
 * Setup Instructions:
 * 1. Install dependencies: npm install discord.js
 * 2. Create a .env file with your bot token: DISCORD_BOT_TOKEN=your_token_here
 * 3. Register slash commands: node deploy-commands.js
 * 4. Run the bot: node bot.js
 */

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Validate configuration
try {
    config.validate();
} catch (error) {
    console.error('❌ Configuration Error:', error.message);
    process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store commands
client.commands = new Collection();

// Update bot status every 5 minutes
setInterval(async () => {
    try {
        if (client.isReady()) {
            client.user.setActivity('the Staff Portal', { type: 'WATCHING' });
        }
    } catch (error) {
        console.error('Error updating bot status:', error);
    }
}, 5 * 60 * 1000); // 5 minutes

// Load all commands from commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
        console.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📋 Registered commands: ${client.commands.size}`);
    
    // Set bot status
    try {
        client.user.setActivity('the Staff Portal', { type: 'WATCHING' });
        console.log(`👀 Set bot status: Watching the Staff Portal`);
    } catch (error) {
        console.error('Error setting bot status:', error);
    }
    
    console.log(`🚀 Staff Portal Bot is ready!`);
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    console.log('[BOT] InteractionCreate event fired! Type:', interaction.type, 'CustomId:', interaction.customId || 'N/A');
    
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        console.log('[BOT] Chat input command detected:', interaction.commandName);
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Command ${interaction.commandName} not found`);
            console.error('Available commands:', Array.from(client.commands.keys()).join(', '));
            return;
        }

        console.log('[BOT] Executing command:', interaction.commandName);
        try {
            await command.execute(interaction);
            console.log('[BOT] Command executed successfully');
        } catch (error) {
            console.error('Error executing command:', error);
            const reply = { content: '❌ An error occurred while executing this command.', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
    // Handle button and modal interactions (for dev-toolbox and other commands)
    else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        console.log('[BOT DEBUG] Interaction received:', interaction.customId);
        try {
            // Try all commands that have handleInteraction
            for (const command of client.commands.values()) {
                if (command.handleInteraction) {
                    console.log('[BOT DEBUG] Calling handleInteraction for command:', command.data.name);
                    await command.handleInteraction(interaction);
                }
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            
            const reply = { content: '❌ An error occurred while processing this action.', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Reconnect if the WebSocket disconnects unexpectedly
client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[BOT] Shard ${shardId} disconnected (code ${event.code}). Discord.js will attempt to reconnect automatically.`);
});

client.on('shardError', (error, shardId) => {
    console.error(`[BOT] Shard ${shardId} error:`, error.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Keep-alive HTTP server for hosting platforms (Render, Railway, etc.)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'Starting...',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        ready: client.isReady()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Keep-alive server running on port ${PORT}`);
});

// Self-ping every 14 minutes to prevent Render free-tier sleep (spins down after 15 min)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
    setInterval(() => {
        fetch(`${RENDER_EXTERNAL_URL}/health`)
            .then(() => console.log('[KEEP-ALIVE] Self-pinged successfully'))
            .catch(err => console.error('[KEEP-ALIVE] Self-ping failed:', err.message));
    }, 14 * 60 * 1000); // every 14 minutes
}

// Login to Discord
const token = config.DISCORD_BOT_TOKEN;

client.login(token).catch(error => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});
