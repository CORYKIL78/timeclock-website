/**
 * Check what commands are registered in Discord
 */

const { REST, Routes } = require('discord.js');
const config = require('./config');

const CLIENT_ID = config.CLIENT_ID;
const GUILD_ID = config.GUILD_ID;
const TOKEN = config.DISCORD_BOT_TOKEN;

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('📋 Fetching guild commands...');
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
        );
        
        console.log(`\n✅ Found ${guildCommands.length} guild commands:`);
        for (const cmd of guildCommands) {
            console.log(`   - /${cmd.name} (ID: ${cmd.id})`);
        }
        
        console.log('\n📋 Fetching global commands...');
        const globalCommands = await rest.get(
            Routes.applicationCommands(CLIENT_ID)
        );
        
        console.log(`\n✅ Found ${globalCommands.length} global commands:`);
        for (const cmd of globalCommands) {
            console.log(`   - /${cmd.name} (ID: ${cmd.id})`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
