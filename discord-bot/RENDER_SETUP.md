# Discord Bot Deployment - Render.com

## Prerequisites
1. Create account at https://render.com/
2. Have your bot token ready
3. Push code to GitHub

## Deployment Steps

### Option 1: Using Dashboard (Recommended)

1. **Connect GitHub:**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select `CORYKIL78/timeclock-website` repository
   - Select the `discord-bot` directory as root

2. **Configure Service:**
   - **Name:** `cirkle-commission-bot`
   - **Region:** Frankfurt (or closest to you)
   - **Branch:** `main`
   - **Root Directory:** `discord-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

3. **Set Environment Variables:**
   Click "Advanced" and add:
   - `DISCORD_TOKEN` = your bot token
   - `DISCORD_CLIENT_ID` = your client ID
   - `DISCORD_GUILD_ID` = your guild ID
   - `NODE_ENV` = production

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Check logs to verify bot is online

### Option 2: Using render.yaml (Auto-deploy)

1. **The `render.yaml` file is already in your repo!**

2. **Connect as Blueprint:**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Blueprint"
   - Connect GitHub repo
   - Select `timeclock-website`
   - Render will detect `render.yaml` automatically

3. **Add Environment Variables:**
   - After blueprint is created, go to the service
   - Settings → Environment
   - Add the Discord variables

## Important Notes

**Free Plan Limits:**
- 750 hours/month (≈31 days)
- 512MB RAM
- Spins down after 15 min inactivity
- Takes ~30 sec to spin up when interaction arrives

**Keep Bot Awake (Optional):**
To prevent spinning down, add this to bot.js or create a simple HTTP endpoint:
```javascript
// Add Express server
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000);
```

Then use a service like UptimeRobot to ping every 5 minutes.

**Persistent Storage:**
- Render free tier doesn't have persistent disk
- `quotes.json` will reset on restarts
- **Recommended:** Add a free database (see below)

## Add Database for Persistence (Optional)

### Use Render PostgreSQL:
1. Create PostgreSQL database (free)
2. Update bot to use database instead of JSON file

### Or use MongoDB Atlas:
1. Create free MongoDB cluster at https://www.mongodb.com/cloud/atlas
2. Update bot to use MongoDB

### Or accept resets:
- Free tier resets data on deploy/restart
- Not ideal but functional for testing

## Deploy Commands

After bot is running:
```bash
# Deploy slash commands locally
node deploy-commands.js
```

## Monitoring

- **Dashboard:** https://dashboard.render.com/
- **Logs:** Click your service → Logs tab
- **Manual Deploy:** Click "Manual Deploy" → "Deploy latest commit"

## Auto-Deploy

Render auto-deploys when you push to GitHub main branch!

## Troubleshooting

**Bot not responding:**
- Check logs in Render dashboard
- Verify environment variables are set
- Wait 30 seconds for spin-up if it was inactive

**Data loss on restart:**
- Free tier has no persistent disk
- Consider upgrading or using external database

**Build failed:**
- Check `package.json` has all dependencies
- Verify Node.js version compatibility

## Support
- Render Discord: https://discord.gg/render
- Dashboard: https://dashboard.render.com/
- Docs: https://render.com/docs
