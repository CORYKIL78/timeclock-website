/**
 * Delete Old/Duplicate Discord Commands
 * This will remove ALL deployed commands from Discord
 * Use this to clean up before redeploying
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
        console.log('🗑️  Starting to delete all deployed commands...\n');

        // Delete guild commands
        console.log('📋 Fetching guild commands...');
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
        );

        if (guildCommands.length > 0) {
            console.log(`Found ${guildCommands.length} guild commands to delete:\n`);
            
            for (const command of guildCommands) {
                console.log(`  Deleting: /${command.name}`);
                await rest.delete(
                    Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, command.id)
                );
            }
            console.log(`\n✅ Deleted ${guildCommands.length} guild command(s)\n`);
        } else {
            console.log('  No guild commands found.\n');
        }

        // Delete global commands
        console.log('🌍 Fetching global commands...');
        const globalCommands = await rest.get(
            Routes.applicationCommands(CLIENT_ID)
        );

        if (globalCommands.length > 0) {
            console.log(`Found ${globalCommands.length} global commands to delete:\n`);
            
            for (const command of globalCommands) {
                console.log(`  Deleting: /${command.name}`);
                await rest.delete(
                    Routes.applicationCommand(CLIENT_ID, command.id)
                );
            }
            console.log(`\n✅ Deleted ${globalCommands.length} global command(s)\n`);
        } else {
            console.log('  No global commands found.\n');
        }

        console.log('✨ All commands have been deleted!');
        console.log('💡 Run "npm run deploy" to deploy fresh commands.');

    } catch (error) {
        console.error('❌ Error deleting commands:', error);
    }
})();
