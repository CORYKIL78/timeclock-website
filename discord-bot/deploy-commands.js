/**
 * Deploy Commands Script
 * Registers slash commands with Discord
 * 
 * Run this script once to register your commands:
 * node deploy-commands.js
 */

const { REST, Routes } = require('discord.js');
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

const CLIENT_ID = config.CLIENT_ID;
const GUILD_ID = config.GUILD_ID;
const TOKEN = config.DISCORD_BOT_TOKEN;

// Load all commands from commands folder
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`📋 Prepared command: ${command.data.name}`);
    }
}

// Create REST client
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Deploy commands
(async () => {
    try {
        console.log('🔄 Started refreshing application (/) commands...');

        // Register commands for specific guild (faster for testing)
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${data.length} application commands!`);
        console.log(`📋 Registered commands:`);
        data.forEach(cmd => console.log(`   - /${cmd.name}`));
        
        console.log('\n💡 To register globally (slower, up to 1 hour), use:');
        console.log('   Routes.applicationCommands(CLIENT_ID)');

    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();
