# Absence Flow Testing Results

## ✅ Tests Passed

### 1. Backend Health Check
```
GET /api/status
Response: {"status":"ok","timestamp":"2026-01-13T19:18:51.439Z"}
Status: ✅ PASS
```

### 2. Submit Absence Request
```
POST /api/absence
Request: {name, startDate, endDate, reason, comment, discordId}
Response: {"success":true}
Status: ✅ PASS
```

### 3. Admin Approve Absence
```
POST /api/admin/absence/update-status
Request: {rowIndex, status}
Response: {"success":true,"message":"Absence approved"}
Status: ✅ PASS
```

### 4. Pending Absence Check (Before Approval)
```
POST /api/absence/check-approved
Response: {"hasNewStatuses":false,"processedAbsences":[]}
Status: ✅ PASS (correct - nothing approved yet)
```

---

## ⚠️ Known Issue

### 5. Check Approved Absences After Admin Update
**Status:** ⏱️ TIMEOUT (>30 seconds)

**Issue:** The `/api/absence/check-approved` endpoint is querying `cirklehrAbsences!A:J` (entire columns) which:
- Fetches potentially thousands of rows
- Requires Google Sheets API authentication
- Takes too long for Cloudflare's 30-second timeout

**Root Cause:** 
The query is too broad. We're fetching ALL data every time instead of just checking specific rows.

---

## 🔧 Solution

Optimize the query to fetch only the data we need:

### Option 1: Paginate/Limit Rows
Instead of `cirklehrAbsences!A:J`, use `cirklehrAbsences!A1:J1000`

### Option 2: Cache Tokens
Implement token caching to avoid re-generating JWT every call

### Option 3: Use a Different Approach
Since this is called from frontend polling (every 5 seconds), consider:
- Using a lightweight index file instead of full Sheets query
- Implementing server-side caching layer
- Using Cloudflare D1 database as cache

---

## Frontend vs Backend Testing

### What We CAN'T Test via API Alone:
- Discord DMs (requires bot auth + actual user IDs)
- Notifications in portal UI
- Page refreshes and localStorage
- Browser notifications/sounds
- User experience flow

### How to Manually Test:
1. **Open staff portal** → Log in
2. **Submit absence** through UI → Check browser console for POST success
3. **Open admin portal** → Find the absence and click Approve
4. **Wait 5 seconds** → Check if staff user gets Discord DM
5. **Refresh portal** → Verify absence shows as "Approved"
6. **Wait 10 seconds** → Verify notification doesn't repeat

---

## Summary

The **end-to-end flow is architecturally correct**, but the `/api/absence/check-approved` endpoint needs optimization for performance.

**Recommended Quick Fix:**
Change line 365 in worker.js from:
```javascript
const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
```

To:
```javascript
const data = await getSheetsData(env, 'cirklehrAbsences!A2:J1000');
```

This limits the query to rows 2-1000 instead of all rows, which should resolve the timeout.

