# Admin Credentials Setup Guide

This guide explains how to manage admin credentials for the OC Portal both locally and in production.

## Quick Start (Local Development)

### 1. Copy the Example Credentials File

```bash
cp admin-credentials.example.json admin-credentials.json
```

### 2. Edit Your Credentials

Open `admin-credentials.json` and add the admin credentials you want to use:

```json
{
  "admins": [
    {
      "discordId": "2515252512512",
      "name": "Jane Doe",
      "pin": "123456"
    },
    {
      "discordId": "657373737373473",
      "name": "John Doe",
      "pin": "123456"
    }
  ]
}
```

### 3. Generate the Dev Config File

```bash
node setup-admins.js dev
```

This generates `.env-config.js` which is loaded by the admin portal for local testing.

### 4. Open the Admin Portal

The admin portal will now load your local credentials. Login with any admin's Discord ID and PIN.

---

## Managing Admins

### View All Admin

```bash
node setup-admins.js list
```

Output:
```
✅ Admin credentials validated

Found 2 admin(s):

  📌 
  📌 
```

### Add an Admin

```bash
node setup-admins.js add "123456788901234567890" "John Doe" "123456"
```

Then regenerate the dev config:
```bash
node setup-admins.js dev
```

### Remove an Admin

```bash
node setup-admins.js remove "1088907566844739624"
```

Then regenerate the dev config:
```bash
node setup-admins.js dev
```

### Show Environment Variables for Production

```bash
node setup-admins.js env
```

Output:
```
=== Environment Variable Format ===

ADMIN_1088907566844739624_PIN="061021"
ADMIN_1088907566844739624_NAME="Marcus Ray"
ADMIN_1002932344799371354_PIN="486133"
ADMIN_1002932344799371354_NAME="Appler Smith"

Add these to your Cloudflare Worker environment (wrangler.toml or dashboard)
```

---

## Development vs Production

### Development (Local Testing)

1. **Credentials Source:** `admin-credentials.json` (gitignored)
2. **Config File:** `.env-config.js` (generated, gitignored)
3. **Authentication:** Local validation in browser
4. **Typical Usage:**
   - Run `node setup-admins.js dev` after editing credentials
  - Login to `/admin` with your local Discord ID and PIN
   - Backend not required for authentication

### Production (Deployed)

1. **Credentials Source:** Cloudflare Worker environment variables
2. **Environment Variables:** 
   - `ADMIN_{DISCORD_ID}_PIN`
   - `ADMIN_{DISCORD_ID}_NAME`
3. **Authentication:** Backend validation via `/api/admin/validate`
4. **Setup Steps:**
   ```bash
   # Get environment variable format
   node setup-admins.js env
   
   # Add these to your Cloudflare Worker
   # Option A: In wrangler.toml
   [env.production]
   vars = { ADMIN_1088907566844739624_PIN = "061021", ... }
   
   # Option B: In Cloudflare Dashboard
   # Settings > Environment variables > ADMIN_...
   
   # Deploy
   wrangler deploy
   ```

---

## File Status

### Tracked by Git
- `admin-credentials.example.json` ✅ - Example template
- `setup-admins.js` ✅ - Setup script
- `admin/backup.html` ✅ - Updated with dual auth
- `config-loader.js` ✅ - Configuration loader

### Gitignored (Never Committed)
- `admin-credentials.json` ❌ - Your actual credentials
- `.env-config.js` ❌ - Generated dev config

---

## Security Notes

### Local Development
- `admin-credentials.json` contains plaintext credentials, protected by `.gitignore`
- `.env-config.js` is generated from your credentials
- **Never commit these files** - they're in `.gitignore`
- Credentials visible in browser console in development mode

### Production Deployment
- Use Cloudflare Worker environment variables
- Credentials stored securely in Cloudflare
- Backend validates credentials, not frontend
- No credentials exposed in HTML or browser

---

## Troubleshooting

### "admin-credentials.json not found"

You need to create the file first:
```bash
cp admin-credentials.example.json admin-credentials.json
node setup-admins.js dev
```

### "Error parsing admin-credentials.json"

Check your JSON syntax. Common issues:
- Missing quotes around strings
- Trailing commas
- Mismatched brackets

Fix by opening in a JSON validator or editor.

### Admin login not working

1. **Development:**
   - Run `node setup-admins.js dev` to regenerate `.env-config.js`
   - Check Discord ID and PIN match exactly in `admin-credentials.json`
   - Check `.env-config.js` is loaded (check Network tab in DevTools)

2. **Production:**
   - Verify environment variables are set in Cloudflare Worker
   - Check variable names follow format: `ADMIN_{ID}_PIN`
   - Run `wrangler deploy` after adding variables

### How do I change an admin's PIN?

1. Edit `admin-credentials.json`
2. Change the PIN value
3. Run `node setup-admins.js dev`
4. For production, get new env format: `node setup-admins.js env`

---

## Example Workflow

### First Time Setup
```bash
# Copy example credentials
cp admin-credentials.example.json admin-credentials.json

# Edit with your actual admin data
nano admin-credentials.json

# Generate development config
node setup-admins.js dev

# Test in browser - admin portal should work with your local credentials
```

### Adding a New Admin
```bash
# Add via script
node setup-admins.js add "1234567890" "New Admin" "123456"

# Regenerate dev config
node setup-admins.js dev

# List to verify
node setup-admins.js list

# For production, get the env vars
node setup-admins.js env
# Then add to Cloudflare Worker and redeploy
```

### Deploying to Production
```bash
# Get environment variable format
node setup-admins.js env

# Copy the output and:
# Option A) Add to wrangler.toml
# Option B) Add to Cloudflare Dashboard > Settings > Environment variables

# Deploy
wrangler deploy

# Admin portal will now validate against Cloudflare environment variables
```

---

## FAQ

**Q: Why do I need both local credentials and environment variables?**
A: Local credentials are for quick development/testing. Environment variables are for production where you don't have direct filesystem access.

**Q: Can I remove a PIN requirement?**
A: No. PINs are required for security. But you can use any string (e.g., "0" or "pass").

**Q: What if I forget an admin's PIN?**
A: Edit `admin-credentials.json`, change the PIN, run `node setup-admins.js dev`, and try again.

**Q: Are PINs hashed or encrypted?**
A: For development (local), they're plaintext (protected by .gitignore). For production, they're sent securely to backend via HTTPS and validated, never stored in browser.

**Q: Can I use this for other applications?**
A: Yes! The `setup-admins.js` script is generic and can be adapted for any authentication system.

---

**Last Updated:** February 2026
