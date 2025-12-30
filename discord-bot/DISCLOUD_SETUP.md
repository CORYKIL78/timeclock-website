# Discord Bot Deployment - Discloud.app

## Prerequisites
1. Create account at https://discloud.app/
2. Have your bot token ready

## Deployment Steps

### Option 1: Web Dashboard (Easiest)

1. **Prepare the bot:**
   ```bash
   cd discord-bot
   # Make sure package.json has correct start script
   ```

2. **Create ZIP file:**
   ```bash
   # Zip everything except node_modules
   zip -r bot.zip . -x "node_modules/*" ".git/*" "quotes.json"
   ```

3. **Upload to Discloud:**
   - Go to https://discloud.app/dashboard
   - Click "Upload Application"
   - Upload the `bot.zip` file
   - Wait for deployment

4. **Set Environment Variables:**
   - In the Discloud dashboard, go to your app
   - Click "Environment Variables" or "Config"
   - Add:
     - `DISCORD_TOKEN` = your bot token
     - `DISCORD_CLIENT_ID` = your client ID
     - `DISCORD_GUILD_ID` = your guild ID

5. **Start the bot:**
   - Click "Start" in the dashboard
   - Check logs to verify it's running

### Option 2: Discloud CLI

1. **Install Discloud CLI:**
   ```bash
   npm install -g discloud-cli
   ```

2. **Login:**
   ```bash
   discloud login
   # Enter your Discloud API token (get from dashboard settings)
   ```

3. **Deploy:**
   ```bash
   cd discord-bot
   discloud upload
   ```

4. **Check status:**
   ```bash
   discloud status
   discloud logs
   ```

## Important Notes

- **Free Plan Limits:**
  - 512MB RAM
  - 1GB disk space
  - Auto-restarts on crash
  - 24/7 uptime ✅

- **Files:**
  - `discloud.config` - Configuration file (already created)
  - `.discloudignore` - Files to exclude from upload
  - Upload must be < 100MB

- **Persistent Storage:**
  - `quotes.json` will persist on Discloud
  - Data survives restarts ✅

## Commands

```bash
# View logs
discloud logs <app-id>

# Restart bot
discloud restart <app-id>

# Stop bot
discloud stop <app-id>

# Delete app
discloud delete <app-id>
```

## Deploy Commands to Discord

After your bot is running on Discloud:

```bash
# Run locally to deploy slash commands
node deploy-commands.js
```

## Troubleshooting

**Bot not starting:**
- Check `discloud.config` has correct MAIN file
- Verify environment variables are set
- Check logs in dashboard

**Commands not working:**
- Run `node deploy-commands.js` locally
- Make sure bot has proper permissions in Discord

**Quotes not saving:**
- Already handled! The bot saves to `quotes.json` automatically

## Support
- Discloud Discord: https://discord.gg/discloud
- Dashboard: https://discloud.app/dashboard
- Docs: https://docs.discloud.app/
