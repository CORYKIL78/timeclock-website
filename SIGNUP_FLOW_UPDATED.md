# Updated OAuth Signup Flow Documentation

## Overview
Users now automatically sign themselves up via Discord OAuth. No admin pre-creation needed.

## Signup Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Sign in with Discord" on portal.cirkledevelopment.co.uk
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Redirected to Discord OAuth page
│    (Discord auth - user logs in if not already)
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Discord redirects back with OAuth code to:
│    https://portal.cirkledevelopment.co.uk?code=<code>
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Frontend script.js calls:
│    GET /auth?code=<code>&redirect_uri=...
│    
│    Worker exchanges code for Discord user info:
│    - id (Discord ID)
│    - username
│    - global_name
│    - avatar
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Worker automatically creates new user in KV:
│    
│    Key: profile:{discordId}
│    Value: {
│      id, name, email, department, discordTag, 
│      discordId, avatar, createdAt
│    }
│    
│    Key: user:{discordId}
│    Value: {
│      id, profile, absences: [], payslips: [], 
│      disciplinaries: [], reports: [], requests: []
│    }
│    
│    (Only if user doesn't already exist)
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Frontend calls:
│    POST /api/user/profile
│    Body: { discordId: "<discordId>" }
│    
│    Returns: user profile data from KV
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Frontend saves currentUser to localStorage and loads portal
│    
│    User can now:
│    - View their profile
│    - Create absences, payslips, disciplinaries, etc.
│    - All data syncs from any device (same KV key = same data)
└─────────────────────────────────────────────────────────────────┘
```

## Key Changes from Previous Flow

### Before (Google Sheets)
- Admin pre-created users in Google Sheets
- Frontend called `/member/{userId}` to fetch data from Sheets
- Data was fragmented and slow

### After (Discord OAuth + KV)
- Users self-register via Discord OAuth
- Worker automatically creates KV entries on first OAuth login
- Frontend calls `/api/user/profile` (POST) to fetch from KV
- Data is centralized, fast, and auto-syncs across devices

## API Endpoints

### Auth Endpoint
```
GET /auth?code=<code>&redirect_uri=<redirect>

Response: {
  id: "Discord ID",
  username: "discord username",
  discriminator: "0",
  avatar: "avatar hash",
  global_name: "Discord Display Name"
}

Side effect: Creates user in KV if doesn't exist
```

### Fetch User Profile
```
POST /api/user/profile

Body: {
  discordId: "123456789"
}

Response: {
  id: "123456789",
  name: "User Name",
  email: "user@email.com",
  department: "Department",
  discordTag: "username",
  discordId: "123456789",
  avatar: "hash",
  createdAt: "2026-02-13T20:21:00Z"
}

Status 404: User profile not found
```

### Fetch Full Account (All Data)
```
GET /api/accounts/{discordId}

Response: {
  id: "123456789",
  profile: { ...profile data... },
  absences: [ ...array of absences... ],
  payslips: [ ...array of payslips... ],
  disciplinaries: [ ...array of disciplinaries... ],
  reports: [ ...array of reports... ],
  requests: [ ...array of requests... ]
}
```

## Testing the Flow

### Manual Test
```bash
# 1. User is created during OAuth (automatic)
# 2. Fetch their profile
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/user/profile \
  -H 'Content-Type: application/json' \
  -d '{"discordId": "123456789"}'

# 3. Fetch full account
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/123456789

# 4. Create absence
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/absence/create \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "123456789",
    "startDate": "2026-02-14",
    "reason": "Sick leave"
  }'

# 5. Verify absence appears in account
curl https://timeclock-backend.marcusray.workers.dev/api/accounts/123456789
```

## Multi-Device Data Sync

All data is keyed by Discord ID in KV:
- Desktop login: Fetches data from `profile:{discordId}`, `absences:{discordId}`, etc.
- Mobile login: Fetches data from **same** KV keys
- Tablet login: Fetches data from **same** KV keys

**Result**: Same Discord ID automatically sees all their data across all devices.

## Admin Pre-Creation (Optional)

If you need to pre-create users before they sign up themselves:

```bash
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/admin/user/create \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "123456789",
    "profile": {
      "id": "123456789",
      "name": "John Doe",
      "email": "john@company.com",
      "department": "Engineering",
      "discordTag": "johndoe",
      "discordId": "123456789"
    }
  }'
```

This is only needed if you want to pre-populate user data before they sign up.

## Data Structure in KV

Per user (`discordId` = their Discord ID):

```
Key: profile:{discordId}
Value: User profile object (name, email, department, etc.)

Key: user:{discordId}
Value: Full account object (contains all arrays below)

Key: absences:{discordId}
Value: Array of absence objects

Key: payslips:{discordId}
Value: Array of payslip objects

Key: disciplinaries:{discordId}
Value: Array of disciplinary objects (strikes, warnings)

Key: reports:{discordId}
Value: Array of report objects

Key: requests:{discordId}
Value: Array of request objects
```

## Manual User Data Cleanup

If you need to delete a user's data:

Via Cloudflare dashboard:
1. Go to https://dash.cloudflare.com/
2. Select your account
3. Workers > KV
4. Select `timeclock-data` namespace
5. Search for keys starting with `{discordId}:`
6. Delete the keys

Or delete all data at once:
```bash
# Download Wrangler CLI and authenticate
wrangler kv:key delete-bulk --binding=DATA -- profile:{discordId} user:{discordId} absences:{discordId} ...
```

## Troubleshooting

### User can't log in
- Check Discord OAuth is configured correctly (Client ID in worker.js)
- Verify user has Discord account
- Check browser console for errors

### User data not syncing across devices
- Verify same Discord ID is used
- Check KV namespace binding is correct
- Verify both devices are accessing `timeclock-backend.marcusray.workers.dev`

### Profile shows "Not set" fields
- Admin can update via `/api/admin/user/create` (will overwrite)
- Or user edits in portal (if edit functionality is implemented)

## Summary

✅ Users sign themselves up via Discord OAuth
✅ No admin pre-creation required
✅ Data auto-syncs across all devices
✅ All data stored in Cloudflare KV (serverless, secure)
✅ Fast, reliable, production-ready
