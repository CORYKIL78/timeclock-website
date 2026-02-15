# OC Portal Account Data API Documentation

## Base URL
```
https://timeclock-backend.marcusray.workers.dev
```

## Authentication
All requests should include proper CORS configuration and use secure HTTPS connections.

---

## Endpoints

### 1. Get Full Account Data (Complete User Information)

**Endpoint:** `GET /api/accounts/{userId}`

**Description:** Fetches complete user account data including all related records (absences, reports, payslips, disciplinaries, requests, promotion history).

**Parameters:**
- `userId` (path) - Discord user ID

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Response:**
```json
{
  "account": {
    "id": "user:1088907566844739624",
    "discordId": "1088907566844739624",
    "discordName": "username",
    "name": "Full Name",
    "email": "user@example.com",
    "avatar": "https://cdn.discordapp.com/avatars/...",
    "department": "Development",
    "baseLevel": "5|Senior Manager",
    "staffId": "DD123456",
    "timezone": "GMT",
    "country": "United Kingdom",
    "dateOfSignup": "2024-01-15T10:30:00Z",
    "suspended": false,
    "points": 0,
    "absences": [
      {
        "id": "absence_1705315800000",
        "userId": "1088907566844739624",
        "startDate": "2024-01-20",
        "endDate": "2024-01-22",
        "reason": "sick",
        "type": "sick",
        "days": 3,
        "status": "approved",
        "comment": "Medical leave",
        "submittedAt": "2024-01-19T09:00:00Z",
        "approvedAt": "2024-01-19T14:30:00Z",
        "approvedBy": "admin_name"
      }
    ],
    "payslips": [
      {
        "id": "payslip_1705315800000",
        "userId": "1088907566844739624",
        "period": "January 2024",
        "link": "https://...",
        "dateAssigned": "2024-02-01",
        "assignedBy": "HR Admin",
        "status": "issued",
        "comment": "Monthly payslip"
      }
    ],
    "reports": [
      {
        "id": "report_1705315800000",
        "userId": "1088907566844739624",
        "type": "Commendation",
        "comment": "Excellent work on project X",
        "publishedBy": "Manager Name",
        "publishedById": "987654321",
        "timestamp": "2024-01-25T15:30:00Z",
        "scale": "Commendation"
      }
    ],
    "disciplinaries": [
      {
        "id": "disciplinary_1705315800000",
        "userId": "1088907566844739624",
        "strikeType": "Verbal Warning",
        "reason": "Attendance issue",
        "employer": "Manager",
        "employerId": "987654321",
        "timestamp": "2024-01-20T10:00:00Z",
        "customPoints": null
      }
    ],
    "requests": [
      {
        "id": "request_1705315800000",
        "userId": "1088907566844739624",
        "type": "Time Off",
        "comment": "Personal day request",
        "status": "pending",
        "timestamp": "2024-02-01T08:30:00Z"
      }
    ]
  }
}
```

---

### 2. Get Staff Profile Extra Fields

**Endpoint:** `GET /api/staff/profile/{userId}`

**Description:** Fetches staff-specific profile fields like description, notes, alt accounts, and promotion history.

**Parameters:**
- `userId` (path) - Discord user ID

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Response:**
```json
{
  "description": "Senior developer specializing in backend systems",
  "notes": "Excellent team player, takes initiative on projects",
  "altAccounts": [
    {
      "accountId": "1111111111111111111",
      "name": "Test Account",
      "relationship": "Testing purposes"
    }
  ],
  "promotionHistory": [
    {
      "id": "promo_1705315800000",
      "newBaseLevel": "5|Senior Manager",
      "previousLevel": "6|Manager",
      "reason": "Exceptional performance over 2 years",
      "promotedBy": "Director Name",
      "promotedById": "987654321",
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### 3. Update Staff Profile Fields

**Endpoint:** `POST /api/staff/profile/{userId}`

**Description:** Update staff description, notes, or alternative accounts.

**Parameters:**
- `userId` (path) - Discord user ID

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "description": "Updated description",
  "notes": "Updated notes",
  "altAccounts": [
    {
      "accountId": "1111111111111111111",
      "name": "Test Account",
      "relationship": "Testing"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "description": "Updated description",
    "notes": "Updated notes",
    "altAccounts": [...],
    "promotionHistory": [...]
  }
}
```

---

### 4. Add Promotion Record

**Endpoint:** `POST /api/staff/promotion`

**Description:** Adds a promotion record for a user and updates their base level. Automatically sends Discord notification.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "userId": "1088907566844739624",
  "newBaseLevel": "5|Senior Manager",
  "reason": "Exceptional performance and demonstrated leadership",
  "promotedBy": "Admin Name",
  "promotedById": "987654321",
  "timestamp": "2024-02-01T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "promotion": {
    "id": "promo_1705315800000",
    "newBaseLevel": "5|Senior Manager",
    "previousLevel": "6|Manager",
    "reason": "Exceptional performance and demonstrated leadership",
    "promotedBy": "Admin Name",
    "promotedById": "987654321",
    "timestamp": "2024-02-01T10:00:00Z"
  }
}
```

---

### 5. Get Promotion History

**Endpoint:** `GET /api/staff/promotions/{userId}`

**Description:** Retrieves complete promotion history for a user.

**Parameters:**
- `userId` (path) - Discord user ID

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Response:**
```json
{
  "promotions": [
    {
      "id": "promo_1705315800000",
      "newBaseLevel": "5|Senior Manager",
      "previousLevel": "6|Manager",
      "reason": "Exceptional performance",
      "promotedBy": "Director Name",
      "promotedById": "987654321",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "id": "promo_1704798000000",
      "newBaseLevel": "6|Manager",
      "previousLevel": "7|Senior Staff",
      "reason": "Promotion from senior staff role",
      "promotedBy": "Director Name",
      "promotedById": "987654321",
      "timestamp": "2023-06-10T09:00:00Z"
    }
  ]
}
```

---

### 6. Admin Authentication

**Endpoint:** `POST /api/admin/validate`

**Description:** Securely validates admin credentials. Credentials are stored in Cloudflare environment variables, not hardcoded in the frontend.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "discordId": "1088907566844739624",
  "pin": "061021"
}
```

**Response:**
```json
{
  "success": true,
  "adminId": "1088907566844739624",
  "adminName": "Marcus Ray"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

### 7. Delete User Record

**Endpoint:** `POST /api/admin/records/delete`

**Description:** Deletes a specific record (absence, report, payslip, disciplinary, request) for a user. Immediately updates both admin portal and user portal via KV storage sync.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "discordId": "1088907566844739624",
  "recordType": "report",
  "recordId": "report_1705315800000"
}
```

**Response:**
```json
{
  "success": true,
  "removed": 1
}
```

---

### 8. Erase All Records of Type

**Endpoint:** `POST /api/admin/records/erase-all`

**Description:** Deletes all records of a specific type for a user.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "discordId": "1088907566844739624",
  "recordType": "reports"
}
```

**Allowed recordTypes:**
- `absences`
- `requests`
- `payslips`
- `reports`
- `disciplinaries`

**Response:**
```json
{
  "success": true
}
```

---

### 9. Get All Users (Admin)

**Endpoint:** `GET /api/admin/users`

**Description:** Fetches list of all users for the admin portal.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "discordId": "1088907566844739624",
      "discordName": "username",
      "name": "Full Name",
      "email": "user@example.com",
      "avatar": "https://cdn.discordapp.com/avatars/...",
      "department": "Development",
      "baseLevel": "5|Senior Manager",
      "staffId": "DD123456",
      "timezone": "GMT",
      "country": "United Kingdom",
      "dateOfSignup": "2024-01-15T10:30:00Z",
      "suspended": false,
      "points": 0
    }
  ]
}
```

---

### 10. Get Absences (Admin)

**Endpoint:** `GET /api/admin/absences`

**Description:** Fetches all absence requests across all users.

**Response:**
```json
{
  "absences": [
    {
      "id": "absence_1705315800000",
      "userId": "1088907566844739624",
      "name": "User Name",
      "startDate": "2024-01-20",
      "endDate": "2024-01-22",
      "reason": "sick",
      "days": 3,
      "status": "pending"
    }
  ]
}
```

---

### 11. Get Reports (Admin)

**Endpoint:** `GET /api/admin/reports`

**Description:** Fetches all reports issued to users.

**Response:**
```json
{
  "reports": [
    {
      "id": "report_1705315800000",
      "userId": "1088907566844739624",
      "type": "Commendation",
      "comment": "Excellent work",
      "publishedBy": "Manager",
      "timestamp": "2024-01-25T15:30:00Z"
    }
  ]
}
```

---

### 12. Get Payslips (Admin)

**Endpoint:** `GET /api/admin/payslips`

**Response:**
```json
{
  "payslips": [
    {
      "id": "payslip_1705315800000",
      "userId": "1088907566844739624",
      "period": "January 2024",
      "link": "https://...",
      "dateAssigned": "2024-02-01",
      "assignedBy": "HR Admin"
    }
  ]
}
```

---

### 13. Get Strikes/Disciplinaries (Admin)

**Endpoint:** `GET /api/admin/strikes`

**Response:**
```json
{
  "strikes": [
    {
      "id": "disciplinary_1705315800000",
      "userId": "1088907566844739624",
      "strikeType": "Verbal Warning",
      "reason": "Attendance issue",
      "employer": "Manager",
      "timestamp": "2024-01-20T10:00:00Z"
    }
  ]
}
```

---

## Security Notes

1. **Admin Credentials:** Admin credentials (PINs and names) are stored in Cloudflare Worker environment variables, not in the frontend HTML.
2. **Validation:** Always use the `/api/admin/validate` endpoint to authenticate admin sessions.
3. **CORS:** All endpoints include CORS headers for safe cross-origin requests.
4. **Caching:** Responses include cache-control headers to prevent caching of sensitive data.

---

## Data Sync & Record Deletion

When a record is deleted via the OC Portal:
1. Admin deletes record via `/api/admin/records/delete`
2. Backend removes record from KV storage immediately
3. Record is deleted from all backend data sources
4. When users refresh their portal, they fetch fresh data from the API
5. Deleted records will not appear in either admin or user portals

---

## Example Usage (JavaScript)

```javascript
// Fetch full account data
const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/accounts/1088907566844739624');
const data = await response.json();
console.log(data.account);

// Admin authentication
const authResponse = await fetch('https://timeclock-backend.marcusray.workers.dev/api/admin/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    discordId: '1088907566844739624',
    pin: '061021'
  })
});
const authData = await authResponse.json();
console.log(authData);

// Delete a record
const deleteResponse = await fetch('https://timeclock-backend.marcusray.workers.dev/api/admin/records/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    discordId: '1088907566844739624',
    recordType: 'report',
    recordId: 'report_1705315800000'
  })
});
const deleteData = await deleteResponse.json();
console.log(deleteData);
```

---

## Headers Summary

| Endpoint | GET | POST | Required Headers |
|----------|-----|------|------------------|
| `/api/accounts/{userId}` | ✅ | - | `Content-Type: application/json` |
| `/api/staff/profile/{userId}` | ✅ | ✅ | `Content-Type: application/json` |
| `/api/staff/promotion` | - | ✅ | `Content-Type: application/json` |
| `/api/staff/promotions/{userId}` | ✅ | - | `Content-Type: application/json` |
| `/api/admin/validate` | - | ✅ | `Content-Type: application/json` |
| `/api/admin/records/delete` | - | ✅ | `Content-Type: application/json` |
| `/api/admin/records/erase-all` | - | ✅ | `Content-Type: application/json` |
| `/api/admin/users` | ✅ | - | `Content-Type: application/json` |
| `/api/admin/absences` | ✅ | - | `Content-Type: application/json` |
| `/api/admin/reports` | ✅ | - | `Content-Type: application/json` |
| `/api/admin/payslips` | ✅ | - | `Content-Type: application/json` |
| `/api/admin/strikes` | ✅ | - | `Content-Type: application/json` |

---

**API Version:** 1.0
**Last Updated:** February 2026
**Status:** Production Ready
