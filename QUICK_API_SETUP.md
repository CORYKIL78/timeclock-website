# Frontend API Configuration - Simple

## The Easy Way (2 Steps)

### Step 1: Run Accounts API
```bash
cd accounts-api
npm install
npm start
```

You'll see:
```
✅ Accounts API running on http://localhost:3000

📝 Add to your frontend:
   localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
```

### Step 2: Tell Frontend Where API Is
Add this to your HTML (before `script.js` loads):
```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
</script>
```

**That's it!** Your API is configured.

---

## Using Deployed API

If your API is running on a server (not localhost):

```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'https://your-api-domain.com');
</script>
```

Examples:
- Render: `https://your-app.onrender.com`
- Railway: `https://your-app.railway.app`
- Self-hosted: `https://api.yourdomain.com`

---

## Testing in Console

Open DevTools (F12) and paste:
```javascript
checkAccountsAPIHealth()
```

You should see:
```json
{status: 'ok', database: 'connected'}
```

---

## That's All You Need!

The frontend automatically finds the API at the URL you configure. No complex setup needed.

If something breaks, check DevTools Console (F12) for error messages.
