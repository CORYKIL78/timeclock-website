/**
 * Cloudflare Worker - Timeclock Backend
 * Direct Google Sheets REST API (no googleapis library)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // Reports
      if (url.pathname === '/api/reports/fetch') {
        const { userId } = await request.json();
        const data = await getSheetsData(env, 'cirklehrReports!A:J');
        const reports = data.slice(1)
          .filter(row => row[0] === userId)
          .map(row => ({
            userId: row[0],         // A: ID
            type: row[2],           // C: type
            comment: row[3],        // D: comment
            scale: row[4],          // E: scale selector
            publishedBy: row[5],    // F: publisher (if exists)
            status: row[8] || row[6],  // Status column
            timestamp: row[6] || row[7]  // Timestamp
          }));
        return new Response(JSON.stringify({ success: true, reports }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/reports/check-pending') {
        const data = await getSheetsData(env, 'cirklehrReports!A:I');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          // Check for Submit status - need to verify which column
          const statusCol = data[i][8] || data[i][7] || data[i][6];  // Check H, G, or F
          if (statusCol?.toLowerCase() === 'submit') {
            // Send DM notification
            if (data[i][0] && env.DISCORD_BOT_TOKEN) {
              try {
                const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ recipient_id: data[i][0] })
                });
                
                if (dmResponse.ok) {
                  const dmChannel = await dmResponse.json();
                  await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      embeds: [{
                        title: '📧 New Report Available',
                        description: `You have a new report available!\\n\\nPlease check the **Staff Portal** to view it.`,
                        color: 0x667eea,
                        footer: { text: 'https://cirkledevelopment.co.uk' }
                      }]
                    })
                  });
                }
              } catch (dmError) {
                console.error('DM error:', dmError);
                errors.push({ row: i + 1, error: 'DM failed' });
              }
            }
            
            await updateSheets(env, `cirklehrReports!G${i + 1}:I${i + 1}`, [
              ['Processed', new Date().toISOString(), '✅']
            ]);
            processed++;
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
      }

      // Events
      if (url.pathname === '/api/events/fetch') {
        const data = await getSheetsData(env, 'cirklehrEvents!A:H');
        const events = data.slice(1).map(row => ({
          id: row[0],
          title: row[1],
          date: row[2],
          time: row[3],
          location: row[4],
          description: row[5],
          attendees: row[6] ? row[6].split(',') : []
        }));
        return new Response(JSON.stringify({ success: true, events }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/events/create') {
        const event = await request.json();
        await appendToSheet(env, 'cirklehrEvents!A:H', [[
          event.id || Date.now().toString(),
          event.title,
          event.date,
          event.time,
          event.location,
          event.description,
          '',
          new Date().toISOString()
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Attendance
      if (url.pathname === '/api/attendance/log') {
        const { userIds, meetingName } = await request.json();
        const data = await getSheetsData(env, 'cirklehrAttendance!A:E');
        
        for (const userId of userIds) {
          const rowIndex = data.findIndex(row => row[0] === userId);
          if (rowIndex >= 0) {
            const current = parseInt(data[rowIndex][1]) || 0;
            await updateSheets(env, `cirklehrAttendance!B${rowIndex + 1}`, [[current + 1]]);
          }
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Absence
      if (url.pathname === '/api/absence/submit') {
        const absence = await request.json();
        const startDate = new Date(absence.startDate);
        const endDate = new Date(absence.endDate);
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        await appendToSheet(env, 'cirklehrAbsences!A:J', [[
          absence.name || absence.userId,  // A: Name
          absence.startDate,               // B: start date
          absence.endDate,                 // C: end date
          absence.reason || '',            // D: reason
          totalDays,                       // E: total days
          absence.userComment || '',       // F: user comment
          'Pending',                       // G: approved or not
          absence.userId,                  // H: user ID
          new Date().toISOString(),        // I: timestamp
          'Submit'                         // J: status (success/failed submit)
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      // Absence approval
      if (url.pathname === '/api/absence/approve') {
        const { rowIndex, approved, userId } = await request.json();
        const status = approved ? 'Approved' : 'Rejected';
        
        // Update approval status
        await updateSheets(env, `cirklehrAbsences!G${rowIndex}:J${rowIndex}`, [
          [status, userId, new Date().toISOString(), '✅ Success']
        ]);
        
        // Send DM notification
        if (userId && env.DISCORD_BOT_TOKEN) {
          try {
            const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: userId })
            });
            
            if (dmResponse.ok) {
              const dmChannel = await dmResponse.json();
              await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  embeds: [{
                    title: approved ? '✅ Absence Request Approved' : '❌ Absence Request Rejected',
                    description: `Your absence request has been ${status.toLowerCase()}.\\n\\nPlease check the **Staff Portal** for details.`,
                    color: approved ? 0x4caf50 : 0xf44336,
                    footer: { text: 'https://cirkledevelopment.co.uk' }
                  }]
                })
              });
            }
          } catch (error) {
            console.error('DM error:', error);
          }
        }
        
        return new Response(JSON.stringify({ success: true, status }), { headers: corsHeaders });
      }

      // Payslips
      if (url.pathname === '/api/payslips/check-pending') {
        const data = await getSheetsData(env, 'cirklehrPayslips!A:G');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][5]?.toLowerCase() === 'submit') {
            // Send DM notification
            if (data[i][0] && env.DISCORD_BOT_TOKEN) {
              try {
                const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ recipient_id: data[i][0] })
                });
                
                if (dmResponse.ok) {
                  const dmChannel = await dmResponse.json();
                  await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      embeds: [{
                        title: '💰 New Payslip Available',
                        description: `Your payslip is ready!\\n\\nPlease check the **Staff Portal** to view it.`,
                        color: 0x4caf50,
                        footer: { text: 'https://cirkledevelopment.co.uk' }
                      }]
                    })
                  });
                }
              } catch (dmError) {
                console.error('DM error:', dmError);
                errors.push({ row: i + 1, error: 'DM failed' });
              }
            }
            
            await updateSheets(env, `cirklehrPayslips!F${i + 1}:G${i + 1}`, [
              ['Processed', new Date().toISOString()]
            ]);
            processed++;
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
      }

      // Requests endpoints
      if (url.pathname === '/api/requests/submit') {
        const req = await request.json();
        await appendToSheet(env, 'cirklehrRequests!A:H', [[
          req.name || '',           // A: name
          req.request || '',        // B: Request
          req.userComment || '',    // C: user comment
          req.userId,               // D: user ID
          req.employerName || '',   // E: employer name
          'Submit',                 // F: submit status
          new Date().toISOString(), // G: timestamp
          ''                        // H: status (success/failed)
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/requests/check-pending') {
        const data = await getSheetsData(env, 'cirklehrRequests!A:H');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][5]?.toLowerCase() === 'submit') {  // F column
            // Send DM notification
            if (data[i][3] && env.DISCORD_BOT_TOKEN) {  // D: user ID
              try {
                const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ recipient_id: data[i][3] })
                });
                
                if (dmResponse.ok) {
                  const dmChannel = await dmResponse.json();
                  await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      embeds: [{
                        title: '📝 Request Update',
                        description: `Your request has been processed.\\n\\nPlease check the **Staff Portal** for details.`,
                        color: 0x2196f3,
                        footer: { text: 'https://cirkledevelopment.co.uk' }
                      }]
                    })
                  });
                }
              } catch (dmError) {
                console.error('DM error:', dmError);
                errors.push({ row: i + 1, error: 'DM failed' });
              }
            }
            
            // Update status
            await updateSheets(env, `cirklehrRequests!F${i + 1}:H${i + 1}`, [
              ['Processed', new Date().toISOString(), '✅ Success']
            ]);
            processed++;
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
      }

      // Disciplinaries
      if (url.pathname === '/api/disciplinaries/create') {
        const disc = await request.json();
        await appendToSheet(env, 'cirklehrStrikes!A:H', [[
          disc.userId,           // A: ID
          '',                    // B: blank
          disc.strikeType || 'Warning',  // C: type
          disc.reason || '',     // D: description/comment
          disc.employer || 'System',     // E: employer
          'Submit',              // F: submit status
          new Date().toISOString(),  // G: timestamp
          ''                     // H: status (success/failed) - to be updated
        ]]);
        
        // Send Discord DM
        let dmSent = false;
        let dmError = null;
        if (disc.userId && env.DISCORD_BOT_TOKEN) {
          try {
            const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: disc.userId })
            });
            
            const dmData = await dmResponse.json();
            
            if (dmResponse.ok && dmData.id) {
              const msgResponse = await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  embeds: [{
                    title: '⚠️ New Disciplinary Notice',
                    description: `You have received a new disciplinary action.\n\nPlease check the **Staff Portal** to view the full details.`,
                    color: 0xff9800,
                    footer: { text: 'https://cirkledevelopment.co.uk' }
                  }]
                })
              });
              dmSent = msgResponse.ok;
            } else {
              dmError = dmData.message || 'Could not open DM channel';
              console.log('DM Error:', dmError, '- User may not share server with bot or has DMs disabled');
            }
          } catch (error) {
            dmError = error.message;
            console.error('DM exception:', error);
          }
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          dmSent,
          dmError: dmError || undefined 
        }), { headers: corsHeaders });
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      if (url.pathname === '/api/disciplinaries/check-pending') {
        const data = await getSheetsData(env, 'cirklehrStrikes!A:H');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][5]?.toLowerCase() === 'submit') {  // F column (index 5)
            // Send DM if Discord token available
            if (data[i][0] && env.DISCORD_BOT_TOKEN) {
              try {
                const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ recipient_id: data[i][0] })
                });
                
                if (dmResponse.ok) {
                  const dmChannel = await dmResponse.json();
                  
                  await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      embeds: [{
                        title: '⚠️ New Disciplinary Notice',
                        description: `You have received a new disciplinary action.\n\nPlease check the **Staff Portal** to view the full details.`,
                        color: 0xff9800,
                        footer: { text: 'https://cirkledevelopment.co.uk' }
                      }]
                    })
                  });
                }
              } catch (dmError) {
                console.error('DM error:', dmError);
                errors.push({ row: i + 1, userId: data[i][0], error: 'DM failed' });
              }
            }
            
            // Update status columns (F=Processed, H=Success)
            try {
              await updateSheets(env, `cirklehrStrikes!F${i + 1}:H${i + 1}`, [
                ['Processed', new Date().toISOString(), '✅ Success']
              ]);
              processed++;
            } catch (updateError) {
              errors.push({ row: i + 1, error: 'Sheet update failed: ' + updateError.message });
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// Google Sheets helpers using REST API
async function getAccessToken(env) {
  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  
  const jwtClaimSet = btoa(JSON.stringify({
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  const signatureInput = `${jwtHeader}.${jwtClaimSet}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(atob(env.GOOGLE_PRIVATE_KEY.replace(/-----.*-----/g, '').replace(/\s/g, ''))),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const { access_token } = await tokenResponse.json();
  return access_token;
}

async function getSheetsData(env, range) {
  const token = await getAccessToken(env);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  return data.values || [];
}

async function updateSheets(env, range, values) {
  const token = await getAccessToken(env);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );
}

async function appendToSheet(env, range, values) {
  const token = await getAccessToken(env);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i);
  }
  return buf;
}
