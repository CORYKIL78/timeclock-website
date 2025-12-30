# Keep Your Bot Online 24/7

Your bot now has a built-in HTTP server. To keep it awake on Render's free tier:

## Step 1: Push Changes to GitHub

```bash
git add .
git commit -m "Add keep-alive server"
git push
```

Render will auto-deploy the update.

## Step 2: Get Your Render URL

After deployment completes:
- Go to your Render dashboard
- Click on your bot service
- Copy the URL (looks like: `https://cirkle-commission-bot.onrender.com`)

## Step 3: Set Up UptimeRobot (FREE Monitoring)

1. **Create account:** https://uptimerobot.com/signUp

2. **Add New Monitor:**
   - Dashboard → "+ Add New Monitor"
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Cirkle Discord Bot
   - **URL:** `https://cirkle-commission-bot.onrender.com`
   - **Monitoring Interval:** 5 minutes
   - Click "Create Monitor"

## Done! 🎉

UptimeRobot will ping your bot every 5 minutes, preventing it from sleeping.

**Benefits:**
- ✅ Bot stays online 24/7
- ✅ Free forever
- ✅ Get email alerts if bot goes down
- ✅ View uptime statistics

## Alternative: Cron-Job.org

If you prefer another service:
1. Go to https://cron-job.org/
2. Create account
3. Add new cron job
4. URL: Your Render URL
5. Schedule: Every 5 minutes

## Test Your Setup

Visit your Render URL in a browser - you should see:
```json
{
  "status": "online",
  "bot": "Employee Management#5797",
  "uptime": 123.456,
  "timestamp": "2025-12-30T..."
}
```

## Troubleshooting

**Bot still sleeping:**
- Check UptimeRobot is actively monitoring (green status)
- Verify the URL is correct
- Check Render logs for errors

**HTTP server not responding:**
- Make sure you pushed the code changes
- Render should auto-deploy from GitHub
- Check deployment logs in Render dashboard
