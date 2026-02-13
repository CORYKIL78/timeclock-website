# Google Sheets Removal Progress

## Summary
Google Sheets integration has been partially removed from the backend. The helper functions have been eliminated, and a new comprehensive **Accounts API** has been created to provide account data aggregation.

## ✅ Completed

### 1. Removed Google Sheets Helper Functions
- ❌ `getAccessToken()` - JWT token generation for Google Sheets API
- ❌ `getSheetsData()` - Fetch data from Google Sheets  
- ❌ `updateSheets()` - Update Google Sheets cells
- ❌ `appendToSheet()` - Append rows to Google Sheets
- ❌ `deleteRow()` - Delete rows from Google Sheets
- ❌ `getSheetId()` - Get sheet ID by name
- ❌ `str2ab()` - Helper function for JWT encoding
- ❌ `getCachedSheetsData()` - Caching wrapper
- ❌ `sheetsCache` - In-memory cache

### 2. Removed Google Sheets Workflow Helpers
- ❌ `processReportSubmit()`
- ❌ `processRequestApprove()`
- ❌ `processRequestReject()`
- ❌ `processAbsenceApprove()`
- ❌ `processAbsenceReject()`

### 3. Disabled Scheduled Handler
- The `scheduled()` handler has been disabled since it depends entirely on Google Sheets polling

### 4. Created Comprehensive Accounts API
New endpoint: **`GET /api/accounts/{userId}`**

Returns complete account information including:
- **profile** - Account details (name, email, department, role, etc.)
- **absences** - All absence records
- **payslips** - All payslip records
- **disciplinaries** - All disciplinary records
- **requests** - All requests
- **reports** - All reports
- **summary** - Quick statistics

**Example Response:**
```json
{
  "success": true,
  "account": {
    "userId": "123456789",
    "profile": {
      "name": "John Doe",
      "email": "john@example.com",
      "department": "Engineering",
      "role": "Full Stack Developer"
    },
    "absences": [...],
    "payslips": [...],
    "disciplinaries": [...],
    "requests": [...],
    "reports": [...],
    "summary": {
      "totalAbsences": 3,
      "approvedAbsences": 2,
      "totalDisciplinaries": 0,
      "totalPayslips": 12
    }
  }
}
```

## ⚠️ TODO: Remaining Endpoints Using Google Sheets

There are **77 remaining references** to Google Sheets functions across the following endpoints. These need to be migrated to use a database (MongoDB recommended based on your package.json):

### Endpoints Still Using Google Sheets (77 references)

#### Debug Endpoints:
- `GET /api/debug/absences`
- `GET /api/debug/sheets`

#### Member/Profile Endpoints:
- `GET /member/:userId`
- `GET /members/:guildId`
- `POST /api/user/profile`
- `POST /api/user/upsert`
- `POST /api/employees/hire`

#### Data Fetch Endpoints:
- `GET /api/user/absences/:userId`
- `POST /api/payslips/fetch`
- `POST /api/disciplinaries/fetch`
- `GET /api/reports/fetch`
- `POST /api/requests/fetch`

#### Create/Submit Endpoints:
- `POST /api/absence/submit`
- `POST /api/absence`
- `POST /api/reports/create`
- `POST /api/requests/submit`
- `POST /api/disciplinaries/create`

#### Admin/Workflow Endpoints:
- `GET /api/admin/absences`
- `POST /api/admin/absence/update-status`
- `POST /api/absence/approve`
- `POST /api/absence/cancel`
- `POST /api/absence/ongoing`
- `POST /api/absence/extend/:id`
- `POST /api/absence/void/:id`
- `POST /api/requests/approve`
- `POST /api/requests/check-pending`
- `GET /api/reports/check-pending`
- `GET /api/payslips/check-pending`
- `POST /api/disciplinaries/check-pending`
- `POST /api/attendance/log`
- `POST /api/reports/workflow/submit-approval`
- `POST /api/requests/workflow/approve`
- `POST /api/requests/workflow/reject`
- `POST /api/absences/workflow/approve`
- `POST /api/absences/workflow/reject`
- `POST /api/users/workflow/reset`

## Recommended Migration Path

### Phase 1: Database Schema
Create MongoDB collections for:
```javascript
db.users.insertOne({
  _id: "discord_id",
  name: String,
  email: String,
  department: String,
  role: String,
  dateOfSignup: Date,
  suspended: Boolean,
  // ... other fields
})

db.absences.insertOne({
  userId: String,
  startDate: Date,
  endDate: Date,
  reason: String,
  status: String,
  // ... other fields
})

db.payslips.insertOne({
  userId: String,
  period: String,
  link: String,
  status: String,
  // ... other fields
})

// Similar schemas for disciplinaries, requests, reports
```

### Phase 2: Update Endpoints
Replace Google Sheets calls with MongoDB queries:
```javascript
// Before (Google Sheets)
const data = await getCachedSheetsData(env, 'cirklehrUsers!A1:Z1000');

// After (MongoDB)
const data = await db.users.find({}).toArray();
```

### Phase 3: Data Migration
Migrate existing Google Sheets data to MongoDB before fully removing Sheets support.

## Discord DM Service
The `sendDM()` function has been **KEPT** since it's a critical feature for notifications and doesn't depend on Google Sheets.

## Next Steps

1. Set up MongoDB collections matching the Sheets structure
2. Update endpoints one-by-one to use MongoDB instead of Sheets
3. Test each endpoint thoroughly
4. Run data migration from Sheets to MongoDB
5. Remove all remaining Google Sheets configuration from environment variables
6. Delete `wrangler.toml` and `cloudflare-worker.js` if they're legacy files
7. Update `script.js` frontend to use the new Accounts API where appropriate

## Files Modified
- `/workspaces/timeclock-website/worker.js` - Removed Google Sheets integration, added Accounts API
