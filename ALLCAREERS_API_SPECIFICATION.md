# AllCareers Employer Dashboard API Specification

## Overview
Complete API for AllCareers employer dashboard integration with timeclock-website data.

The API syncs:
- Staff database profiles (from Google Sheets + Discord)
- Payslips, Disciplinaries, Reports, Requests, Absences
- User suspension/dismissal status
- Role management

---

## Base Endpoint
```
https://timeclock-backend.marcusray.workers.dev/api
```

All endpoints use **POST** method for security (prevents parameter leaking in URLs).

---

## Authentication

All requests must include:
```json
{
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_ADMIN_TOKEN"  // Optional - can implement token validation
  }
}
```

---

## 1. STAFF DATABASE ENDPOINTS

### 1.1 Get All Staff with Full Profiles
**Endpoint**: `POST /api/employers/staff/list`

**Request**:
```json
{
  "guildId": "YOUR_GUILD_ID",
  "includeDetails": true  // Include payslips, absences, etc.
}
```

**Response**:
```json
{
  "success": true,
  "staff": [
    {
      "userId": "123456789",
      "name": "John Doe",
      "discordTag": "johndoe#1234",
      "avatar": "https://cdn.discordapp.com/avatars/...",
      "profile": {
        "email": "john@example.com",
        "department": "Engineering",
        "staffId": "ENG001",
        "timezone": "UTC",
        "country": "UK",
        "baseLevel": "Senior",
        "status": "Active"
      },
      "roles": ["@Staff", "@Managers"],
      "stats": {
        "payslips": 12,
        "disciplinaries": 1,
        "reports": 5,
        "absences": 3,
        "approvedAbsences": 2,
        "rejectedAbsences": 1
      },
      "suspended": false,
      "dismissalDate": null,
      "lastLogin": "2026-01-11T10:30:00Z"
    }
  ],
  "count": 45
}
```

---

### 1.2 Get Single Staff Member Profile
**Endpoint**: `POST /api/employers/staff/{userId}`

**Request**:
```json
{
  "userId": "123456789",
  "includeHistory": true
}
```

**Response**:
```json
{
  "success": true,
  "staff": {
    "userId": "123456789",
    "name": "John Doe",
    "discordTag": "johndoe#1234",
    "avatar": "https://...",
    "profile": {
      "email": "john@example.com",
      "department": "Engineering",
      "staffId": "ENG001",
      "timezone": "UTC",
      "country": "UK",
      "baseLevel": "Senior",
      "status": "Active"
    },
    "roles": ["@Staff", "@Managers"],
    "suspended": false,
    "suspensionReason": null,
    "suspensionDate": null,
    "dismissed": false,
    "dismissalDate": null,
    "dismissalReason": null,
    
    // Historical Data
    "payslips": [
      {
        "id": "PAYSLIP_001",
        "period": "2025-12",
        "amount": 3500.00,
        "currency": "GBP",
        "issuedDate": "2025-12-01",
        "acknowledged": true,
        "acknowledgedDate": "2025-12-01"
      }
    ],
    "disciplinaries": [
      {
        "id": "DISC_001",
        "type": "Warning",
        "reason": "Late arrival",
        "issuedDate": "2025-11-15",
        "severity": "Low",
        "acknowledged": true
      }
    ],
    "reports": [
      {
        "id": "REPORT_001",
        "type": "Monthly Performance",
        "submittedBy": "Manager Name",
        "submittedDate": "2025-12-01",
        "comment": "Good progress this month",
        "status": "Completed"
      }
    ],
    "requests": [
      {
        "id": "REQ_001",
        "type": "Time Off",
        "requestDate": "2025-11-20",
        "status": "Approved",
        "approvedBy": "Manager Name",
        "approvalDate": "2025-11-21"
      }
    ],
    "absences": [
      {
        "id": "ABS_001",
        "type": "Vacation",
        "startDate": "2025-12-20",
        "endDate": "2025-12-27",
        "days": 7,
        "status": "Approved",
        "approvalDate": "2025-12-01"
      }
    ]
  }
}
```

---

## 2. PAYSLIPS ENDPOINTS

### 2.1 Get Staff Payslips
**Endpoint**: `POST /api/employers/payslips/list`

**Request**:
```json
{
  "userId": "123456789"  // Optional - omit for all staff
}
```

**Response**:
```json
{
  "success": true,
  "payslips": [
    {
      "id": "PAYSLIP_001",
      "userId": "123456789",
      "period": "2025-12",
      "amount": 3500.00,
      "currency": "GBP",
      "issuedDate": "2025-12-01",
      "acknowledged": true,
      "acknowledgedDate": "2025-12-01T10:00:00Z",
      "sheets_row": 5
    }
  ]
}
```

### 2.2 Add Payslip
**Endpoint**: `POST /api/employers/payslips/add`

**Request**:
```json
{
  "userId": "123456789",
  "period": "2025-12",
  "amount": 3500.00,
  "currency": "GBP"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payslip added and synced",
  "payslip": {
    "id": "PAYSLIP_001",
    "sheets_row": 5
  }
}
```

---

## 3. DISCIPLINARIES ENDPOINTS

### 3.1 Get Staff Disciplinaries
**Endpoint**: `POST /api/employers/disciplinaries/list`

**Request**:
```json
{
  "userId": "123456789",  // Optional
  "type": "Warning"        // Optional: "Warning", "Strike", "Suspension"
}
```

**Response**:
```json
{
  "success": true,
  "disciplinaries": [
    {
      "id": "DISC_001",
      "userId": "123456789",
      "type": "Warning",
      "reason": "Late arrival",
      "comment": "2 hours late without notice",
      "issuedDate": "2025-11-15",
      "severity": "Low",
      "acknowledged": false,
      "sheets_row": 8
    }
  ]
}
```

### 3.2 Issue Disciplinary
**Endpoint**: `POST /api/employers/disciplinaries/issue`

**Request**:
```json
{
  "userId": "123456789",
  "type": "Warning",
  "reason": "Late arrival",
  "comment": "2 hours late without notice",
  "severity": "Low",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Disciplinary issued and Discord DM sent",
  "disciplinary": {
    "id": "DISC_001",
    "sheets_row": 8
  }
}
```

---

## 4. REPORTS ENDPOINTS

### 4.1 Get Staff Reports
**Endpoint**: `POST /api/employers/reports/list`

**Request**:
```json
{
  "userId": "123456789",    // Optional
  "type": "Performance"      // Optional
}
```

**Response**:
```json
{
  "success": true,
  "reports": [
    {
      "id": "REPORT_001",
      "userId": "123456789",
      "type": "Performance",
      "submittedBy": "Manager Name",
      "submittedDate": "2025-12-01",
      "comment": "Good progress this month",
      "status": "Completed",
      "sheets_row": 12
    }
  ]
}
```

### 4.2 Submit Report
**Endpoint**: `POST /api/employers/reports/submit`

**Request**:
```json
{
  "userId": "123456789",
  "type": "Performance",
  "submittedBy": "Manager Name",
  "comment": "Good progress this month",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Report submitted and Discord DM sent",
  "report": {
    "id": "REPORT_001",
    "sheets_row": 12
  }
}
```

---

## 5. REQUESTS ENDPOINTS

### 5.1 Get Staff Requests
**Endpoint**: `POST /api/employers/requests/list`

**Request**:
```json
{
  "userId": "123456789",  // Optional
  "status": "Pending"     // Optional: "Pending", "Approved", "Rejected"
}
```

**Response**:
```json
{
  "success": true,
  "requests": [
    {
      "id": "REQ_001",
      "userId": "123456789",
      "type": "Time Off",
      "requestDate": "2025-11-20",
      "status": "Pending",
      "approverName": null,
      "approvalDate": null,
      "sheets_row": 15
    }
  ]
}
```

### 5.2 Approve Request
**Endpoint**: `POST /api/employers/requests/approve`

**Request**:
```json
{
  "requestId": "REQ_001",
  "userId": "123456789",
  "approverName": "Manager Name",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Request approved and Discord DM sent",
  "request": {
    "id": "REQ_001",
    "status": "Approved",
    "approvalDate": "2026-01-11T10:30:00Z"
  }
}
```

### 5.3 Reject Request
**Endpoint**: `POST /api/employers/requests/reject`

**Request**:
```json
{
  "requestId": "REQ_001",
  "userId": "123456789",
  "rejectorName": "Manager Name",
  "reason": "Business need requires your presence",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Request rejected and Discord DM sent",
  "request": {
    "id": "REQ_001",
    "status": "Rejected",
    "rejectionDate": "2026-01-11T10:30:00Z"
  }
}
```

---

## 6. ABSENCES ENDPOINTS

### 6.1 Get Staff Absences
**Endpoint**: `POST /api/employers/absences/list`

**Request**:
```json
{
  "userId": "123456789",  // Optional
  "status": "Approved"    // Optional: "Pending", "Approved", "Rejected"
}
```

**Response**:
```json
{
  "success": true,
  "absences": [
    {
      "id": "ABS_001",
      "userId": "123456789",
      "type": "Vacation",
      "startDate": "2025-12-20",
      "endDate": "2025-12-27",
      "days": 7,
      "reason": "Family visit",
      "status": "Approved",
      "approvalDate": "2025-12-01",
      "sheets_row": 20
    }
  ]
}
```

### 6.2 Approve Absence
**Endpoint**: `POST /api/employers/absences/approve`

**Request**:
```json
{
  "absenceId": "ABS_001",
  "userId": "123456789",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Absence approved and Discord DM sent",
  "absence": {
    "id": "ABS_001",
    "status": "Approved",
    "approvalDate": "2026-01-11T10:30:00Z"
  }
}
```

### 6.3 Reject Absence
**Endpoint**: `POST /api/employers/absences/reject`

**Request**:
```json
{
  "absenceId": "ABS_001",
  "userId": "123456789",
  "reason": "Insufficient notice",
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Absence rejected and Discord DM sent",
  "absence": {
    "id": "ABS_001",
    "status": "Rejected",
    "rejectionDate": "2026-01-11T10:30:00Z"
  }
}
```

---

## 7. SUSPENSION ENDPOINTS

### 7.1 Suspend User
**Endpoint**: `POST /api/employers/users/suspend`

**Request**:
```json
{
  "userId": "123456789",
  "reason": "Under investigation",
  "rolesRemove": ["@Staff", "@Voting"],  // Which roles to remove
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "User suspended, roles removed, Discord DM sent",
  "user": {
    "userId": "123456789",
    "suspended": true,
    "suspensionDate": "2026-01-11T10:30:00Z",
    "suspensionReason": "Under investigation",
    "portalAccess": "suspended",
    "rolesRemoved": ["@Staff", "@Voting"]
  }
}
```

### 7.2 Unsuspend User
**Endpoint**: `POST /api/employers/users/unsuspend`

**Request**:
```json
{
  "userId": "123456789",
  "rolesRestore": ["@Staff", "@Voting"],  // Restore these roles
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "User unsuspended, roles restored, Discord DM sent",
  "user": {
    "userId": "123456789",
    "suspended": false,
    "suspensionDate": null,
    "portalAccess": "active",
    "rolesRestored": ["@Staff", "@Voting"]
  }
}
```

---

## 8. DISMISSAL ENDPOINTS

### 8.1 Dismiss User (Complete Wipe)
**Endpoint**: `POST /api/employers/users/dismiss`

**Request**:
```json
{
  "userId": "123456789",
  "reason": "Voluntary resignation",
  "allDataWipe": true,  // Wipe from all sheets and portal
  "removeAllRoles": true,
  "sendNotification": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "User dismissed and completely wiped from system",
  "user": {
    "userId": "123456789",
    "dismissed": true,
    "dismissalDate": "2026-01-11T10:30:00Z",
    "dismissalReason": "Voluntary resignation",
    "wipedData": {
      "profile": true,
      "payslips": true,
      "disciplinaries": true,
      "reports": true,
      "requests": true,
      "absences": true,
      "rolesRemoved": ["@Staff", "@Voting", "@Managers"],
      "portalAccess": "denied"
    }
  }
}
```

### 8.2 Get Dismissed Users
**Endpoint**: `POST /api/employers/users/dismissed-list`

**Request**:
```json
{
  "includeDetails": true
}
```

**Response**:
```json
{
  "success": true,
  "dismissed": [
    {
      "userId": "123456789",
      "name": "John Doe",
      "dismissalDate": "2026-01-11",
      "dismissalReason": "Voluntary resignation",
      "dismissedBy": "HR Manager"
    }
  ]
}
```

---

## 9. SYNC & MONITORING ENDPOINTS

### 9.1 Sync Staff Database
**Endpoint**: `POST /api/employers/sync`

**Request**:
```json
{
  "action": "full",  // "full" or "incremental"
  "guildId": "YOUR_GUILD_ID"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Sync complete",
  "synced": {
    "staff": 45,
    "payslips": 120,
    "disciplinaries": 8,
    "reports": 35,
    "requests": 12,
    "absences": 24
  },
  "lastSync": "2026-01-11T10:30:00Z"
}
```

### 9.2 Get Dashboard Stats
**Endpoint**: `POST /api/employers/dashboard/stats`

**Request**:
```json
{
  "guildId": "YOUR_GUILD_ID"
}
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalStaff": 45,
    "activeStaff": 42,
    "suspendedStaff": 2,
    "dismissedStaff": 1,
    "pendingRequests": 3,
    "pendingAbsences": 5,
    "unresolvedDisciplinaries": 2,
    "recentActivity": {
      "lastSync": "2026-01-11T10:30:00Z",
      "newPayslips": 3,
      "newReports": 2,
      "newAbsences": 1
    }
  }
}
```

---

## 10. ERROR RESPONSES

All error responses follow this format:

```json
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "status": 404
}
```

**Common Error Codes**:
- `USER_NOT_FOUND` - User doesn't exist
- `INVALID_REQUEST` - Missing required fields
- `UNAUTHORIZED` - Token invalid or missing
- `DUPLICATE_ENTRY` - Item already exists
- `SHEET_SYNC_FAILED` - Google Sheets update failed
- `DISCORD_DM_FAILED` - Discord notification couldn't be sent (non-critical)
- `SUSPENSION_ERROR` - Can't suspend user
- `DISMISSAL_ERROR` - Can't dismiss user

---

## 11. IMPLEMENTATION NOTES

### Discord Notifications
All notifications (suspension, dismissal, approvals) are sent as Discord DMs with embedded messages:
- ✅ Green embeds for approvals
- ❌ Red embeds for rejections
- ⚠️ Orange embeds for warnings/suspensions
- ℹ️ Blue embeds for informational

### Google Sheets Integration
- All data is synced in real-time with Google Sheets
- Columns tracked: A (UserID), B-O (Data fields)
- Timestamps recorded automatically
- Historical data preserved

### Portal Access Control
When a user is:
- **Suspended**: Portal shows "Account Suspended" screen, roles hidden
- **Dismissed**: Portal shows "Access Denied" screen
- **Unsuspended**: Full access restored immediately

---

## 12. SAMPLE IMPLEMENTATION (JavaScript/Fetch)

```javascript
// Get all staff with full profiles
async function getAllStaff() {
  const response = await fetch(
    'https://timeclock-backend.marcusray.workers.dev/api/employers/staff/list',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN'
      },
      body: JSON.stringify({
        guildId: 'YOUR_GUILD_ID',
        includeDetails: true
      })
    }
  );
  return await response.json();
}

// Suspend a user
async function suspendUser(userId, reason, rolesToRemove) {
  const response = await fetch(
    'https://timeclock-backend.marcusray.workers.dev/api/employers/users/suspend',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        reason,
        rolesRemove: rolesToRemove,
        sendNotification: true
      })
    }
  );
  return await response.json();
}

// Dismiss user completely
async function dismissUser(userId, reason) {
  const response = await fetch(
    'https://timeclock-backend.marcusray.workers.dev/api/employers/users/dismiss',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        reason,
        allDataWipe: true,
        removeAllRoles: true,
        sendNotification: true
      })
    }
  );
  return await response.json();
}
```

---

**API Version**: 1.0
**Last Updated**: January 11, 2026
**Status**: Ready for Implementation
