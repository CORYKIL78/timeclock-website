# Complete Deployment Guide

> **⚡ Quick Start:** Want the simpler version? See [SIMPLE_DEPLOYMENT.md](SIMPLE_DEPLOYMENT.md) for step-by-step deployment to Render, Railway, or other platforms.

This guide covers deploying the entire timeclock system with both the backend worker and the standalone Accounts API.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Portal                             │
│              (HTML/CSS/JavaScript - Static)                     │
│  Location: /index.html to /pages/*.html                         │
└──────────┬──────────────────────────────────────────┬───────────┘
           │                                          │
           ▼                                          ▼
    ┌─────────────────────┐             ┌──────────────────────────┐
    │  Cloudflare Worker  │             │  Accounts API Server     │
    │  (Backend Service)  │             │   (Node.js + MongoDB)    │
    └─────────────────────┘             └──────────────────────────┘
    - Discord Auth                      - Account Info Retrieval
    - Member Lookups                    - Profile Data
    - Workflows                         - Absences/Payslips
    - Notifications                     - Disciplinaries
                                        - Reports/Requests
```

## Prerequisites

Before deploying, ensure you have:

1. **For Cloudflare Worker:**
   - Wrangler CLI installed: `npm install -g wrangler`
   - Cloudflare account
   - Discord Bot token + Client Secret
   - Google Sheets credentials (if still using Google Sheets)

2. **For Accounts API:**
   - Node.js 16+ installed
   - MongoDB database (free tier on MongoDB Atlas)
   - Render/Railway/Heroku account (or own VPS)

3. **For Frontend:**
   - Domain or hosting (Vercel, Netlify, GitHub Pages)
   - DNS configured (if using custom domain)

## Step 1: Deploy Cloudflare Worker

### Option A: Using Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Navigate to project root
cd /path/to/timeclock-website

# Login to Cloudflare
wrangler login

# Publish worker
wrangler publish

# Check deployment
curl https://your-worker-name.your-account.workers.dev/api/status
```

### Option B: Manual Deployment via Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to Workers → Create Service
4. Copy contents of `worker.js` into the editor
5. Add environment variables (Secrets):
   - `DISCORD_BOT_TOKEN`: Your bot token
   - `DISCORD_CLIENT_SECRET`: Your OAuth secret
   - `DISCORD_CLIENT_ID`: Your app ID
6. Click Deploy

### Environment Variables for Worker

Create `wrangler.toml` or set in dashboard:
```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[env.production.secrets]
# Add via `wrangler secret put SECRET_NAME`
# - DISCORD_BOT_TOKEN
# - DISCORD_CLIENT_SECRET
# - DISCORD_CLIENT_ID
```

Set secrets:
```bash
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_ID
```

## Step 2: Deploy Accounts API

Choose one deployment option below:

### Option A: Render (Recommended - Easiest)

1. **Push code to GitHub** (entire repository including `accounts-api` folder)

2. **Create Render Web Service:**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Configure:
     - **Name:** `cirkle-accounts-api`
     - **Root Directory:** `accounts-api`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment:** Node

3. **Add Environment Variables:**
   - `MONGODB_URI`: Your MongoDB connection string
   - `DB_NAME`: timeclock
   - `ALLOWED_ORIGINS`: Your frontend domain

4. **Deploy** - Render will auto-deploy on git push

**Result URL:** `https://cirkle-accounts-api.onrender.com`

### Option B: Railway

1. **Push to GitHub**

2. **Connect Railway:**
   - Go to https://railway.app
   - Create new project
   - Connect GitHub repo
   - Select repository

3. **Configure:**
   - Service detected as Node.js
   - Root directory: `accounts-api`
   - Build: `npm install`
   - Start: `npm start`

4. **Set Variables:**
   - `MONGODB_URI`: Your MongoDB connection string
   - `ALLOWED_ORIGINS`: Your frontend domain

**Result URL:** `https://your-project.railway.app`

### Option C: Heroku (Legacy - May Require Paid Plan)

```bash
# Install Heroku CLI
curl https://cli.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create cirkle-accounts-api

# Set buildpack for subdirectory
heroku buildpacks:set https://github.com/timanovsky/subdir-heroku-buildpack.git
heroku buildpacks:add heroku/nodejs

# Configure buildpack
heroku config:set PROJECT_PATH=accounts-api

# Add MongoDB URI
heroku config:set MONGODB_URI="mongodb://connection-string"

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option D: Self-Hosted VPS (DigitalOcean, Linode, AWS)

```bash
# SSH into server
ssh user@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone https://github.com/your-repo.git
cd your-repo/accounts-api

# Install dependencies
npm install --production

# Create .env file
cp .env.example .env
# Edit with MongoDB URI and settings
nano .env

# Install PM2 for process management
npm install -g pm2

# Start service
pm2 start server.js --name accounts-api
pm2 startup
pm2 save

# Install Nginx as reverse proxy
sudo apt-get install nginx -y
sudo systemctl start nginx

# Configure Nginx (example)
sudo nano /etc/nginx/sites-available/default

# Add:
# server {
#     listen 80;
#     server_name api.yourdomain.com;
#     location / {
#         proxy_pass http://localhost:3000;
#     }
# }

# Set SSL (optional but recommended)
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com
```

## Step 3: Setup MongoDB

### Option A: MongoDB Atlas (Cloud - Recommended)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Configure IP whitelist (allow your servers)
4. Create database user
5. Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/database`

### Option B: Self-Hosted MongoDB

```bash
# Install
sudo apt-get install -y mongodb

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Connect
mongosh

# Create database and collections
use timeclock
db.users.insertOne({_id: "test"})
```

### Create Required Collections

```javascript
// Run in MongoDB shell

// Users collection
db.users.createIndex({ discordId: 1 });

// Absences collection
db.absences.createIndex({ userId: 1 });

// Payslips collection
db.payslips.createIndex({ userId: 1 });

// Disciplinaries collection
db.disciplinaries.createIndex({ userId: 1 });

// Requests collection
db.requests.createIndex({ userId: 1 });

// Reports collection
db.reports.createIndex({ userId: 1 });
```

## Step 4: Configure Frontend

### In your HTML (before script loads):

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Configure API URLs before loading script.js
    localStorage.setItem('BACKEND_URL', 'https://your-worker.workers.dev');
    localStorage.setItem('ACCOUNTS_API_URL', 'https://your-accounts-api.onrender.com');
  </script>
  <!-- Rest of your HTML -->
</head>
<body>
  <!-- Content -->
  <script src="script.js"></script>
</body>
</html>
```

Or for environment-based configuration:
```html
<script>
  // Read from meta tags or environment
  window.API_CONFIG = {
    backendUrl: document.querySelector('meta[name="backend-url"]')?.content || 'https://your-worker.workers.dev',
    accountsApiUrl: document.querySelector('meta[name="accounts-api-url"]')?.content || 'https://your-accounts-api.onrender.com'
  };
  
  // Then in script.js:
  let BACKEND_URL = window.API_CONFIG.backendUrl;
  let ACCOUNTS_API_URL = window.API_CONFIG.accountsApiUrl;
</script>
```

## Step 5: Deploy Frontend

### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configure in vercel.json:
{
  "framework": "other",
  "buildCommand": "echo 'Nothing to build'",
  "outputDirectory": "."
}
```

### Option B: Netlify

1. Connect GitHub to Netlify
2. Set base directory: `/` (project root)
3. Deploy

### Option C: GitHub Pages

```bash
# Push to gh-pages branch
git subtree push --prefix . origin gh-pages
```

## Step 6: Verify Deployment

### Check Worker Health
```bash
curl https://your-worker.workers.dev/api/status
# Response: { "status": "ok", "timestamp": "..." }
```

### Check Accounts API Health
```bash
curl https://your-accounts-api.onrender.com/health
# Response: { "status": "ok", "database": "connected", ... }
```

### Test Complete Workflow
```bash
# Get account info
curl https://your-accounts-api.onrender.com/api/accounts/USER_ID

# Should return user profile, absences, payslips, etc.
```

### Check Frontend
- Open https://your-frontend-domain.com
- Open DevTools (F12)
- Check Console for messages like `[API URLS]`
- Test login with Discord
- Navigate to different tabs
- Verify data loads correctly

## Monitoring & Logs

### Cloudflare Worker
- https://dash.cloudflare.com → Workers → your-service
- Real-time request logs

### Render/Railway
- Dashboard shows live logs
- Use `render logs` or Railway dashboard

### Self-Hosted
```bash
# Follow logs
pm2 logs accounts-api

# Or journalctl
journalctl -fu mongod
```

### Frontend
- Browser Dev Tools (F12)
- Network tab to see API calls
- Console for JavaScript errors

## Performance Optimization

### Accounts API
```javascript
// Enable connection pooling in MongoDB
// (Done automatically by driver)

// Add caching if needed
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getCachedAccount(userId) {
  if (cache.has(userId)) {
    const cached = cache.get(userId);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  const data = await fetchAccountInfo(userId);
  cache.set(userId, { data, timestamp: Date.now() });
  return data;
}
```

### Frontend
- Use compression (gzip)
- Lazy load pages
- Cache API responses in browser

## Updating Deployments

### Update Worker

```bash
# Edit worker.js locally
# Then:
wrangler publish
```

### Update Accounts API

```bash
# Make changes
git push # Render/Railway auto-deploy
# OR
pm2 restart accounts-api # Self-hosted
```

### Update Frontend

```bash
# Push to repository
# Auto-deploys to Vercel/Netlify/GitHub Pages
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot reach API" | Check firewall, DNS, server is running |
| "CORS error" | Verify origin in ALLOWED_ORIGINS on API |
| "Database not connected" | Check MONGODB_URI, IP whitelist |
| "Worker undefined" | Check wrangler.toml, secrets set |
| "Slow responses" | Check MongoDB indexes, add caching |
| "404 on routes" | Verify API URL configuration in frontend |

## What's Next?

1. **Migrate Data** from Google Sheets to MongoDB
2. **Update Endpoints** to use MongoDB instead of Sheets
3. **Set up CI/CD** for automatic deployments
4. **Add Monitoring** (Sentry, DataDog, etc.)
5. **Scale API** as needed (add more servers/load balancer)

For more details, see:
- [accounts-api/README.md](accounts-api/README.md)
- [API_CONFIGURATION.md](API_CONFIGURATION.md)
- [GOOGLE_SHEETS_REMOVAL.md](GOOGLE_SHEETS_REMOVAL.md)
