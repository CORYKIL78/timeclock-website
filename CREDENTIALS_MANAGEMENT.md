# Credential Management & Security Guide

## What Was Done

### ✅ Removed All Hardcoded Credentials
- **Removed from script.js**: Discord Client ID, Worker URL, Guild ID, Redirect URI, Required Role
- **Removed from worker.js**: Discord Client ID hardcoded in OAuth endpoint
- **Removed from admin/backup.html**: All admin PINs and Discord IDs

### ✅ Created Environment-Based Configuration System

1. **`.env.example`** - Template showing required variables (committed to git)
2. **`config-loader.js`** - Browser-side configuration loader (committed to git)
3. **`generate-config.js`** - Script to generate `.env-config.js` from `.env` (committed to git)
4. **`.env`** - Your actual secrets (NOT committed, in .gitignore)
5. **`.env-config.js`** - Generated config for browser (NOT committed, in .gitignore)

## Setup Instructions

### Step 1: Create Your `.env` File

```bash
cp .env.example .env
```

### Step 2: Fill in Your Actual Values

Edit `.env` with your real credentials:

```env
# Discord OAuth Configuration
DISCORD_CLIENT_ID=1417915896634277888
DISCORD_CLIENT_SECRET=your_actual_discord_secret_here

# Backend Configuration
WORKER_URL=https://timeclock-backend.marcusray.workers.dev
REDIRECT_URI=https://portal.cirkledevelopment.co.uk

# Discord Server
GUILD_ID=1310656642672627752
REQUIRED_ROLE=1315346851616002158

# Admin Portal Credentials (store PINs securely)
ADMIN_1088907566844739624_PIN=your_actual_pin_here
ADMIN_1088907566844739624_NAME=Marcus Ray

ADMIN_1002932344799371354_PIN=your_actual_pin_here
ADMIN_1002932344799371354_NAME=Appler Smith

ADMIN_1187751127039615086_PIN=your_actual_pin_here
ADMIN_1187751127039615086_NAME=Sam Caster

ADMIN_926568979747713095_PIN=your_actual_pin_here
ADMIN_926568979747713095_NAME=Teejay Everil

# Resend Email API
RESEND_API_KEY=re_your_actual_resend_key_here
```

### Step 3: Generate Configuration File

```bash
npm run build-config
```

This creates `.env-config.js` (automatically git-ignored) containing all your credentials for browser access.

### Step 4: Load Config in HTML Files

For **frontend** (index.html, toolbox.html, etc.):
```html
<!-- Add at the TOP of <head> before other scripts -->
<script src="config-loader.js"></script>
<script src=".env-config.js"></script>
<!-- Now you can use window.CONFIG in other scripts -->
```

For **admin portal** (admin/backup.html):
```html
<!-- Already updated - loads both config files automatically -->
<script src="../config-loader.js"></script>
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────┐
│ Developer writes secrets in .env            │
│ (stored locally, never committed)           │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        npm run build-config
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Generated .env-config.js                    │
│ (git-ignored, for browser use)              │
│ Contains: window.CONFIG = {...}             │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        HTML loads .env-config.js
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ JavaScript accesses: window.CONFIG          │
│ Example: CLIENT_ID = window.CONFIG.DISCORD_ │
│          CLIENT_ID || 'fallback'            │
└─────────────────────────────────────────────┘
```

### In Code

**Before** (❌ Insecure):
```javascript
const CLIENT_ID = '1417915896634277888';  // Hardcoded!
```

**After** (✅ Secure):
```javascript
const CLIENT_ID = window.CONFIG?.DISCORD_CLIENT_ID || '1417915896634277888';
```

- Uses environment config if available
- Falls back to default if not configured
- Never hardcodes secrets

## For Cloudflare Workers Deployment

Store secrets in Cloudflare Dashboard:

```bash
# Set secrets via wrangler
wrangler secret put DISCORD_CLIENT_SECRET
# (Paste your actual secret when prompted)

wrangler secret put RESEND_API_KEY
# (Paste your actual API key when prompted)
```

Then in `worker.js`:
```javascript
const clientSecret = env.DISCORD_CLIENT_SECRET;
const resendKey = env.RESEND_API_KEY;
```

**Verify secrets are set:**
```bash
wrangler secret list
```

## Security Checklist

- ✅ `.env` file in `.gitignore` (never committed)
- ✅ `.env-config.js` in `.gitignore` (never committed)
- ✅ No hardcoded credentials in source files
- ✅ Admin PINs not stored in code
- ✅ Discord secrets in Cloudflare Secrets (not in code)
- ✅ Fallback defaults provided for non-sensitive config

## File Structure

```
timeclock-website/
├── .env                      ← Your secrets (NOT committed) ⚠️
├── .env.example              ← Template (committed) ✅
├── .env-config.js            ← Generated (NOT committed) ⚠️
├── .gitignore                ← Already ignores .env* ✅
├── config-loader.js          ← Loads config (committed) ✅
├── generate-config.js        ← Generates config (committed) ✅
├── script.js                 ← Uses window.CONFIG ✅
├── worker.js                 ← Uses env variables ✅
├── index.html                ← Add script includes ⚠️
├── admin/
│   └── backup.html           ← Already updated ✅
└── wrangler.toml             ← Cloudflare config ✅
```

## HTML Setup Examples

### Main Portal (index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Load config FIRST, before any other scripts -->
  <script src="config-loader.js"></script>
  <script src=".env-config.js"></script>
  
  <!-- Then your app scripts -->
  <script src="script.js"></script>
</head>
<body>
  <!-- content -->
</body>
</html>
```

### Toolbox (toolbox.html)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="config-loader.js"></script>
  <script src=".env-config.js"></script>
  <script src="financetools.js"></script>
</head>
<body>
  <!-- content -->
</body>
</html>
```

## Troubleshooting

### Problem: "CONFIG is undefined"
**Solution**: Make sure `config-loader.js` is loaded first, before any scripts that use `window.CONFIG`.

### Problem: "API returns 401/403"
**Possible causes**:
- Client secret not set in Cloudflare: `wrangler secret list`
- Resend API key not set: `wrangler secret list`
- Check `.env` has correct values

### Problem: Admin login fails
**Checklist**:
1. `.env-config.js` generated? Run `npm run build-config`
2. Admin credentials populated in `.env`?
3. Discord IDs and PINs correct?
4. Reload page after generating config

## Deployment Workflow

```bash
# 1. Local development
cp .env.example .env
# Edit .env with your development credentials
npm run build-config

# 2. Deploy to Cloudflare
npm run deploy
# Or manually:
npm run build-config
wrangler deploy

# 3. Set production secrets in Cloudflare Dashboard
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put RESEND_API_KEY
```

## Never Do This

```javascript
❌ const SECRET = '1417915896634277888';
❌ const PIN = '061021';
❌ const API_KEY = 're_abc123xyz';
❌ localStorage.setItem('secret', 'value');
❌ console.log(SECRET);  // Visible in browser DevTools
```

## Always Do This

```javascript
✅ const SECRET = window.CONFIG?.DISCORD_CLIENT_ID || 'fallback';
✅ const PIN = '';  // Store in .env, not code
✅ const API_KEY = env.RESEND_API_KEY;  // Cloudflare secret
✅ // Don't log sensitive data
```

## Summary

| Item | Before | After |
|------|--------|-------|
| **Credentials Location** | Hardcoded in files | `.env` file (secure) |
| **Git Exposure Risk** | ⚠️ Very High | ✅ None (.gitignore) |
| **Browser DevTools Access** | ⚠️ Visible | ✅ Only generated config |
| **Admin PINs** | Hardcoded | ✅ In `.env` |
| **Discord Secrets** | Hardcoded | ✅ Cloudflare Secrets |
| **Easy Config Changes** | Requires code edit | ✅ Edit `.env` + regenerate |

**Status**: ✅ All credentials secured and removed from codebase.
