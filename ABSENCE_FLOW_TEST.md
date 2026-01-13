# Absence Request Flow - Complete Testing Guide

## System Architecture

### 1. **User Submits Absence Request** ✅
**Location:** Staff Portal - Absences Tab
**Endpoint:** `POST /api/absence` (or `/api/absence/submit`)
**Flow:**
- User enters: Type, Start Date, End Date, Comment
- Frontend creates local absence object with `status: 'pending'`
- Backend appends to `cirklehrAbsences` Google Sheet:
  - Col A: Name
  - Col B: Start Date
  - Col C: End Date
  - Col D: Reason/Type
  - Col E: Total Days
  - Col F: Comment
  - Col G: Approval Status (set to "Pending")
  - Col H: Discord ID
  - Col I: Timestamp
  - Col J: Acknowledgment flag (empty initially)
- User gets: Portal notification + Discord DM

---

## 2. **Admin Approves/Denies** ✅
**Location:** Admin Portal (`/admin/backup.html`)
**Endpoint:** `POST /api/admin/absence/update-status`
**Request Body:**
```json
{
  "rowIndex": 15,  // Row number in Google Sheet
  "status": "Approved" // or "Rejected"
}
```

**What Happens:**
- Backend updates row in Google Sheet:
  - Col G: Sets to "Approved" or "Rejected"
  - Col H: Sets to "Admin Portal"
  - Col I: Sets current timestamp
  - Col J: Sets to "notified" to prevent re-notifications
- Backend sends Discord DM to user with approval/denial message
- Frontend shows alert: "✅ Absence approved/rejected successfully!"

---

## 3. **User Polling Checks for Status Update** ✅
**Location:** Staff Portal (automatic polling every 5 seconds)
**Endpoint:** `POST /api/absence/check-approved`
**Request Body:**
```json
{
  "name": "UserName",
  "discordId": "123456789"
}
```

**What Happens:**
- Backend fetches all absences from Google Sheet
- **Filters for:**
  - User matches (by name or Discord ID)
  - Status != "Pending" (i.e., Approved or Rejected)
  - Column J is empty (NOT acknowledged yet)
- Returns only NEW approvals/denials
- Frontend updates local absence status
- Frontend shows notification: "✅ Absence approved!" or "❌ Rejected!"
- Frontend calls `/api/absence/acknowledge` to mark as processed

---

## 4. **Frontend Acknowledges Notification** ✅
**Endpoint:** `POST /api/absence/acknowledge`
**Request Body:**
```json
{
  "startDate": "2026-01-15",
  "endDate": "2026-01-17",
  "discordId": "123456789"
}
```

**What Happens:**
- Backend finds matching row in Google Sheet
- Sets column J to "notified"
- This prevents the absence from being returned in future `/api/absence/check-approved` calls
- Eliminates duplicate notifications

---

## Complete Flow Summary

```
User Submits         Admin Approves       User Gets Notified     Status Persists
     ↓                    ↓                      ↓                     ↓
Portal Form          Admin Portal         Polling API          Google Sheet
     ↓                    ↓                      ↓                     ↓
/api/absence    /api/admin/absence/    /api/absence/      Column J = "notified"
                 update-status          check-approved
                                        +
                                        /api/absence/acknowledge
```

---

## Testing Checklist

### Phase 1: Submission
- [ ] Submit absence from portal
- [ ] Check absence appears in local state (status = "pending")
- [ ] Check absence appears in Google Sheet `cirklehrAbsences`
- [ ] User receives Discord DM with submission confirmation

### Phase 2: Approval/Denial
- [ ] Open Admin Portal (`/admin/backup.html`)
- [ ] Navigate to Absences section
- [ ] Find pending absence
- [ ] Click "Approve" or click reject button
- [ ] Confirm dialog appears
- [ ] Backend updates Google Sheet columns G-J
- [ ] Admin gets success alert

### Phase 3: User Notification
- [ ] Check Discord DM to user (should arrive within 5 seconds)
- [ ] DM shows correct status (✅ Approved or ❌ Rejected)
- [ ] Portal notification appears on absences tab
- [ ] Absence status changes from "pending" to "approved"/"rejected"
- [ ] Sound plays (if enabled)

### Phase 4: Deduplication
- [ ] Wait 10 seconds
- [ ] Check that notification doesn't repeat (should be silenced after 5 seconds)
- [ ] Check localStorage `notifiedAbsences` has the key
- [ ] Refresh page - absence should still show as approved/rejected
- [ ] No duplicate notifications appear

---

## Debugging

### If User Doesn't Get DM
1. Check `DISCORD_BOT_TOKEN` is set in Cloudflare Secrets
2. Check Discord bot has DM permissions
3. Check browser console for errors in `sendDiscordDM()`

### If Admin Approval Fails
1. Check Admin Portal makes request to `/api/admin/absence/update-status`
2. Check response status (should be 200)
3. Check Google Sheet is updated (columns G-J)

### If Notifications Repeat
1. Check localStorage `notifiedAbsences` set correctly
2. Check Google Sheet column J is being set to "notified"
3. Check `/api/absence/acknowledge` is being called

