# ✅ Fresh Start - User Setup Guide

**Status**: Backend ready for new users  
**Storage**: Cloudflare KV (all data synced across devices)  
**Authentication**: Discord accounts (multi-device support)  
**Date**: February 13, 2026  

---

## 🎯 Multi-Device Sync Verified ✅

Users can log in from any device (phone, desktop, tablet) with their Discord account and access **all their data immediately**.

**Test Results**:
```
Device 1 (Phone): Creates user + absence + strike
Device 2 (Desktop): Same Discord ID → All data available instantly
✅ Absences: 1 (synced)
✅ Disciplinaries: 1 (synced)  
✅ Payslips: 0 (ready to add)
✅ Multi-platform: WORKING
```

---

## 📋 How to Add Users

### Option 1: Manual API Call

```bash
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/admin/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "DISCORD_USER_ID",
    "profile": {
      "name": "John Doe",
      "email": "john@example.com",
      "role": "Engineer",
      "department": "Engineering"
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "userId": "DISCORD_USER_ID"
}
```

### Option 2: Bulk Upload (Recommended)

Create a JSON file with all your users:

```json
[
  {
    "userId": "123456789",
    "profile": {
      "name": "Alice Johnson",
      "email": "alice@cirkle.com",
      "role": "Manager",
      "department": "HR"
    }
  },
  {
    "userId": "987654321",
    "profile": {
      "name": "Bob Smith", 
      "email": "bob@cirkle.com",
      "role": "Engineer",
      "department": "Engineering"
    }
  }
]
```

Save as `users.json`, then upload:

```bash
# Create a simple script to bulk import
node << 'SCRIPT'
const users = require('./users.json');

async function uploadUsers() {
  for (const user of users) {
    const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/admin/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const data = await response.json();
    console.log(`✓ ${user.profile.name}: ${data.success ? 'Created' : 'Error'}`);
  }
}

uploadUsers().catch(console.error);
SCRIPT
```

---

## 🔍 Verify Users Are Saved

### Check if user exists:
```bash
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/DISCORD_USER_ID | jq .
```

### Get just profile:
```bash
curl https://timeclock-backend.marcusray.workers.dev/api/user/profile/DISCORD_USER_ID | jq .
```

---

## 👥 Required Fields for Users

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | String | ✅ Yes | Discord User ID (unique identifier) |
| `profile.name` | String | ✅ Yes | User's display name |
| `profile.email` | String | ✅ Yes | Email address |
| `profile.role` | String | ✅ Yes | Job role (Manager, Engineer, etc.) |
| `profile.department` | String | ✅ Yes | Department (HR, Engineering, etc.) |
| `profile.country` | String | ❌ Optional | Country code |
| `profile.timezone` | String | ❌ Optional | Timezone (e.g., "UTC", "EST") |
| `profile.discordId` | String | ❌ Optional | Same as `userId` (for reference) |

---

## 📊 Data Stored Per User (Automatic)

Once a user is created, these data types can be added:

| Data Type | Created Via | Storage Location |
|-----------|------------|------------------|
| Profile | `/api/admin/user/create` | `profile:{userId}` |
| Absences | `/api/absence/create` | `absences:{userId}` |
| Payslips | Manual data entry | `payslips:{userId}` |
| Disciplinaries | `/api/disciplinaries/create` | `disciplinaries:{userId}` |
| Reports | Manual data entry | `reports:{userId}` |
| Requests | Manual data entry | `requests:{userId}` |

**All data syncs automatically to all devices via Discord ID.**

---

## 🚀 Getting Started

### Step 1: Gather Your User List
Create a list of all employees with:
- Discord User ID (find in Discord: User Settings → Advanced → Copy User ID)
- Name
- Email  
- Role
- Department

### Step 2: Upload Users
Use curl commands or the bulk script above to add them.

### Step 3: Verify
Run `/api/status` to check the health endpoint.

### Step 4: Access Portal
Users can now log in at `https://portal.cirkledevelopment.co.uk` with Discord OAuth.

---

## ✨ Features Included

✅ **User Profiles** - Name, email, role, department  
✅ **Absences** - Request & track time off  
✅ **Disciplinaries** - Track strikes/warnings  
✅ **Payslips** - View salary information  
✅ **Reports** - Generate & view reports  
✅ **Multi-Device** - One Discord ID, all devices sync  
✅ **Discord Notifications** - DM alerts via Discord bot  
✅ **Email Notifications** - Via Resend API  

---

## 🔧 No MongoDB Needed

✅ All data in **Cloudflare KV** (no external database)  
✅ **Instant** data access  
✅ **Automatic** backups by Cloudflare  
✅ **Scalable** to thousands of users  
✅ **Free tier** includes 1GB storage (plenty for 1000+ users)

---

## 📞 Next Steps

1. **Collect Discord User IDs** from your team members
2. **Create users.json** with the user list
3. **Run bulk upload script** to add all users
4. **Test the portal** - Users can log in instantly
5. **Configure Discord bot** (optional) for notifications

---

**Ready to go! Fresh database, clean start, multi-device support!** 🚀

---

## Example: Adding Your First 3 Users

```bash
# User 1
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/admin/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "111111111",
    "profile": {"name": "Emma Wilson", "email": "emma@cirkle.com", "role": "CEO", "department": "Management"}
  }'

# User 2
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/admin/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "222222222",
    "profile": {"name": "David Brown", "email": "david@cirkle.com", "role": "CTO", "department": "Engineering"}
  }'

# User 3
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/admin/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "333333333",
    "profile": {"name": "Sarah Lee", "email": "sarah@cirkle.com", "role": "HR Manager", "department": "HR"}
  }'

# Verify all 3 exist
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/111111111 | jq .profile.name
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/222222222 | jq .profile.name
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/333333333 | jq .profile.name
```

All users can now log in with Discord and access their data from any device! ✅
