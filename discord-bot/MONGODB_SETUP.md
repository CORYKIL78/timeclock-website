# MongoDB Atlas Setup Guide

## Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up (free - no credit card required)
3. Create organization & project

## Step 2: Create Free Cluster

1. Click **"Build a Database"**
2. Choose **"M0 - Free"** tier
3. Select closest **Cloud Provider & Region**
4. Cluster name: `discord-bot` (or any name)
5. Click **"Create"**

## Step 3: Create Database User

1. In **"Security"** tab → **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Username: `botuser` (or your choice)
5. Password: **Generate secure password** (save it!)
6. User Privileges: **Read and write to any database**
7. Click **"Add User"**

## Step 4: Whitelist IP Address

1. In **"Security"** tab → **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This is safe because your connection still requires username/password
4. Click **"Confirm"**

## Step 5: Get Connection String

1. Go back to **"Database"** tab
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **"Node.js"** and version **6.0 or later**
5. Copy the connection string (looks like):
   ```
   mongodb+srv://botuser:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Replace `<password>` with your actual password**
7. Add database name before the `?`:
   ```
   mongodb+srv://botuser:YOUR_PASSWORD@cluster.mongodb.net/discord_bot?retryWrites=true&w=majority
   ```

## Step 6: Add to Render

1. Go to Render dashboard → Your bot service
2. Click **"Environment"**
3. Add new variable:
   - Key: `MONGODB_URI`
   - Value: Your connection string (with password filled in)
4. Click **"Save Changes"**
5. Bot will auto-redeploy

## Step 7: Verify

Check Render logs - you should see:
```
✅ Connected to MongoDB
[DEV-TOOLBOX] Loaded X quotes from MongoDB
```

## Done! 🎉

Your quotes are now stored in MongoDB and will persist forever!

## Test It

1. Create a quote in Discord
2. Restart your bot (Manual Deploy in Render)
3. Check quotes - they should still be there!

## Free Tier Limits

- **512 MB Storage** (millions of quotes)
- **100 connections**
- **Unlimited** reads/writes
- **Never expires** ✅
