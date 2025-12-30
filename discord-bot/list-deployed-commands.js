/**
 * List all commands currently deployed on Discord
 * This shows what commands are actually registered with Discord
 */

const { REST, Routes } = require('discord.js');
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

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔍 Fetching deployed commands from Discord...\n');

        // Get guild commands
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
        );

        console.log(`📋 Found ${guildCommands.length} guild commands:\n`);
        guildCommands.forEach(cmd => {
            console.log(`  /${cmd.name}`);
            console.log(`    Description: ${cmd.description}`);
            if (cmd.options && cmd.options.length > 0) {
                console.log(`    Subcommands/Options:`);
                cmd.options.forEach(opt => {
                    if (opt.type === 1) { // SUB_COMMAND
                        console.log(`      - ${opt.name}: ${opt.description}`);
                    }
                });
            }
            console.log('');
        });

        // Also check global commands
        const globalCommands = await rest.get(
            Routes.applicationCommands(CLIENT_ID)
        );

        if (globalCommands.length > 0) {
            console.log(`\n🌍 Found ${globalCommands.length} global commands:\n`);
            globalCommands.forEach(cmd => {
                console.log(`  /${cmd.name}`);
                console.log(`    Description: ${cmd.description}\n`);
            });
        }

    } catch (error) {
        console.error('❌ Error fetching commands:', error);
    }
})();
