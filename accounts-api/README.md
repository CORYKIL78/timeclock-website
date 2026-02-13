# Accounts API - Simple Setup

Standalone API server for retrieving employee account information.

## Quick Start (5 minutes)

### 1. Install
```bash
cd accounts-api
npm install
```

### 2. Configure
```bash
cp .env.example .env
```

Edit `.env` and add your MongoDB connection string:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/timeclock
```

**Don't have MongoDB?** Get free tier: https://www.mongodb.com/cloud/atlas

### 3. Run
```bash
npm start
```

You should see:
```
✅ Accounts API running on http://localhost:3000

📝 Add to your frontend:
   localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
```

### 4. Test
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","database":"connected"}
```

**Done!** Your API is running.

---

## API Endpoints

All endpoints are GET requests:

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Check if API is running |
| `GET /api/accounts/{userId}` | Get complete account info (profile + all data) |
| `GET /api/user/profile/{userId}` | Get just profile |
| `GET /api/user/absences/{userId}` | Get absences only |
| `GET /api/user/payslips/{userId}` | Get payslips only |
| `GET /api/user/disciplinaries/{userId}` | Get disciplinaries only |
| `GET /api/user/requests/{userId}` | Get requests only |
| `GET /api/user/reports/{userId}` | Get reports only |

**Example:**
```bash
curl http://localhost:3000/api/accounts/123456789
```

Response:
```json
{
  "success": true,
  "account": {
    "userId": "123456789",
    "profile": { ... },
    "absences": [ ... ],
    "payslips": [ ... ],
    "disciplinaries": [ ... ],
    "requests": [ ... ],
    "reports": [ ... ],
    "summary": { ... }
  }
}
```

---

## Frontend Integration

In your HTML, add this before `script.js` loads:
```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
</script>
```

Or in JavaScript:
```javascript
setAPIURLs(null, 'http://localhost:3000');
```

Then use in your code:
```javascript
// Get complete account info
const account = await fetchAccountInfo(userId);
console.log(account.profile);
console.log(account.absences);

// Or get individual sections
const absences = await fetchAccountAbsences(userId);
const payslips = await fetchAccountPayslips(userId);
```

---

## Deployment (Choose One)

### Option 1: Render (Free, Easiest)

1. Push your code to GitHub
2. Go to https://render.com → Create Web Service
3. Connect your GitHub repository
4. Set root directory: `accounts-api`
5. Add environment variable: `MONGODB_URI`
6. Deploy

**Your URL:** `https://your-app.onrender.com`

### Option 2: Railway

1. Go to https://railway.app → New Project
2. Connect GitHub
3. Add environment variable: `MONGODB_URI`
4. Deploy

### Option 3: Docker (Any Host)

```bash
cd accounts-api
docker build -t accounts-api .
docker run -p 3000:3000 -e MONGODB_URI=your_string accounts-api
```

### Option 4: Self-Hosted VPS

```bash
# SSH into your server
ssh user@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone & setup
git clone https://github.com/your-repo.git
cd your-repo/accounts-api
npm install

# Start with PM2
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

---

## MongoDB Setup

### Using MongoDB Atlas (Free Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create account (free)
3. Create cluster (M0 free tier)
4. Get connection string
5. Copy into `.env` as `MONGODB_URI`

### Using Local MongoDB

```bash
# Install (macOS)
brew tap mongodb/brew
brew install mongodb-community

# Install (Ubuntu)
sudo apt-get install -y mongodb

# Start
mongod

# Connection string
MONGODB_URI=mongodb://localhost:27017/timeclock
```

---

## Troubleshooting

### "Cannot connect to MongoDB"
- Check `MONGODB_URI` is correct
- Verify MongoDB is running
- If using MongoDB Atlas, check IP whitelist (should include your server's IP)

### "Port 3000 already in use"
- Use different port: `PORT=3001 npm start`
- Or kill existing process: `lsof -ti:3000 | xargs kill -9`

### "API not responding"
- Check console output for errors
- Test: `curl http://localhost:3000/health`
- Check firewall if deployed

---

## Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `MONGODB_URI` | Yes | - | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `PORT` | No | `3000` | `3000` |
| `DB_NAME` | No | `timeclock` | `timeclock` |

---

## Development

### Run with auto-reload
```bash
npm run dev
```

### Check logs
```bash
tail -f logs/app.log  # if using log file
# or just watch console output
```

### Debug mode
```bash
DEBUG=* npm start
```

---

## Production Checklist

- [ ] MongoDB URI configured
- [ ] Tested endpoints locally
- [ ] Deployed to hosting service
- [ ] Frontend API URL updated
- [ ] CORS working (check browser console)
- [ ] Database has all required collections
- [ ] Monitoring/logs enabled on hosting service
- [ ] SSL certificate configured (if domain)

---

## That's It!

Questions? Check the logs:
```bash
npm start
# Watch the output for errors
```

Need help? Add more details to an issue on GitHub.

