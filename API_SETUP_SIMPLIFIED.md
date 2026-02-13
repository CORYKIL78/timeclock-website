# API Setup - What Changed (Simplified!)

## Before: 🤯 Too Complex
- Multiple configuration options
- Confusing environment variables
- Complex CORS setup
- Overwhelming deployment guides

## Now: ✅ Super Simple

### What You Need to Know

**3 files. That's it:**

1. **accounts-api/.env** - Just 1 required setting
   ```env
   MONGODB_URI=your_mongodb_string
   ```

2. **accounts-api/server.js** - Runs the API
   ```bash
   npm start
   ```

3. **HTML** - Tell frontend where API is
   ```html
   <script>
     localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
   </script>
   ```

### Quick Start (Copy & Paste)

```bash
cd accounts-api
npm install
cp .env.example .env
# Edit .env, add MONGODB_URI
npm start
```

Add to your HTML:
```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
</script>
```

Done! ✅

### Deploy (Pick One)

**Easiest: Render**
- Push to GitHub
- Go to render.com
- Connect repo
- Add env var
- Deploy

See [SIMPLE_DEPLOYMENT.md](SIMPLE_DEPLOYMENT.md) for exact steps.

### In Your Frontend Code

```javascript
// Get complete account info
const account = await fetchAccountInfo(userId);

// Or individual sections
const absences = await fetchAccountAbsences(userId);
```

That's literally it!

---

## API Endpoints

All GET requests:
- `/health` - Check if running
- `/api/accounts/{userId}` - Get everything
- `/api/user/profile/{userId}` - Just profile
- `/api/user/absences/{userId}` - Just absences
- etc.

---

## Files Created

| File | Purpose |
|------|---------|
| accounts-api/server.js | The actual API |
| accounts-api/package.json | Dependencies |
| accounts-api/.env.example | Config template |
| accounts-api/README.md | Simple docs |
| accounts-api/setup.sh | Auto-setup script |
| accounts-api/Dockerfile | Docker deployment |
| SIMPLE_DEPLOYMENT.md | Easy deployment guide |
| QUICK_API_SETUP.md | Quick start guide |
| script.js (updated) | Frontend functions added |

---

## Frontend Functions Now Available

```javascript
// These all work now:
setAPIURLs(backendUrl, accountsApiUrl) // Change API URLs
fetchAccountInfo(userId)                 // Get everything
fetchAccountProfile(userId)              // Get profile only
fetchAccountAbsences(userId)             // Get absences
fetchAccountPayslips(userId)             // Get payslips
fetchAccountDisciplinaries(userId)       // Get disciplinaries
fetchAccountRequests(userId)             // Get requests
fetchAccountReports(userId)              // Get reports
checkAccountsAPIHealth()                 // Check if API is up
```

---

## MongoDB Setup

Don't have MongoDB? Get free tier in 2 minutes:
1. https://www.mongodb.com/cloud/atlas
2. Create account
3. Create free cluster
4. Get connection string
5. Add to `.env`

---

## What Stayed the Same

- Your Cloudflare Worker (BACKEND_URL) still works
- Discord authentication still works
- Everything in script.js still works
- All your HTML pages still work

---

## Next Steps

1. ✅ Run Accounts API locally: `cd accounts-api && npm start`
2. ✅ Add localStorage line to HTML
3. ✅ Test in console: `checkAccountsAPIHealth()`
4. ✅ Deploy to Render/Railway when ready (see SIMPLE_DEPLOYMENT.md)

---

## Questions?

Check console output - it tells you exactly what's wrong.

If stuck, share the error message from DevTools (F12) Console tab.
