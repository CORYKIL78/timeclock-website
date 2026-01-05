#!/bin/bash

# Discord Bot Fix Script
# This script helps diagnose and fix common Discord bot issues

echo "🔍 Discord Bot Diagnostic & Fix Script"
echo "======================================"
echo ""

# Check if we're in the discord-bot directory
if [ ! -f "bot.js" ]; then
    echo "📁 Changing to discord-bot directory..."
    cd discord-bot || { echo "❌ Error: discord-bot directory not found!"; exit 1; }
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if config.js exists
if [ ! -f "config.js" ]; then
    echo "❌ Error: config.js not found!"
    echo "Please create config.js with your bot credentials"
    exit 1
fi

echo "✅ config.js found"

# Check if commands exist
echo ""
echo "📋 Checking commands..."
if [ -d "commands" ]; then
    command_count=$(ls -1 commands/*.js 2>/dev/null | wc -l)
    echo "✅ Found $command_count command files"
    ls commands/*.js | while read file; do
        echo "   - $(basename $file)"
    done
else
    echo "❌ Error: commands directory not found!"
    exit 1
fi

echo ""
echo "🔄 Re-deploying commands to Discord..."
node deploy-commands.js

echo ""
echo "======================================"
echo "✅ Bot setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Make sure your bot is invited to your server"
echo "2. Ensure it has the following permissions:"
echo "   - Send Messages"
echo "   - Use Slash Commands"
echo "   - View Channels"
echo "3. Start the bot with: node bot.js"
echo ""
echo "🐛 If commands still don't work:"
echo "1. Check that CLIENT_ID and GUILD_ID are correct in config.js"
echo "2. Wait up to 1 hour for global commands (or use guild commands)"
echo "3. Try kicking and re-inviting the bot"
echo "4. Check bot logs for errors when running: node bot.js"
echo ""
