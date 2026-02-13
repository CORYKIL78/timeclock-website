# Frontend API Configuration

This document explains how to configure the API URLs for the timeclock portal.

## Quick Start

The frontend automatically reads API URLs from localStorage. To configure them:

### Option 1: Via JavaScript Console (Temporary)
```javascript
// In browser developer console (F12)
setAPIURLs('https://your-backend-url.com', 'https://your-accounts-api-url.com');

// Usage examples:
setAPIURLs('https://timeclock-backend.marcusray.workers.dev', 'http://localhost:3000');
setAPIURLs(null, 'https://accounts-api.railway.app'); // Only update accounts API
```

### Option 2: Via HTML Config (Permanent)
Add this to your HTML `<head>` before `script.js` loads:
```html
<script>
  // Set API URLs before loading script.js
  localStorage.setItem('BACKEND_URL', 'https://your-backend-url.com');
  localStorage.setItem('ACCOUNTS_API_URL', 'https://your-accounts-api.com');
</script>
```

### Option 3: Via Environment Variables (Recommended for Deployment)
Create a `.env` file in your root directory:
```env
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_ACCOUNTS_API_URL=https://your-accounts-api.com
```

Then modify `script.js` to read these (add this to script.js if not using React):
```javascript
let BACKEND_URL = window.ENV?.BACKEND_URL || localStorage.getItem('BACKEND_URL') || 'https://timeclock-backend.marcusray.workers.dev';
let ACCOUNTS_API_URL = window.ENV?.ACCOUNTS_API_URL || localStorage.getItem('ACCOUNTS_API_URL') || 'http://localhost:3000';
```

## Default URLs

| Component | Default URL | Type |
|-----------|------------|------|
| BACKEND_URL | `https://timeclock-backend.marcusray.workers.dev` | Cloudflare Worker |
| ACCOUNTS_API_URL | `http://localhost:3000` | Standalone Node.js API |

## Configuration Examples

### Local Development
```javascript
setAPIURLs(
  'http://localhost:8787', // Local Wrangler
  'http://localhost:3000'   // Local Accounts API
);
```

### Production with Render
```javascript
setAPIURLs(
  'https://worker-prod.your-domain.com',
  'https://accounts-api.onrender.com'
);
```

### Production with Railway
```javascript
setAPIURLs(
  'https://worker-prod.railway.app',
  'https://accounts-api.railway.app'
);
```

### Mixed Environment
```javascript
setAPIURLs(
  'https://timeclock-backend.marcusray.workers.dev', // Cloudflare Worker (production)
  'http://localhost:3000'                            // Local Accounts API
);
```

## Verifying Configuration

Check current API URLs in browser console:
```javascript
// View current URLs
console.log('BACKEND_URL:', BACKEND_URL);
console.log('ACCOUNTS_API_URL:', ACCOUNTS_API_URL);

// Or check localStorage
console.log(localStorage.getItem('BACKEND_URL'));
console.log(localStorage.getItem('ACCOUNTS_API_URL'));
```

Test Accounts API connection:
```javascript
checkAccountsAPIHealth().then(status => console.log('Accounts API Status:', status));
```

## API Availability

### Cloudflare Worker (`BACKEND_URL`)
Provides:
- Discord authentication
- Member lookups
- User profile management
- Report/request/absence workflows
- Discord DM notifications

Deploy with:
```bash
wrangler publish
```

### Standalone Accounts API (`ACCOUNTS_API_URL`)
Provides:
- Account information retrieval
- User profile data
- Absences, payslips, disciplinaries
- Requests and reports

Deploy with:
```bash
cd accounts-api
npm install
npm start
```

Or use services like Render, Railway, Heroku (see [accounts-api/README.md](accounts-api/README.md))

## Troubleshooting

### "ACCOUNTS_API_URL not responding"
- Check if Accounts API server is running
- Verify CORS is configured correctly
- Check browser console for exact error
- Test: `curl http://localhost:3000/health`

### "BACKEND_URL not responding"
- Verify Cloudflare Worker is deployed
- Check Workers Spaces Dashboard
- Test: `curl https://your-worker-url/api/status`

### CORS Errors
**Problem:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:**
Backend needs to allow your frontend origin:
```javascript
// In worker.js or Cloudflare Worker
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-frontend-domain.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

Accounts API - update `.env`:
```env
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://another-domain.com
```

### localStorage Not Persisting
- Check if cookies/storage are enabled
- Try incognito/private mode
- Clear browser cache and try again

## Advanced: Custom API Client

If you need more control, create a wrapper:
```javascript
class APIClient {
  constructor(backendUrl, accountsApiUrl) {
    this.backendUrl = backendUrl;
    this.accountsApiUrl = accountsApiUrl;
  }

  async getAccount(userId) {
    const res = await fetch(`${this.accountsApiUrl}/api/accounts/${userId}`);
    return res.json();
  }

  async getProfile(userId) {
    const res = await fetch(`${this.backendUrl}/api/user/profile`);
    return res.json();
  }
}

// Usage
const api = new APIClient(BACKEND_URL, ACCOUNTS_API_URL);
const account = await api.getAccount(userId);
```

## Deployment Checklist

- [ ] Backend Cloudflare Worker deployed
- [ ] Accounts API server running and accessible
- [ ] CORS configured on both APIs
- [ ] Frontend environment variables or localStorage set
- [ ] Test `/health` endpoints
- [ ] Verify cross-origin requests work
- [ ] Test all account data endpoints
- [ ] Monitor logs for errors
