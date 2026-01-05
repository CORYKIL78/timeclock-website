# Employee Reports System

## Overview
The Employee Reports system is a new feature integrated into the Disciplinaries section that allows managers to submit performance reports about employees. These reports are stored in Google Sheets and synced to the portal, where employees can view them alongside their disciplinaries.

## Features

### 📊 Staff Points Counter
- Automatically calculates and displays staff points based on reports
- **Commendation**: +1 point (green)
- **Disruptive**: -1 point (red)
- **Negative Behaviour**: -1 point (red)
- **Monthly Report**: No point change (informational)

### 📄 Report Types
1. **Commendation** ⭐ - Positive recognition for good work
2. **Disruptive** ⚠️ - Warning for disruptive behavior
3. **Monthly Report** 📊 - Regular performance summary
4. **Negative Behaviour** ❌ - Documentation of negative conduct

### 🔔 Notifications
- Employees receive Discord DM when a new report is submitted
- Portal notification appears with sound alert
- Real-time polling every 5 seconds for instant updates

## Google Sheets Structure

### Sheet Name: `cirklehrReports`

| Column | Field | Description |
|--------|-------|-------------|
| A | User ID | Discord ID of the employee |
| C | Report Type | Dropdown: Commendation, Disruptive, Monthly Report, Negative Behaviour |
| D | Comment | Detailed feedback/description |
| E | Select Scale | Additional rating/scale information (optional) |
| F | Published By | Name of the manager/admin who submitted the report |
| G | Status | Dropdown: Submit or Remove |
| H | Timestamp | Date/time when the report was sent |
| I | Success Status | "✓ Success" or "✗ Failed" |

## Backend API Endpoints

### Fetch Reports
```
POST /api/reports/fetch
Body: { userId: "discord_id_here" }
Response: { reports: [...] }
```

### Send Report Notification (Discord DM)
```
POST /api/notifications/report
Body: {
  discordId: "discord_id_here",
  reportData: {
    type: "Commendation",
    date: "1/5/2026"
  }
}
```

### Check Pending Reports (Auto-submission)
```
POST /api/reports/check-pending
Body: { }
Response: Processes reports with "Submit" status
```

## User Interface

### Navigation
1. Go to **Disciplinaries** section in sidebar
2. See two tabs at the top:
   - **Disciplinaries** - View strikes and disciplinary actions
   - **My Reports** - View employee reports

### Staff Points Display
- Prominently displayed at the top of the section
- Color-coded:
  - Green = Positive points
  - Red = Negative points
  - White = Zero points

### Report Cards
Each report displays:
- Icon based on type (⭐, ⚠️, ❌, 📊)
- Report type name
- Timestamp
- Published by (manager name)
- Color-coded background matching report type

### Report Details Modal
Click any report to view full details:
- Complete timestamp
- Report type
- Published by
- Scale (if provided)
- Full comment/feedback

## Discord DM Message Format

When a new report is submitted, the employee receives:

```
📧 Your report is in!

Howdy @username, you have a new report available! 

Please head to the disciplinary tab and click "My Reports" to view it.

Report Type: Commendation
Date: January 5, 2026
```

## Implementation Files

### Modified Files
1. **index.html**
   - Added Reports tab to disciplinaries section
   - Added Staff Points counter display
   - Added report content areas

2. **script.js**
   - `fetchEmployeeReports()` - Fetches reports from backend
   - `renderReports()` - Displays reports in UI
   - `calculateStaffPoints()` - Computes points from reports
   - `updateStaffPointsCounter()` - Updates UI with points
   - `showReportDetails()` - Shows detailed report modal
   - `setupDisciplinariesTabs()` - Initializes tab switching
   - Polling interval for new reports (5 seconds)
   - DM notification integration

3. **style.css**
   - Added `.report-item` styling
   - Added `.section-tab-btn` styling for tabs
   - Added hover effects and transitions

## Backend Requirements

Your backend (`timeclock-backend.marcusray.workers.dev`) needs to implement:

### 1. Reports Fetch Endpoint
```javascript
// GET reports for a specific user from cirklehrReports sheet
app.post('/api/reports/fetch', async (req, res) => {
  const { userId } = req.body;
  // Query Google Sheets for reports where Column A = userId
  // Return array of report objects
  res.json({ reports: [...] });
});
```

### 2. Report Notification Endpoint
```javascript
// Send Discord DM to user about new report
app.post('/api/notifications/report', async (req, res) => {
  const { discordId, reportData } = req.body;
  // Send DM via Discord API
  res.json({ success: true });
});
```

### 3. Check Pending Reports (Auto-processor)
```javascript
// Check for reports with "Submit" status and process them
app.post('/api/reports/check-pending', async (req, res) => {
  // Find rows where Column G = "Submit"
  // Send notifications
  // Update Column I to "✓ Success" or "✗ Failed"
  // Update Column H with timestamp
  res.json({ processed: count });
});
```

## Usage for Managers

### Submitting a Report
1. Open Google Sheets → `cirklehrReports` tab
2. Add new row with employee's Discord ID (Column A)
3. Select Report Type (Column C)
4. Write comment/feedback (Column D)
5. Add scale if needed (Column E)
6. Write your name (Column F)
7. Set status to **Submit** (Column G)
8. Backend will auto-process and:
   - Send DM to employee
   - Update timestamp (Column H)
   - Mark as "✓ Success" (Column I)

### Removing a Report
1. Find the report row in sheets
2. Change Column G to **Remove**
3. Backend will process and remove from portal

## Testing Checklist

- [ ] Reports display correctly in portal
- [ ] Staff points calculate accurately
- [ ] Tab switching works smoothly
- [ ] Report detail modals show all information
- [ ] Discord DMs are sent when new report submitted
- [ ] Portal notifications appear with sound
- [ ] Real-time polling detects new reports within 5 seconds
- [ ] Color coding matches report types
- [ ] Icons display correctly
- [ ] Mobile responsive design works

## Future Enhancements

Potential improvements:
- Allow employees to acknowledge reports
- Add filtering by report type
- Export reports to PDF
- Add graphs/charts for staff points over time
- Manager dashboard to submit reports from portal
- Appeal system for disputed reports
- Historical tracking of points changes

## Support

If employees have issues viewing reports:
1. Check they're accessing from correct URL: `https://portal.cirkledevelopment.co.uk`
2. Verify their Discord ID matches Sheet Column A exactly
3. Check browser console (F12) for errors
4. Ensure backend endpoints are responding (check Network tab)
5. Verify Google Sheets permissions are correct
