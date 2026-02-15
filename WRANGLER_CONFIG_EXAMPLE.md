# Example wrangler.toml Configuration for Admin Credentials

This file shows how to add admin credentials to your Cloudflare Worker.

## Method 1: Using wrangler.toml (Recommended)

```toml
# wrangler.toml
name = "timeclock-backend"
type = "javascript"

# ... other config ...

[env.production]
# Admin credentials - get these from: node setup-admins.js env
vars = { 
  ADMIN_1088907566844739624_PIN = "061021",
  ADMIN_1088907566844739624_NAME = "Marcus Ray",
  ADMIN_1002932344799371354_PIN = "486133",
  ADMIN_1002932344799371354_NAME = "Appler Smith",
  ADMIN_1187751127039615086_PIN = "638542",
  ADMIN_1187751127039615086_NAME = "Sam Caster",
  ADMIN_926568979747713095_PIN = "287183",
  ADMIN_926568979747713095_NAME = "Teejay Everil",
  ADMIN_1203762560059314192_PIN = "315793",
  ADMIN_1203762560059314192_NAME = "Noelle Holiday"
}

[env.development]
# Optional: Different admins for development environment
vars = {
  ADMIN_1088907566844739624_PIN = "061021",
  ADMIN_1088907566844739624_NAME = "Marcus Ray"
}
```

Deploy to production:
```bash
wrangler deploy --env production
```

## Method 2: Using Cloudflare Dashboard (Alternative)

1. Go to Cloudflare Dashboard
2. Select your Worker
3. Click **Settings** > **Environment variables**
4. Add each variable:
   - Name: `ADMIN_1088907566844739624_PIN`
   - Value: `061021`
5. Repeat for each admin credential

## Method 3: Using .env File (Not Recommended)

Create `.env` in your project root (gitignored):

```bash
# .env (gitignored - not committed)
ADMIN_1088907566844739624_PIN=061021
ADMIN_1088907566844739624_NAME=Marcus Ray
ADMIN_1002932344799371354_PIN=486133
ADMIN_1002932344799371354_NAME=Appler Smith
```

Add to `.gitignore`:
```
.env
```

Then reference in wrangler.toml:
```toml
# This doesn't work directly in wrangler, use Method 1 instead
```

## Recommended Workflow

1. Manage credentials locally:
   ```bash
   cp admin-credentials.example.json admin-credentials.json
   nano admin-credentials.json
   ```

2. Generate environment variable format:
   ```bash
   node setup-admins.js env
   ```

3. Copy the output to your `wrangler.toml` `[env.production]` section

4. Deploy:
   ```bash
   wrangler deploy --env production
   ```

5. Verify in Cloudflare Dashboard that variables are set

## Verifying Deployment

After deployment, your admin credentials will work with the backend `/api/admin/validate` endpoint.

Test by:
1. Visiting the admin portal
2. Entering a Discord ID and PIN from your environment variables
3. Should authenticate successfully

## Rotating Credentials

To change an admin's PIN:

1. Edit `admin-credentials.json`
2. Run `node setup-admins.js dev` (updates local dev config)
3. Run `node setup-admins.js env` (get new format for production)
4. Update `wrangler.toml` with new PIN
5. Run `wrangler deploy --env production`

## Security Checklist

- [ ] `admin-credentials.json` is in `.gitignore`
- [ ] `.env-config.js` is in `.gitignore`
- [ ] Environment variables are set in Cloudflare (not in git)
- [ ] PINs are strong (not easily guessable)
- [ ] Only admin Discord IDs can login
- [ ] Backend validates credentials, not frontend
- [ ] wrangler.toml with sensitive vars is NOT committed

## Troubleshooting

### "Invalid credentials" after deployment

1. Check variable names match format: `ADMIN_{ID}_PIN` and `ADMIN_{ID}_NAME`
2. Verify variables are set: `wrangler secret list` (for secrets) or Dashboard
3. Verify worker is using production environment
4. Try a redeploy: `wrangler deploy --env production`

### Variables not appearing in worker

1. Wait a few minutes for deployment to complete
2. Check Cloudflare Dashboard status
3. Try: `wrangler tail` to see active instances
4. Clear browser cache

### "ADMIN_XXXX_PIN is undefined"

Your environment variable wasn't set correctly. Check:
1. Variable name format is exact (underscore separators)
2. Discord ID is correct (20 digits)
3. Value is in quotes if it's a string
