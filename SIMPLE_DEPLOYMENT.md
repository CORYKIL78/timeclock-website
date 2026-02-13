# Deploy Accounts API - Simple Guide

Choose your hosting and follow the steps. All take 5-10 minutes.

---

## 1️⃣ Local Development

```bash
cd accounts-api
npm install
cp .env.example .env
# Edit .env and add MONGODB_URI
npm start
```

Add to HTML:
```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:3000');
</script>
```

---

## 2️⃣ Render (Free, Easiest)

1. Push to GitHub
2. Go to https://render.com
3. Click "Create" → "Web Service"
4. Connect your repo
5. Fill in:
   - **Name:** cirkle-accounts-api
   - **Root Directory:** accounts-api
   - **Build Command:** npm install
   - **Start Command:** npm start
6. Add env var: `MONGODB_URI` = your MongoDB connection string
7. Click "Create Web Service"

**Done!** Your API is at: `https://cirkle-accounts-api.onrender.com`

Add to HTML:
```html
<script>
  localStorage.setItem('ACCOUNTS_API_URL', 'https://cirkle-accounts-api.onrender.com');
</script>
```

---

## 3️⃣ Railway (Easy)

1. Push to GitHub
2. Go to https://railway.app
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Add Service variable: `MONGODB_URI` = your connection string
6. Deploy

**Done!** Your API is at: `https://your-project-name.railway.app`

---

## 4️⃣ Heroku

```bash
heroku login
heroku create cirkle-accounts-api
cd accounts-api
heroku config:set MONGODB_URI="your-connection-string"
git push heroku main
```

**Done!** Your API is at: `https://cirkle-accounts-api.herokuapp.com`

---

## 5️⃣ Docker (Any Host)

```bash
cd accounts-api
docker build -t accounts-api .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/timeclock" \
  accounts-api
```

---

## 6️⃣ VPS (DigitalOcean, Linode, AWS)

```bash
# SSH into your server
ssh user@your-server.com

# Install Node
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/your-repo.git
cd your-repo/accounts-api
npm install

# Create .env
cp .env.example .env
# Edit .env with MONGODB_URI

# Install PM2 (keeps it running)
npm install -g pm2
pm2 start server.js --name accounts-api
pm2 startup
pm2 save

# Access via: http://your-server-ip:3000
```

---

## Get MongoDB (Free)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create account (free)
3. Create cluster (free tier M0)
4. Get connection string
5. Add to `.env` as `MONGODB_URI`

---

## Test It Works

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","database":"connected"}
```

Or in browser:
```javascript
checkAccountsAPIHealth()
// Should print: {status: 'ok', database: 'connected'}
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to MongoDB" | Check MONGODB_URI in .env, verify connection string |
| "Port 3000 already in use" | Use PORT=3001 npm start |
| "API not responding" | Check console output for errors |
| "CORS error" | Check browser console, frontend might have wrong URL |

---

## That's It!

Pick one option above, follow the steps, and you're done.

Any questions? Check the console output for error messages.
