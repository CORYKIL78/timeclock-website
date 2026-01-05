# Backend Integration for Employee Reports

Your Cloudflare Workers backend at `https://timeclock-backend.marcusray.workers.dev` needs these new endpoints added to support the Employee Reports feature.

## Required Endpoints

### 1. Fetch Employee Reports
```javascript
// GET reports for a specific user
app.post('/api/reports/fetch', async (request, env) => {
  const { userId } = await request.json();
  
  try {
    // Read from Google Sheets 'cirklehrReports' tab
    const response = await fetch(
      `${env.GOOGLE_SHEETS_API}/${env.SPREADSHEET_ID}/values/cirklehrReports!A:I`,
      {
        headers: { 'Authorization': `Bearer ${env.GOOGLE_API_KEY}` }
      }
    );
    
    const data = await response.json();
    const rows = data.values || [];
    
    // Filter reports for this user (Column A = userId)
    const userReports = rows.slice(1).filter(row => row[0] === userId).map(row => ({
      userId: row[0],          // Column A
      reportType: row[2],      // Column C
      comment: row[3],         // Column D
      selectScale: row[4],     // Column E
      publishedBy: row[5],     // Column F
      status: row[6],          // Column G
      timestamp: row[7],       // Column H
      successStatus: row[8]    // Column I
    }));
    
    return new Response(JSON.stringify({ reports: userReports }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://portal.cirkledevelopment.co.uk',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### 2. Send Report Notification (Discord DM)
```javascript
// Send Discord DM when new report is submitted
app.post('/api/notifications/report', async (request, env) => {
  const { discordId, reportData } = await request.json();
  
  try {
    // Create Discord DM channel
    const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: discordId })
    });
    
    const channel = await channelResponse.json();
    
    // Send message
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          title: '📧 Your report is in!',
          description: `Howdy <@${discordId}>, you have a new report available!\n\nPlease head to the disciplinary tab and click **"My Reports"** to view it.`,
          fields: [
            {
              name: 'Report Type',
              value: reportData.type || 'N/A',
              inline: true
            },
            {
              name: 'Date',
              value: reportData.date || 'N/A',
              inline: true
            }
          ],
          color: 0x667eea,
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://portal.cirkledevelopment.co.uk',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### 3. Auto-Process Pending Reports
```javascript
// Check for reports with "Submit" status and process them
// This should run periodically (e.g., via cron trigger every minute)
app.post('/api/reports/check-pending', async (request, env) => {
  try {
    // Read from Google Sheets
    const response = await fetch(
      `${env.GOOGLE_SHEETS_API}/${env.SPREADSHEET_ID}/values/cirklehrReports!A:I`,
      {
        headers: { 'Authorization': `Bearer ${env.GOOGLE_API_KEY}` }
      }
    );
    
    const data = await response.json();
    const rows = data.values || [];
    let processed = 0;
    
    // Find rows where Column G = "Submit"
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[6]; // Column G
      
      if (status === 'Submit') {
        const userId = row[0];
        const reportType = row[2];
        
        try {
          // Send Discord notification
          await fetch(`${env.WORKER_URL}/api/notifications/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              discordId: userId,
              reportData: {
                type: reportType,
                date: new Date().toLocaleDateString()
              }
            })
          });
          
          // Update Sheet: Set timestamp and success status
          const rowNum = i + 1;
          await fetch(
            `${env.GOOGLE_SHEETS_API}/${env.SPREADSHEET_ID}/values/cirklehrReports!H${rowNum}:I${rowNum}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${env.GOOGLE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                values: [[
                  new Date().toLocaleString(), // Column H - Timestamp
                  '✓ Success'                  // Column I - Status
                ]]
              })
            }
          );
          
          processed++;
        } catch (error) {
          // Mark as failed
          const rowNum = i + 1;
          await fetch(
            `${env.GOOGLE_SHEETS_API}/${env.SPREADSHEET_ID}/values/cirklehrReports!H${rowNum}:I${rowNum}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${env.GOOGLE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                values: [[
                  new Date().toLocaleString(),
                  '✗ Failed: ' + error.message
                ]]
              })
            }
          );
        }
      }
    }
    
    return new Response(JSON.stringify({ processed }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

## Environment Variables Needed

Make sure your Cloudflare Worker has these environment variables:

```
DISCORD_BOT_TOKEN=your_bot_token
GOOGLE_SHEETS_API=https://sheets.googleapis.com/v4/spreadsheets
SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_API_KEY=your_google_api_key
WORKER_URL=https://timeclock-backend.marcusray.workers.dev
```

## Setup Cron Trigger

To auto-process pending reports, add a cron trigger in your `wrangler.toml`:

```toml
[triggers]
crons = ["* * * * *"]  # Run every minute
```

Then in your worker, handle the cron event:

```javascript
export default {
  async scheduled(event, env, ctx) {
    // Auto-process pending reports
    await fetch(`${env.WORKER_URL}/api/reports/check-pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },
  
  async fetch(request, env, ctx) {
    // Your existing fetch handler
  }
}
```

## Deployment

After adding these endpoints to your Cloudflare Worker:

```bash
cd /path/to/your/worker
wrangler publish
```

## Testing

Test each endpoint with curl:

```bash
# Test fetch reports
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/reports/fetch \
  -H "Content-Type: application/json" \
  -d '{"userId":"123456789"}'

# Test notification
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/notifications/report \
  -H "Content-Type: application/json" \
  -d '{"discordId":"123456789","reportData":{"type":"Commendation","date":"1/5/2026"}}'

# Test auto-process
curl -X POST https://timeclock-backend.marcusray.workers.dev/api/reports/check-pending
```
