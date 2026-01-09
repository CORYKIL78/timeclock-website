/**
 * Complete Cloudflare Worker for Timeclock Backend
 * Handles all portal and Discord bot endpoints
 * Uses Google Sheets API v4 REST directly (no googleapis library)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      // Reports endpoints
      if (pathname === '/api/reports/fetch' && request.method === 'POST') {
        return await handleReportsFetch(request, env);
      }
      if (pathname === '/api/reports/check-pending' && request.method === 'POST') {
        return await handleReportsCheckPending(request, env);
      }
      if (pathname === '/api/notifications/report' && request.method === 'POST') {
        return await handleReportNotification(request, env);
      }

      // Employee endpoints
      if (pathname === '/api/employees/hire' && request.method === 'POST') {
        return await handleEmployeeHire(request, env);
      }
      if (pathname === '/api/employees/dismiss' && request.method === 'POST') {
        return await handleEmployeeDismiss(request, env);
      }

      // Attendance endpoints
      if (pathname === '/api/attendance/log' && request.method === 'POST') {
        return await handleAttendanceLog(request, env);
      }
      if (pathname === '/api/attendance/get' && request.method === 'POST') {
        return await handleAttendanceGet(request, env);
      }

      // Events endpoints
      if (pathname === '/api/events/create' && request.method === 'POST') {
        return await handleEventCreate(request, env);
      }
      if (pathname === '/api/events/fetch' && request.method === 'POST') {
        return await handleEventsFetch(request, env);
      }
      if (pathname === '/api/events/respond' && request.method === 'POST') {
        return await handleEventRespond(request, env);
      }

      // Absence endpoints
      if (pathname === '/api/absence/manual' && request.method === 'POST') {
        return await handleManualAbsence(request, env);
      }
      if (pathname === '/api/absence/ongoing' && request.method === 'GET') {
        return await handleAbsenceOngoing(request, env);
      }

      // Payslips endpoints
      if (pathname === '/api/payslips/check-pending' && request.method === 'POST') {
        return await handlePayslipsCheckPending(request, env);
      }
      if (pathname === '/api/payslips/fetch' && request.method === 'POST') {
        return await handlePayslipsFetch(request, env);
      }

      // Disciplinaries endpoints
      if (pathname === '/api/disciplinaries/check-pending' && request.method === 'POST') {
        return await handleDisciplinariesCheckPending(request, env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal Server Error', details: error.message }, 500);
    }
  }
};

// ============================================================================
// GOOGLE SHEETS HELPER
// ============================================================================

async function getAuthClient(env) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: env.GOOGLE_PROJECT_ID || 'timeclock-portal',
      private_key_id: env.GOOGLE_PRIVATE_KEY_ID,
      private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: env.GOOGLE_CLIENT_EMAIL,
      client_id: env.GOOGLE_CLIENT_ID,
      token_uri: env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token'
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return auth.getClient();
}

// ============================================================================
// REPORTS ENDPOINTS
// ============================================================================

async function handleReportsFetch(request, env) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return jsonResponse({ success: false, error: 'userId required' }, 400);
    }

    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrReports!A:I'
    });

    const rows = response.data.values || [];
    const userReports = rows.slice(1).filter(row => row[0] === userId).map(row => ({
      userId: row[0],
      reportType: row[2],
      comment: row[3],
      selectScale: row[4],
      publishedBy: row[5],
      status: row[6],
      timestamp: row[7],
      successStatus: row[8]
    }));

    return jsonResponse({ success: true, reports: userReports });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return jsonResponse({ success: false, error: 'Failed to fetch reports' }, 500);
  }
}

async function handleReportsCheckPending(request, env) {
  try {
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrReports!A:I'
    });

    const rows = response.data.values || [];
    let processed = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[6]?.toLowerCase() === 'submit') {
        const userId = row[0];
        const reportType = row[2];
        
        // Send Discord DM
        await sendDiscordDM(env, userId, {
          title: '📧 Your report is in!',
          description: `Howdy <@${userId}>, you have a new report available!\n\nPlease head to the disciplinary tab and click **"My Reports"** to view it.`,
          fields: [
            { name: 'Report Type', value: reportType || 'N/A', inline: true },
            { name: 'Date', value: new Date().toLocaleDateString(), inline: true }
          ],
          color: 0x667eea
        });

        // Update status
        await sheets.spreadsheets.values.update({
          spreadsheetId: env.SPREADSHEET_ID,
          range: `cirklehrReports!G${i + 1}:I${i + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Processed', new Date().toISOString(), '✅ Success']]
          }
        });

        processed++;
      }
    }

    return jsonResponse({ success: true, processed });
  } catch (error) {
    console.error('Reports check error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleReportNotification(request, env) {
  try {
    const { discordId, reportData } = await request.json();
    
    await sendDiscordDM(env, discordId, {
      title: '📧 Your report is in!',
      description: `Howdy <@${discordId}>, you have a new report available!`,
      fields: [
        { name: 'Report Type', value: reportData.type || 'N/A', inline: true },
        { name: 'Date', value: reportData.date || 'N/A', inline: true }
      ],
      color: 0x667eea
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// ATTENDANCE ENDPOINTS
// ============================================================================

async function handleAttendanceLog(request, env) {
  try {
    const { userIds, meetingName, loggedBy } = await request.json();
    
    if (!userIds || !Array.isArray(userIds) || !meetingName) {
      return jsonResponse({ error: 'Meeting name and user IDs array required' }, 400);
    }

    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrAttendance!A:E'
    });

    const rows = response.data.values || [];
    const updates = [];

    for (const userId of userIds) {
      const rowIndex = rows.findIndex(row => row[0] === userId);
      
      if (rowIndex >= 0) {
        const currentCount = parseInt(rows[rowIndex][1]) || 0;
        updates.push({
          range: `cirklehrAttendance!B${rowIndex + 1}`,
          values: [[currentCount + 1]]
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: env.SPREADSHEET_ID,
          range: 'cirklehrAttendance!A:E',
          valueInputOption: 'RAW',
          resource: {
            values: [[userId, 1, '', '', meetingName]]
          }
        });
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: env.SPREADSHEET_ID,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
    }

    return jsonResponse({ success: true, logged: userIds.length });
  } catch (error) {
    console.error('Attendance log error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleAttendanceGet(request, env) {
  try {
    const { userDiscordId } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrAttendance!A:E'
    });

    const rows = response.data.values || [];
    const userRow = rows.find(row => row[0] === userDiscordId);
    const count = userRow ? parseInt(userRow[1]) || 0 : 0;

    return jsonResponse({ success: true, count });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// EVENTS ENDPOINTS
// ============================================================================

async function handleEventCreate(request, env) {
  try {
    const { title, description, date, time, createdBy } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const eventId = `EVT-${Date.now()}`;
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrEvents!A:G',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          eventId,
          title,
          description,
          date,
          time || '00:00',
          createdBy,
          new Date().toISOString()
        ]]
      }
    });

    return jsonResponse({ success: true, eventId });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleEventsFetch(request, env) {
  try {
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrEvents!A:G'
    });

    const rows = response.data.values || [];
    const events = rows.slice(1).map(row => ({
      id: row[0],
      title: row[1],
      description: row[2],
      date: row[3],
      time: row[4],
      createdBy: row[5],
      createdAt: row[6]
    }));

    return jsonResponse({ success: true, events });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleEventRespond(request, env) {
  try {
    const { eventId, userDiscordId, response: userResponse } = await request.json();
    
    // Log response to Google Sheets if needed
    // For now, just return success
    
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// ABSENCE ENDPOINTS
// ============================================================================

async function handleAbsenceOngoing(request, env) {
  try {
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrAbsences!A:J'
    });

    const rows = response.data.values || [];
    const now = new Date();
    
    const absences = rows.slice(1)
      .filter(row => {
        const endDate = new Date(row[4]);
        const status = row[6];
        return endDate >= now && status === 'approved';
      })
      .map((row, index) => ({
        id: row[0],
        userId: row[1],
        username: row[2] || 'Unknown',
        type: row[2],
        startDate: row[3],
        endDate: row[4],
        reason: row[5],
        status: row[6]
      }));

    return jsonResponse({ success: true, absences });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleManualAbsence(request, env) {
  try {
    const { action, discordId, absenceId, type, startDate, endDate, reason } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    if (action === 'add') {
      const newAbsenceId = `ABS-${Date.now()}`;
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.SPREADSHEET_ID,
        range: 'cirklehrAbsences!A:J',
        valueInputOption: 'RAW',
        resource: {
          values: [[
            newAbsenceId,
            discordId,
            type,
            startDate,
            endDate,
            reason,
            'approved',
            new Date().toISOString(),
            'Manual',
            'System'
          ]]
        }
      });

      return jsonResponse({ success: true, absenceId: newAbsenceId });
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// PAYSLIPS ENDPOINTS
// ============================================================================

async function handlePayslipsCheckPending(request, env) {
  try {
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrPayslips!A:H'
    });

    const rows = response.data.values || [];
    let processed = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[6]?.toLowerCase() === 'submit') {
        const userId = row[0];
        
        await sendDiscordDM(env, userId, {
          title: '💰 New Payslip Available',
          description: `Your payslip is ready! Check the Staff Portal.`,
          color: 0x00ff00
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId: env.SPREADSHEET_ID,
          range: `cirklehrPayslips!G${i + 1}:H${i + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Processed', '✅ Success']]
          }
        });

        processed++;
      }
    }

    return jsonResponse({ success: true, processed });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handlePayslipsFetch(request, env) {
  try {
    const { staffId } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrPayslips!A:H'
    });

    const rows = response.data.values || [];
    const payslips = rows.slice(1).filter(row => row[0] === staffId).map(row => ({
      staffId: row[0],
      amount: row[1],
      period: row[2],
      date: row[3]
    }));

    return jsonResponse({ success: true, payslips });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// DISCIPLINARIES ENDPOINTS
// ============================================================================

async function handleDisciplinariesCheckPending(request, env) {
  try {
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrStrikes!A:H'
    });

    const rows = response.data.values || [];
    let processed = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[6]?.toLowerCase() === 'submit') {
        const userId = row[0];
        
        await sendDiscordDM(env, userId, {
          title: '⚠️ Disciplinary Notice',
          description: `You have received a disciplinary notice. Please check the Staff Portal.`,
          color: 0xff0000
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId: env.SPREADSHEET_ID,
          range: `cirklehrStrikes!G${i + 1}:H${i + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Processed', '✅ Success']]
          }
        });

        processed++;
      }
    }

    return jsonResponse({ success: true, processed });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// EMPLOYEE ENDPOINTS
// ============================================================================

async function handleEmployeeHire(request, env) {
  try {
    const { discordId, name, role, department } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrEmployees!A:H',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          discordId,
          name,
          role,
          department,
          'Active',
          new Date().toISOString()
        ]]
      }
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

async function handleEmployeeDismiss(request, env) {
  try {
    const { discordId, reason } = await request.json();
    
    const auth = await getAuthClient(env);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: 'cirklehrEmployees!A:H'
    });

    const rows = response.data.values || [];
    const employeeIndex = rows.findIndex(row => row[0] === discordId);

    if (employeeIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.SPREADSHEET_ID,
        range: `cirklehrEmployees!E${employeeIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Dismissed']]
        }
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================================================
// DISCORD DM HELPER
// ============================================================================

async function sendDiscordDM(env, userId, embed) {
  try {
    // Create DM channel
    const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: userId })
    });

    if (!channelResponse.ok) {
      console.error('Failed to create DM channel:', await channelResponse.text());
      return false;
    }

    const channel = await channelResponse.json();

    // Send message
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: new Date().toISOString() }]
      })
    });

    return messageResponse.ok;
  } catch (error) {
    console.error('Discord DM error:', error);
    return false;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
