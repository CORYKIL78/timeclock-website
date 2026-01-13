# Testing the Fixed Absence Approval Flow

## Quick Test Steps

### 1. Submit an Absence (Staff Portal)
1. Open https://portal.cirkledevelopment.co.uk
2. Navigate to "Absences" section
3. Click "Request Absence"
4. Fill in:
   - Start Date: Tomorrow or later
   - End Date: Same day or within 2 weeks
   - Type: Select "Education" or other
   - Comment: Any test comment
5. Click "Submit"
6. Expected: Toast notification "Absence submitted"

### 2. Verify in Admin Portal
1. Open https://portal.cirkledevelopment.co.uk/admin/backup.html
2. Go to "Absences" tab
3. Click "🔄 Refresh Data"
4. Expected: Your absence appears in the table with "Pending" status

### 3. Approve the Absence
1. Find your absence in the table
2. Click "✓ Approve" button
3. Confirm the dialog
4. Expected: Success message "✅ Absence approved successfully!"

### 4. Verify Approval (Check Multiple Places)

**In Admin Portal:**
- Status should change from "Pending" to "Approved"
- Approve/Reject buttons should disappear (replaced with "Processed")

**In Staff Portal (if bot configured):**
- Check your direct messages on Discord
- Expected: DM saying "✅ Absence Request Approved" with dates and status
- This DM is only sent if DISCORD_BOT_TOKEN is configured in Cloudflare

**In Google Sheet (cirklehrAbsences):**
- Column G (Approval Status): Should show "Approved"
- Column H (Discord ID): Should show your Discord ID (NOT corrupted)
- Column I (Timestamp): Should show approval time
- Column J (Status): Should show "✅ Success"

**In Staff Portal Absences Tab:**
- Your absence should appear in the list with "Approved" status
- Updates within 5 seconds of approval

## Testing the Fix

The fix ensures that when an absence is approved:
1. ✅ Admin status updates correctly
2. ✅ Discord ID is preserved (not overwritten)
3. ✅ Timestamp is updated
4. ✅ Success flag is set
5. ✅ Discord DM can be sent (if bot token configured)
6. ✅ Staff portal receives the update

## Troubleshooting

### "Pending absences aren't showing"
- Clear browser cache and refresh
- Check localStorage in DevTools: Application → Local Storage
- Look for keys like `notifiedAbsences`
- If corrupted, delete and refresh

### "Absence approved but didn't get Discord DM"
- Check if DISCORD_BOT_TOKEN is set in Cloudflare Worker secrets
- Verify Discord ID in Google Sheet column H is valid (numeric only)
- Check Discord bot has DM permissions

### "Status still shows 'Pending' after approval"
- Wait 5 seconds (polling interval)
- Click "🔄 Refresh Data" in admin portal
- Check console for errors: F12 → Console tab

## API Endpoints Used

All endpoints are at: `https://timeclock-backend.marcusray.workers.dev`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/absence` | POST | Submit new absence |
| `/api/admin/absences` | GET | Fetch all absences (admin portal) |
| `/api/admin/absence/update-status` | POST | Approve/reject absence |
| `/api/absence/check-approved` | POST | Check for new approvals (polling) |
| `/api/absence/acknowledge` | POST | Mark notification as seen |

## Performance

Expected response times:
- Submit absence: < 500ms
- Fetch absences: 900-1000ms
- Approve/reject: < 500ms
- Discord DM: 1-2 seconds
- Portal update after approval: 5 seconds (polling interval)
