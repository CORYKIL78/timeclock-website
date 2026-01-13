# Absence Approval Fix Summary

## Issues Fixed

### 1. Missing `/api/admin/absences` Endpoint ✅
**Problem:** The admin portal was calling `/api/admin/absences` to fetch all absences, but this endpoint didn't exist in the backend.

**Solution:** Created new endpoint that:
- Fetches all absence records from Google Sheets (rows A2:J1000)
- Formats data for the admin portal
- Filters out empty rows and header rows
- Returns array of absences with rowIndex, name, dates, approval status, etc.

**Code:** [worker.js](worker.js#L890-L912)

### 2. Discord ID Being Overwritten During Approval ❌ → ✅
**Problem:** When approving/rejecting an absence, the Discord ID in column H was being overwritten with "Admin Portal"

**Root Cause:** The update code was updating columns G-J as a range:
```javascript
// OLD CODE (BROKEN)
await updateSheets(env, `cirklehrAbsences!G${rowIndex}:J${rowIndex}`, [[
  status === 'Approved' ? 'Approved' : 'Rejected',  // Column G
  'Admin Portal',                                    // Column H ← OVERWRITES DISCORD ID!
  new Date().toISOString(),                         // Column I
  '✅ Success'                                       // Column J
]]);
```

This mapped the four array elements to columns G, H, I, J respectively, inadvertently overwriting the Discord ID in column H.

**Solution:** Split the update into two separate calls to skip column H:
```javascript
// NEW CODE (FIXED)
// Update only column G (approval status)
await updateSheets(env, `cirklehrAbsences!G${rowIndex}:G${rowIndex}`, [[
  status === 'Approved' ? 'Approved' : 'Rejected'
]]);

// Update columns I:J (timestamp and success status), skipping column H
await updateSheets(env, `cirklehrAbsences!I${rowIndex}:J${rowIndex}`, [[
  new Date().toISOString(),
  '✅ Success'
]]);
```

**Code:** [worker.js](worker.js#L958-L969)

## Google Sheets Structure

The cirklehrAbsences sheet uses these columns (A-J):
- **A:** Name
- **B:** Start Date
- **C:** End Date
- **D:** Reason/Type
- **E:** Total Days
- **F:** Comment
- **G:** Approval Status (Pending/Approved/Rejected)
- **H:** Discord ID ← **PRESERVED NOW** ✅
- **I:** Timestamp
- **J:** Success Flag (Submit/✅ Success)

## Testing Results

### Complete Approval Flow
1. **Submit absence** → Discord ID stored correctly ✅
2. **Admin approves via `/api/admin/absence/update-status`** → Status updated to "Approved", Discord ID preserved ✅
3. **Discord DM sent** → Bot can now use valid Discord ID to send messages ✅
4. **Portal updates** → Shows absence as approved with correct timestamp ✅

### Test Case
```bash
# Submit absence with Discord ID
POST /api/absence
{
  "name": "Final Test",
  "startDate": "2026-03-01",
  "endDate": "2026-03-03",
  "reason": "Final Testing",
  "discordId": "1088907566844739624"
}

# Admin approves it
POST /api/admin/absence/update-status
{"rowIndex": 14, "status": "Approved"}

# Result: Discord ID preserved
{
  "approvalStatus": "Approved",
  "discordId": "1088907566844739624",  ✅ CORRECT
  "status": "✅ Success"
}
```

## Deployment

- **Version:** 0943262d-9f9f-4aaf-bd32-3e47e1062e30
- **Endpoint:** https://timeclock-backend.marcusray.workers.dev
- **Deployed:** January 13, 2026

## Impact

This fix ensures:
1. All absences maintain accurate Discord IDs throughout approval process
2. Discord notifications can be sent successfully to users
3. Admin portal can fetch and display all absences correctly
4. Approval workflow functions end-to-end without data corruption

## User-Facing Changes

From the user's perspective:
- Admin portal now displays all absences in a table
- Approval/rejection buttons work correctly
- Users receive Discord DM notifications when absences are approved/rejected
- Absence status updates appear in staff portal within 5 seconds
