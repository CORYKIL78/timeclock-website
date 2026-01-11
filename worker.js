/**
 * Cloudflare Worker - Timeclock Backend
 * Direct Google Sheets REST API (no googleapis library)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || 'https://portal.cirkledevelopment.co.uk';

    // CORS headers - use specific origin instead of wildcard for credentials
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json'
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    try {
      // Health check endpoint
      if (url.pathname === '/api/status' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), { 
          headers: corsHeaders 
        });
      }

      // Discord OAuth endpoint
      if (url.pathname === '/auth' && request.method === 'GET') {
        const code = url.searchParams.get('code');
        const redirectUri = url.searchParams.get('redirect_uri');
        
        if (!code) {
          return new Response(JSON.stringify({ error: 'No code provided' }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        try {
          // Exchange code for access token
          const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: '1417915896634277888',
              client_secret: env.DISCORD_CLIENT_SECRET || '',
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: redirectUri || 'https://portal.cirkledevelopment.co.uk'
            })
          });
          
          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            return new Response(JSON.stringify({ error: 'Token exchange failed', details: errorData }), {
              status: tokenResponse.status,
              headers: corsHeaders
            });
          }
          
          const tokenData = await tokenResponse.json();
          
          // Get user info from Discord
          const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
          });
          
          if (!userResponse.ok) {
            const errorData = await userResponse.text();
            return new Response(JSON.stringify({ error: 'Failed to get user info', details: errorData }), {
              status: userResponse.status,
              headers: corsHeaders
            });
          }
          
          const userData = await userResponse.json();
          
          // Return user data
          return new Response(JSON.stringify({
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar,
            global_name: userData.global_name
          }), { headers: corsHeaders });
          
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Auth error', message: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Discord member endpoint - fetch from Google Sheets
      if (url.pathname.startsWith('/member/') && request.method === 'GET') {
        const userId = url.pathname.split('/member/')[1];
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'No user ID provided' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        try {
          // Fetch user from cirklehrUsers sheet (skip header row)
          const usersData = await getSheetsData(env, 'cirklehrUsers!A3:Z1000');
          
          // Find user by Discord ID (column D = index 3)
          const userRow = usersData.find(row => row[3] === userId);
          
          if (!userRow) {
            return new Response(JSON.stringify({ 
              error: 'Not found',
              message: 'User not found in database'
            }), {
              status: 404,
              headers: corsHeaders
            });
          }
          
          // Return user data from sheets
          // Columns: A=Name, B=Email, C=Department, D=Discord ID, E=Timezone, F=Country, G=DateOfSignup, H=Utilisation, I=?, J=?, K=BaseLevel
          const baseLevel = userRow[10] || ''; // Column K (index 10)
          
          return new Response(JSON.stringify({
            id: userRow[3] || userId, // Discord ID from column D
            username: userRow[3] || 'User', // Discord ID
            roles: baseLevel ? [baseLevel] : [], 
            joined_at: userRow[6] || new Date().toISOString(), // Date of Signup column G
            // Profile data
            name: userRow[0] || '',
            email: userRow[1] || '',
            department: userRow[2] || '',
            discordTag: userRow[3] || '', // Discord ID
            timezone: userRow[4] || '',
            country: userRow[5] || '',
            baseLevel: baseLevel,
            role: baseLevel
          }), { headers: corsHeaders });
          
        } catch (e) {
          return new Response(JSON.stringify({ 
            error: 'Member fetch error', 
            message: e.message 
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Members endpoint (fetch guild members from Discord with roles)
      if (url.pathname.startsWith('/members/') && request.method === 'GET') {
        const guildId = url.pathname.split('/members/')[1];
        
        try {
          const botToken = env.DISCORD_BOT_TOKEN;
          
          if (!botToken) {
            return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
              status: 500,
              headers: corsHeaders
            });
          }
          
          // Fetch members from Discord API
          const discordResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
            {
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            return new Response(JSON.stringify({ error: 'Discord API error', details: errorText }), {
              status: discordResponse.status,
              headers: corsHeaders
            });
          }
          
          const discordMembers = await discordResponse.json();
          
          // Also get Google Sheets data to merge
          const usersData = await getSheetsData(env, 'cirklehrUsers!A3:Z1000');
          
          // Create a map of Discord ID to Sheets data
          const sheetsMap = {};
          usersData.forEach(row => {
            const discordId = row[3];
            if (discordId) {
              sheetsMap[discordId] = {
                name: row[0] || '',
                email: row[1] || '',
                department: row[2] || '',
                timezone: row[4] || '',
                country: row[5] || ''
              };
            }
          });
          
          // Merge Discord data with Sheets data
          const members = discordMembers.map(member => {
            const sheetData = sheetsMap[member.user.id] || {};
            return {
              user: member.user,
              roles: member.roles,
              nick: member.nick,
              // Merged data
              name: sheetData.name || member.user.username,
              email: sheetData.email || '',
              department: sheetData.department || '',
              timezone: sheetData.timezone || '',
              country: sheetData.country || ''
            };
          });
          
          return new Response(JSON.stringify(members), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed to fetch members', message: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Guild roles endpoint (fetch all roles in a guild for name mapping)
      if (url.pathname === '/api/guild/roles' && request.method === 'POST') {
        const { guildId } = await request.json();
        
        try {
          const botToken = env.DISCORD_BOT_TOKEN;
          
          if (!botToken) {
            return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
              status: 500,
              headers: corsHeaders
            });
          }
          
          // Fetch roles from Discord API
          const rolesResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/roles`,
            {
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!rolesResponse.ok) {
            const errorText = await rolesResponse.text();
            return new Response(JSON.stringify({ error: 'Discord API error', details: errorText }), {
              status: rolesResponse.status,
              headers: corsHeaders
            });
          }
          
          const roles = await rolesResponse.json();
          
          return new Response(JSON.stringify({ 
            success: true,
            roles: roles.map(role => ({
              id: role.id,
              name: role.name,
              color: role.color
            }))
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed to fetch roles', message: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Change request check endpoint
      if (url.pathname === '/api/change-request/check-approved' && request.method === 'POST') {
        return new Response(JSON.stringify({ hasApproved: false, changes: [] }), { 
          headers: corsHeaders 
        });
      }
      
      // Request status check endpoint
      if (url.pathname === '/api/requests/check-status' && request.method === 'POST') {
        return new Response(JSON.stringify({ hasUpdates: false, requests: [] }), { 
          headers: corsHeaders 
        });
      }
      
      // Absence check approved endpoint
      if (url.pathname === '/api/absence/check-approved' && request.method === 'POST') {
        try {
          const { name, discordId } = await request.json();
          
          // Fetch all absences from Google Sheets
          const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
          
          const processedAbsences = [];
          let hasNewStatuses = false;
          
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            // Column A: Name (or User ID), H: Discord ID
            // Column G: Approval status (Pending, Approved, Rejected, CANCELLED, VOIDED)
            const rowName = row[0];
            const rowDiscordId = row[7]; // Column H
            const absenceStatus = row[6]; // Column G: Approval status
            const startDate = row[1];     // Column B
            const endDate = row[2];       // Column C
            
            // Match by name or Discord ID
            if ((rowName === name || rowDiscordId === discordId) && absenceStatus && absenceStatus !== 'Pending') {
              hasNewStatuses = true;
              processedAbsences.push({
                startDate,
                endDate,
                status: absenceStatus.toLowerCase().includes('approved') ? 'approved' : 'rejected',
                sheets_status: absenceStatus,
                sheets_row: i + 1
              });
            }
          }
          
          console.log('[ABSENCE CHECK] Found', processedAbsences.length, 'processed absences for', name || discordId);
          return new Response(JSON.stringify({ hasNewStatuses, processedAbsences }), { 
            headers: corsHeaders 
          });
        } catch (error) {
          console.error('[ABSENCE CHECK] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Payslips check acknowledged endpoint
      if (url.pathname === '/api/payslips/check-acknowledged' && request.method === 'POST') {
        return new Response(JSON.stringify({ hasPending: false, payslips: [] }), { 
          headers: corsHeaders 
        });
      }
      
      // Disciplinaries check acknowledged endpoint
      if (url.pathname === '/api/disciplinaries/check-acknowledged' && request.method === 'POST') {
        return new Response(JSON.stringify({ hasPending: false, disciplinaries: [] }), { 
          headers: corsHeaders 
        });
      }
      
      // Events removed - was broken
      
      // Debug endpoint to list all sheets
      if (url.pathname === '/api/debug/sheets') {
        try {
          const sheets = ['cirklehrUsers', 'cirklehrStrikes', 'cirklehrAbsences', 'cirklehrReports', 'cirklehrPayslips'];
          const results = {};
          
          for (const sheetName of sheets) {
            try {
              const data = await getSheetsData(env, `${sheetName}!A1:Z10`);
              results[sheetName] = { 
                exists: true, 
                rows: data.length,
                firstRow: data[0] || [],
                sample: data.slice(0, 3)
              };
            } catch (e) {
              results[sheetName] = { exists: false, error: e.message };
            }
          }
          
          return new Response(JSON.stringify(results, null, 2), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders });
        }
      }

      // User/Profile endpoints
      if (url.pathname === '/api/user/profile' && request.method === 'POST') {
        const { discordId } = await request.json();
        const data = await getSheetsData(env, 'cirklehrUsers!A:Z');
        
        // Discord ID is in column D (index 3)
        const userRow = data.find(row => row[3] === discordId);
        
        if (userRow) {
          const discordId = userRow[3];
          const suspended = userRow[7]?.toLowerCase() === 'suspended'; // Column H
          
          // Fetch actual avatar from Discord
          let avatarUrl = null;
          if (discordId && env.DISCORD_BOT_TOKEN) {
            try {
              const discordRes = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
                headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` }
              });
              if (discordRes.ok) {
                const discordUser = await discordRes.json();
                if (discordUser.avatar) {
                  avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png?size=128`;
                }
              }
            } catch (e) {
              console.error('Failed to fetch Discord avatar:', e);
            }
          }
          
          const baseLevel = userRow[10] || '';
          
          return new Response(JSON.stringify({
            success: true,
            profile: {
              name: userRow[0],
              email: userRow[1],
              department: userRow[2],
              discordId: discordId,
              timezone: userRow[4],
              country: userRow[5],
              dateOfSignup: userRow[6],
              utilisation: userRow[7],
              suspended: suspended,
              baseLevel: baseLevel,
              role: baseLevel,
              roles: baseLevel ? [baseLevel] : [],
              avatar: avatarUrl
            }
          }), { headers: corsHeaders });
        }
        
        // User not found - return empty profile (frontend will handle Discord data)
        return new Response(JSON.stringify({ 
          success: true, 
          profile: null,
          message: 'User not in database, using Discord profile',
          debug: { totalRows: data.length, searchedFor: discordId }
        }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/user/upsert' && request.method === 'POST') {
        const user = await request.json();
        const data = await getSheetsData(env, 'cirklehrUsers!A:Z');
        const existingIndex = data.findIndex(row => row[0] === user.discordId);
        
        if (existingIndex >= 0) {
          // Update existing user
          await updateSheets(env, `cirklehrUsers!A${existingIndex + 1}:H${existingIndex + 1}`, [[
            user.discordId,
            user.name || data[existingIndex][1],
            user.email || data[existingIndex][2],
            user.department || data[existingIndex][3],
            user.role || data[existingIndex][4],
            user.country || data[existingIndex][5],
            user.timezone || data[existingIndex][6],
            user.avatar || data[existingIndex][7]
          ]]);
        } else {
          // Create new user
          await appendToSheet(env, 'cirklehrUsers!A:H', [[
            user.discordId,
            user.name || '',
            user.email || '',
            user.department || 'Unassigned',
            user.role || 'Member',
            user.country || '',
            user.timezone || '',
            user.avatar || ''
          ]]);
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Employees hire
      if (url.pathname === '/api/employees/hire' && request.method === 'POST') {
        const emp = await request.json();
        await appendToSheet(env, 'cirklehrUsers!A:H', [[
          emp.discordId,
          emp.name,
          emp.email || '',
          emp.department || 'Unassigned',
          emp.role || 'Member',
          emp.country || '',
          emp.timezone || '',
          emp.avatar || ''
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname.startsWith('/api/user/absences/')) {
        const userId = url.pathname.split('/').pop();
        const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
        const absences = data.slice(1)
          .filter(row => row[7] === userId && row[6] === 'Approved')
          .map(row => ({
            name: row[0],
            startDate: row[1],
            endDate: row[2],
            reason: row[3],
            totalDays: row[4]
          }));
        return new Response(JSON.stringify({ success: true, absences }), { headers: corsHeaders });
      }

      // Payslips fetch
      if (url.pathname === '/api/payslips/fetch' && request.method === 'POST') {
        const body = await request.json();
        const userId = body.userId || body.staffId;
        const data = await getSheetsData(env, 'cirklehrPayslips!A:G');
        const payslips = data.slice(1)
          .filter(row => row[0] === userId)
          .map(row => ({
            userId: row[0],
            period: row[1],
            payPeriod: row[1],
            assignedBy: row[2] || 'Marcus Ray',
            link: row[3],
            url: row[3],
            dateAssigned: row[4],
            timestamp: row[4],
            dateIssued: row[4],
            status: row[5] || 'Issued',
            acknowledged: row[5] === 'Acknowledged'
          }));
        return new Response(JSON.stringify({ success: true, payslips }), { headers: corsHeaders });
      }

      // Disciplinaries fetch
      if (url.pathname === '/api/disciplinaries/fetch' && request.method === 'POST') {
        const body = await request.json();
        const userId = body.userId || body.staffId; // Accept both userId and staffId
        const data = await getSheetsData(env, 'cirklehrStrikes!A:H');
        const disciplinaries = data.slice(1)
          .filter(row => row[0] === userId)
          .map(row => ({
            userId: row[0],
            strikeType: row[2],
            comment: row[3],
            assignedBy: row[4],
            dateAssigned: row[6],
            status: row[7],
            // Also include old field names for compatibility
            type: row[2],
            description: row[3],
            employer: row[4],
            timestamp: row[6]
          }));
        return new Response(JSON.stringify({ success: true, disciplinaries }), { headers: corsHeaders });
      }

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

      // Reports create
      if (url.pathname === '/api/reports/create') {
        const report = await request.json();
        await appendToSheet(env, 'cirklehrReports!A:I', [[
          report.userId || '',           // A: User ID
          '',                            // B: Blank
          report.type || report.reportType || '',  // C: Report type
          report.comment || '',          // D: Comment
          report.scale || '',            // E: Scale
          report.publishedBy || report.employerName || '', // F: Published by
          'Submit',                      // G: Submit status
          new Date().toISOString(),      // H: Timestamp
          ''                             // I: Status
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/reports/check-pending') {
        const data = await getSheetsData(env, 'cirklehrReports!A:I');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          // Check column G for Submit status
          if (data[i][6] === 'Submit') {
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
                        title: '📋 New Report Available',
                        description: `You have a new report!\n\nPlease check the **Staff Portal** to view it.`,
                        color: 0x2196F3,
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
            
            // Mark as processed in column G
            await updateSheets(env, `cirklehrReports!G${i + 1}`, [['Processed']]);
            processed++;
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
      }

      // Events removed - was broken

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
      // Ongoing absences (for Discord /manual-loa)
      if (url.pathname === '/api/absence/ongoing') {
        const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
        const today = new Date();
        const absences = data.slice(1)
          .filter(row => {
            const status = (row[6] || '').toLowerCase();
            const endDate = new Date(row[2]);
            return status === 'approved' && endDate >= today;
          })
          .map((row, index) => ({
            id: `${index + 2}`, // Row number
            username: row[0],
            userId: row[7],
            startDate: row[1],
            endDate: row[2],
            reason: row[3],
            comment: row[5],
            status: row[6],
            approvedBy: row[7],
            isExpired: new Date(row[2]) < today
          }));
        return new Response(JSON.stringify({ success: true, absences }), { headers: corsHeaders });
      }

      // Extend LOA
      if (url.pathname.match(/^\/api\/absence\/\d+\/extend$/)) {
        const rowIndex = parseInt(url.pathname.split('/')[3]);
        const { days, extendedBy } = await request.json();
        
        // Get current end date
        const data = await getSheetsData(env, `cirklehrAbsences!C${rowIndex}`);
        const currentEndDate = new Date(data[0][0]);
        currentEndDate.setDate(currentEndDate.getDate() + parseInt(days));
        
        // Update end date
        await updateSheets(env, `cirklehrAbsences!C${rowIndex}`, [[currentEndDate.toISOString().split('T')[0]]]);
        
        return new Response(JSON.stringify({ success: true, newEndDate: currentEndDate.toISOString() }), { headers: corsHeaders });
      }

      // Void LOA
      if (url.pathname.match(/^\/api\/absence\/\d+\/void$/)) {
        const rowIndex = parseInt(url.pathname.split('/')[3]);
        const { voidedBy } = await request.json();
        
        // Update status to VOIDED
        await updateSheets(env, `cirklehrAbsences!G${rowIndex}`, [['VOIDED']]);
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Fetch user absences
      if (url.pathname.startsWith('/api/user/absences/')) {
        const userId = url.pathname.split('/').pop();
        const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
        const absences = data.slice(1)
          .filter(row => row[7] === userId) // Column H: User ID
          .map(row => ({
            id: `${row[7]}-${row[8]}`, // userId-timestamp as ID
            name: row[0],
            startDate: row[1],
            endDate: row[2],
            type: row[3],
            reason: row[3],
            totalDays: row[4],
            comment: row[5],
            userComment: row[5],
            status: (row[6] || 'Pending').toLowerCase(), // Normalize to lowercase
            approvedBy: row[7],
            timestamp: row[8],
            messageId: null
          }));
        return new Response(JSON.stringify({ success: true, absences }), { headers: corsHeaders });
      }

      // Handle both /api/absence and /api/absence/submit
      if (url.pathname === '/api/absence/submit' || url.pathname === '/api/absence') {
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
          absence.comment || absence.userComment || '',  // F: user comment
          'Pending',                       // G: approved or not
          absence.discordId || absence.userId,  // H: user ID
          new Date().toISOString(),        // I: timestamp
          'Submit'                         // J: status (success/failed submit)
        ]]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      
      // Absence approval
      if (url.pathname === '/api/absence/approve') {
        const { rowIndex, approved, approverId } = await request.json();
        const status = approved ? 'Approved' : 'Rejected';
        
        if (!rowIndex) {
          return new Response(JSON.stringify({ success: false, error: 'rowIndex is required' }), { headers: corsHeaders, status: 400 });
        }
        
        // Get the absence row to find the user ID
        const data = await getSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
        if (!data || !data[0]) {
          return new Response(JSON.stringify({ success: false, error: 'Absence not found' }), { headers: corsHeaders, status: 404 });
        }
        
        const absenceRow = data[0];
        const targetUserId = absenceRow[7]; // Column H: User ID
        const absenceType = absenceRow[2] || 'Absence'; // Column C: Type
        
        console.log(`[ABSENCE] Approving absence for user ${targetUserId}, status: ${status}`);
        
        // Update approval status (Columns G-J)
        await updateSheets(env, `cirklehrAbsences!G${rowIndex}:J${rowIndex}`, [
          [status, approverId || 'System', new Date().toISOString(), '✅ Success']
        ]);
        
        // Send DM notification to the user who requested the absence
        if (targetUserId && env.DISCORD_BOT_TOKEN) {
          try {
            const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: targetUserId })
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
                    description: `Your absence request has been ${status.toLowerCase()}.\n\n Please check the **Staff Portal** for details.`,
                    color: approved ? 0x4caf50 : 0xf44336,
                    footer: { text: 'Portal by Cirkle | https://portal.cirkledevelopment.co.uk' }
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
      
      // Absence cancellation
      if (url.pathname === '/api/absence/cancel' && request.method === 'POST') {
        const { name, startDate, endDate } = await request.json();
        
        try {
          // Find the absence row in Google Sheets
          const data = await getSheetsData(env, 'cirklehrAbsences!A:J');
          
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            // Match by name, startDate, and endDate
            if (row[0] === name && row[1] === startDate && row[2] === endDate) {
              const rowIndex = i + 1; // Sheets are 1-indexed
              
              // Update status column (G) to 'CANCELLED'
              await updateSheets(env, `cirklehrAbsences!G${rowIndex}`, [['CANCELLED']]);
              
              return new Response(JSON.stringify({ success: true, message: 'Absence cancelled in sheets' }), { 
                headers: corsHeaders 
              });
            }
          }
          
          return new Response(JSON.stringify({ success: false, message: 'Absence not found' }), { 
            status: 404,
            headers: corsHeaders 
          });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Payslips
      if (url.pathname === '/api/payslips/check-pending') {
        const data = await getSheetsData(env, 'cirklehrPayslips!A:G');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          // Only process if status is exactly 'Submit', not 'Processed'
          if (data[i][5] === 'Submit' && data[i][6] !== 'Processed') {
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
                        footer: { text: 'Portal by Cirkle | https://portal.cirkledevelopment.co.uk' }
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
      // Requests fetch
      if (url.pathname === '/api/requests/fetch' && request.method === 'POST') {
        const body = await request.json();
        const userId = body.userId || body.staffId;
        const data = await getSheetsData(env, 'cirklehrRequests!A:H');
        const requests = data.slice(1)
          .filter(row => row[3] === userId)
          .map(row => ({
            name: row[0],
            request: row[1],
            userComment: row[2],
            userId: row[3],
            employerName: row[4],
            submitStatus: row[5],
            timestamp: row[6],
            status: row[7],
            // For compatibility
            type: row[1],
            comment: row[2]
          }));
        return new Response(JSON.stringify({ success: true, requests }), { headers: corsHeaders });
      }

      // Requests approval
      if (url.pathname === '/api/requests/approve') {
        const { rowIndex, approved, approverId } = await request.json();
        const status = approved ? 'Approved' : 'Denied';
        
        if (!rowIndex) {
          return new Response(JSON.stringify({ success: false, error: 'rowIndex is required' }), { headers: corsHeaders, status: 400 });
        }
        
        // Get the request row to find user ID
        const data = await getSheetsData(env, `cirklehrRequests!A${rowIndex}:G${rowIndex}`);
        if (!data || !data[0]) {
          return new Response(JSON.stringify({ success: false, error: 'Request not found' }), { headers: corsHeaders, status: 404 });
        }
        
        const requestRow = data[0];
        const targetUserId = requestRow[0] || requestRow[3]; // Column A or D: User ID
        const requestType = requestRow[1]; // Column B: Request type
        
        console.log(`[REQUESTS] Approving request for user ${targetUserId}, type: ${requestType}, status: ${status}`);
        
        // Update status in column F (index 5)
        await updateSheets(env, `cirklehrRequests!F${rowIndex}`, [[status]]);
        
        // Send DM to user
        if (targetUserId && env.DISCORD_BOT_TOKEN) {
          try {
            const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: targetUserId })
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
                    title: approved ? '✅ Request Approved' : '❌ Request Denied',
                    description: `Your request has been ${status.toLowerCase()}.\n\nPlease check the **Staff Portal** for details.`,
                    color: approved ? 0x4caf50 : 0xf44336,
                    footer: { text: 'Portal by Cirkle | https://portal.cirkledevelopment.co.uk' }
                  }]
                })
              });
            }
          } catch (e) {
            console.error('DM error:', e);
          }
        }
        
        return new Response(JSON.stringify({ success: true, status }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/requests/submit') {
        const req = await request.json();
        const userId = req.userId || req.discordId || '';
        const requestType = req.type || req.request || '';
        const comment = req.comment || req.details || req.userComment || '';
        
        await appendToSheet(env, 'cirklehrRequests!A:G', [[
          userId,                   // A: User ID
          requestType,              // B: Request type
          comment,                  // C: Comment/details
          userId,                   // D: User ID (duplicate for reference)
          '',                       // E: Employer name (to be filled by admin)
          'Submit',                 // F: Status (Submit/Approve/Deny)
          new Date().toISOString()  // G: Timestamp
        ]]);
        
        console.log('[REQUESTS] Submitted:', { userId, requestType, comment });
        return new Response(JSON.stringify({ success: true, message: 'Request submitted' }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/requests/check-pending') {
        const data = await getSheetsData(env, 'cirklehrRequests!A:G');
        let processed = 0;
        let errors = [];
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][5]?.toLowerCase() === 'submit') {  // F column: Status
            const userId = data[i][0];  // A: User ID
            const requestType = data[i][1];  // B: Request type
            
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
                        title: `📝 ${requestType} Request Update`,
                        description: `Your **${requestType}** request has been processed.\\n\\nPlease check the **Staff Portal** for details and any required actions.`,
                        color: 0x2196f3,
                        footer: { text: 'portal.cirkledevelopment.co.uk' }
                      }]
                    })
                  });
                }
                
                processed++;
                // Update status to Success
                await updateSheets(env, `cirklehrRequests!F${i + 1}`, [['Success']]);
              } catch (dmError) {
                console.error('DM error for request:', dmError);
                errors.push({ row: i + 1, error: 'DM failed' });
                // Update status to Failed
                await updateSheets(env, `cirklehrRequests!F${i + 1}`, [['Failed']]);
              }
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true, processed, errors }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/requests/fetch') {
        const { userId } = await request.json();
        const data = await getSheetsData(env, 'cirklehrRequests!A:G');
        const requests = data.slice(1)
          .filter(row => row[0] === userId)  // A: User ID
          .map(row => ({
            userId: row[0],           // A
            type: row[1],             // B
            comment: row[2],          // C
            employerName: row[4],     // E
            status: row[5],           // F
            timestamp: row[6]         // G
          }));
        return new Response(JSON.stringify({ success: true, requests }), { headers: corsHeaders });
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
                    footer: { text: 'Portal by Cirkle | https://portal.cirkledevelopment.co.uk' }
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
                        footer: { text: 'Portal by Cirkle | https://portal.cirkledevelopment.co.uk' }
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

      // ============================================================================
      // REPORTS WORKFLOW: Submit → DM + Update Sheets + Portal
      // ============================================================================
      if (url.pathname === '/api/reports/workflow/submit-approval' && request.method === 'POST') {
        const { rowIndex, submitterName } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getSheetsData(env, `cirklehrReports!A${rowIndex}:I${rowIndex}`);
          const row = data[0];
          const userId = row[0];
          const reportType = row[2];
          
          console.log(`[REPORTS] Approving report for user ${userId}, submitted by ${submitterName}`);
          
          // Send DM to user
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '📋 New Report Available',
              description: `You have a new report!\n\nSubmitted by: **${submitterName}**\n\nCheck the **My Reports** tab on the portal.`,
              color: 0x2196F3
            });
          }
          
          // Update Sheets: H=timestamp, I=success status
          await updateSheets(env, `cirklehrReports!H${rowIndex}:I${rowIndex}`, [
            [new Date().toISOString(), '✅ Success']
          ]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          console.error('[REPORTS] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // ============================================================================
      // REQUESTS WORKFLOW: Approve/Reject → DM + Update Sheets + Portal
      // ============================================================================
      if (url.pathname === '/api/requests/workflow/approve' && request.method === 'POST') {
        const { rowIndex, approverName } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
          const row = data[0];
          const userId = row[0];
          
          console.log(`[REQUESTS] Approving request for user ${userId}, approved by ${approverName}`);
          
          // Send DM to user
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '✅ Request Approved',
              description: `Your request has been **approved**!\n\nApproved by: **${approverName}**\n\nCheck the **Requests** tab on the portal.`,
              color: 0x4caf50
            });
          }
          
          // Update Sheets: F=approved, G=timestamp, H=status
          await updateSheets(env, `cirklehrRequests!F${rowIndex}:H${rowIndex}`, [
            ['Approve', new Date().toISOString(), '✅ Success']
          ]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          console.error('[REQUESTS] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if (url.pathname === '/api/requests/workflow/reject' && request.method === 'POST') {
        const { rowIndex, approverName } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
          const row = data[0];
          const userId = row[0];
          
          console.log(`[REQUESTS] Rejecting request for user ${userId}, rejected by ${approverName}`);
          
          // Send DM to user
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '❌ Request Rejected',
              description: `Your request has been **rejected**.\n\nRejected by: **${approverName}**\n\nCheck the **Requests** tab on the portal for details.`,
              color: 0xf44336
            });
          }
          
          // Update Sheets: F=reject, G=timestamp, H=status
          await updateSheets(env, `cirklehrRequests!F${rowIndex}:H${rowIndex}`, [
            ['Reject', new Date().toISOString(), '✅ Success']
          ]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          console.error('[REQUESTS] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // ============================================================================
      // ABSENCES WORKFLOW: Approve/Reject → DM + Update Sheets + Portal
      // ============================================================================
      if (url.pathname === '/api/absences/workflow/approve' && request.method === 'POST') {
        const { rowIndex } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
          const row = data[0];
          const userId = row[0];
          const absenceType = row[2];
          
          console.log(`[ABSENCES] Approving absence for user ${userId}`);
          
          // Send DM to user
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '✅ Absence Approved',
              description: `Your **${absenceType || 'absence'}** request has been **approved**!\n\nCheck the **Absences** tab on the portal.`,
              color: 0x4caf50
            });
          }
          
          // Update Sheets: I=timestamp, J=success status
          await updateSheets(env, `cirklehrAbsences!I${rowIndex}:J${rowIndex}`, [
            [new Date().toISOString(), '✅ Success']
          ]);
          
          // Update column G to Approved
          await updateSheets(env, `cirklehrAbsences!G${rowIndex}`, [['Approved']]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          console.error('[ABSENCES] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if (url.pathname === '/api/absences/workflow/reject' && request.method === 'POST') {
        const { rowIndex } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
          const row = data[0];
          const userId = row[0];
          const absenceType = row[2];
          
          console.log(`[ABSENCES] Rejecting absence for user ${userId}`);
          
          // Send DM to user
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '❌ Absence Rejected',
              description: `Your **${absenceType || 'absence'}** request has been **rejected**.\n\nCheck the **Absences** tab on the portal for details.`,
              color: 0xf44336
            });
          }
          
          // Update Sheets: I=timestamp, J=success status
          await updateSheets(env, `cirklehrAbsences!I${rowIndex}:J${rowIndex}`, [
            [new Date().toISOString(), '✅ Rejected']
          ]);
          
          // Update column G to Rejected
          await updateSheets(env, `cirklehrAbsences!G${rowIndex}`, [['Rejected']]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          console.error('[ABSENCES] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // ============================================================================
      // USER RESET/DELETION: Wipe user from sheets, backend, and portal
      // ============================================================================
      if (url.pathname === '/api/users/workflow/reset' && request.method === 'POST') {
        const { rowIndex, userId } = await request.json();
        if (!rowIndex || !userId) return new Response(JSON.stringify({ error: 'rowIndex and userId required' }), { headers: corsHeaders, status: 400 });
        
        try {
          console.log(`[USER_RESET] Resetting user ${userId} from row ${rowIndex}`);
          
          // Send DM to user BEFORE deletion
          if (userId && env.DISCORD_BOT_TOKEN) {
            await sendDM(env, userId, {
              title: '⚠️ Account Reset',
              description: `Your account has been **reset** and removed from the system.\n\nIf this was a mistake, please contact your administrator.`,
              color: 0xff9800
            });
          }
          
          // Delete user data from cirklehrUsers (clear the row)
          const userRow = Array(15).fill('');
          await updateSheets(env, `cirklehrUsers!A${rowIndex}:O${rowIndex}`, [userRow]);
          
          // Delete from cirklehrPayslips
          const payslipsData = await getSheetsData(env, 'cirklehrPayslips!A:A');
          for (let i = payslipsData.length - 1; i >= 1; i--) {
            if (payslipsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrPayslips', i + 1);
            }
          }
          
          // Delete from cirklehrAbsences
          const absencesData = await getSheetsData(env, 'cirklehrAbsences!A:A');
          for (let i = absencesData.length - 1; i >= 1; i--) {
            if (absencesData[i][0] === userId) {
              await deleteRow(env, 'cirklehrAbsences', i + 1);
            }
          }
          
          // Delete from cirklehrRequests
          const requestsData = await getSheetsData(env, 'cirklehrRequests!A:A');
          for (let i = requestsData.length - 1; i >= 1; i--) {
            if (requestsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrRequests', i + 1);
            }
          }
          
          // Delete from cirklehrReports
          const reportsData = await getSheetsData(env, 'cirklehrReports!A:A');
          for (let i = reportsData.length - 1; i >= 1; i--) {
            if (reportsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrReports', i + 1);
            }
          }
          
          // Delete from cirklehrDisciplinaries
          const disciplinariesData = await getSheetsData(env, 'cirklehrDisciplinaries!A:A');
          for (let i = disciplinariesData.length - 1; i >= 1; i--) {
            if (disciplinariesData[i][0] === userId) {
              await deleteRow(env, 'cirklehrDisciplinaries', i + 1);
            }
          }
          
          console.log(`[USER_RESET] Successfully reset user ${userId}`);
          return new Response(JSON.stringify({ success: true, message: 'User completely reset' }), { headers: corsHeaders });
        } catch (e) {
          console.error('[USER_RESET] Error:', e);
          return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 });
        }
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
  },
  
  // Scheduled handler - runs every 5 minutes
  async scheduled(event, env) {
    console.log('[SCHEDULER] Running scheduled workflow processor');
    
    try {
      // Process report submissions
      const reportsData = await getSheetsData(env, 'cirklehrReports!A:I');
      for (let i = 1; i < reportsData.length; i++) {
        const row = reportsData[i];
        const status = (row[6] || '').trim();  // Column G
        const timestamp = row[7];  // Column H
        
        if (status === 'Submit' && !timestamp) {
          console.log(`[SCHEDULER] Processing report submit at row ${i+1}`);
          const submitterName = row[4] || 'Admin';  // Column E
          await processReportSubmit(env, i + 1, submitterName);
        }
      }
      
      // Process request approvals/rejections
      const requestsData = await getSheetsData(env, 'cirklehrRequests!A:H');
      for (let i = 1; i < requestsData.length; i++) {
        const row = requestsData[i];
        const action = (row[5] || '').trim().toLowerCase();  // Column F
        const timestamp = row[6];  // Column G
        const approverName = row[4] || 'Admin';  // Column E
        
        if ((action === 'approve' || action === 'reject') && !timestamp) {
          console.log(`[SCHEDULER] Processing request ${action} at row ${i+1}`);
          if (action === 'approve') {
            await processRequestApprove(env, i + 1, approverName);
          } else {
            await processRequestReject(env, i + 1, approverName);
          }
        }
      }
      
      // Process absence approvals/rejections
      const absencesData = await getSheetsData(env, 'cirklehrAbsences!A:J');
      for (let i = 1; i < absencesData.length; i++) {
        const row = absencesData[i];
        const action = (row[6] || '').trim().toLowerCase();  // Column G
        const timestamp = row[8];  // Column I
        
        if ((action === 'approved' || action === 'rejected') && !timestamp) {
          console.log(`[SCHEDULER] Processing absence ${action} at row ${i+1}`);
          if (action === 'approved') {
            await processAbsenceApprove(env, i + 1);
          } else {
            await processAbsenceReject(env, i + 1);
          }
        }
      }
      
      console.log('[SCHEDULER] Workflow processing complete');
    } catch (error) {
      console.error('[SCHEDULER] Error:', error);
    }
  }
};

// Google Sheets helpers using REST API
async function getAccessToken(env) {
  // Helper for URL-safe base64
  const base64url = (str) => {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  
  const jwtHeader = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  
  const jwtClaimSet = base64url(JSON.stringify({
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

  const jwt = `${signatureInput}.${base64url(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok) {
    console.error('Token Error:', tokenData);
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  
  return tokenData.access_token;
}

async function getSheetsData(env, range) {
  const token = await getAccessToken(env);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  
  // Debug logging
  if (!response.ok) {
    console.error('Sheets API Error:', data);
    throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  }
  
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

// Send Discord DM with embed
async function sendDM(env, userId, { title, description, color }) {
  if (!env.DISCORD_BOT_TOKEN) return;
  
  try {
    const dmResponse = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: userId })
    });
    
    if (!dmResponse.ok) {
      console.error('[DM] Failed to create channel:', dmResponse.status);
      return;
    }
    
    const channel = await dmResponse.json();
    
    await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          title: title,
          description: description,
          color: color,
          footer: { text: 'Cirkle Development Staff Portal' },
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (e) {
    console.error('[DM] Error:', e);
  }
}

// Delete a row from Sheets
async function deleteRow(env, sheetName, rowIndex) {
  const token = await getAccessToken(env);
  const sheetId = await getSheetId(env, sheetName);
  
  if (!sheetId) {
    console.error(`[DELETE] Sheet ${sheetName} not found`);
    return;
  }
  
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [{
        deleteRange: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          },
          shiftDimension: 'ROWS'
        }
      }]
    })
  });
}

// Get sheet ID by name
async function getSheetId(env, sheetName) {
  const token = await getAccessToken(env);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await response.json();
  const sheet = data.sheets?.find(s => s.properties.title === sheetName);
  return sheet?.properties.sheetId;
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i);
  }
  return buf;
}

// Helper function: Process report submission
async function processReportSubmit(env, rowIndex, submitterName) {
  try {
    const data = await getSheetsData(env, `cirklehrReports!A${rowIndex}:I${rowIndex}`);
    const row = data[0];
    const userId = row[0];
    
    console.log(`[WORKFLOW] Submitting report for user ${userId}`);
    
    if (userId && env.DISCORD_BOT_TOKEN) {
      await sendDM(env, userId, {
        title: '📋 New Report Available',
        description: `You have a new report!\n\nSubmitted by: **${submitterName}**\n\nCheck the **My Reports** tab on the portal.`,
        color: 0x2196F3
      });
    }
    
    await updateSheets(env, `cirklehrReports!H${rowIndex}:I${rowIndex}`, [
      [new Date().toISOString(), '✅ Success']
    ]);
  } catch (e) {
    console.error('[WORKFLOW] Error processing report:', e);
  }
}

// Helper function: Process request approval
async function processRequestApprove(env, rowIndex, approverName) {
  try {
    const data = await getSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
    const row = data[0];
    const userId = row[0];
    
    console.log(`[WORKFLOW] Approving request for user ${userId}`);
    
    if (userId && env.DISCORD_BOT_TOKEN) {
      await sendDM(env, userId, {
        title: '✅ Request Approved',
        description: `Your request has been **approved**!\n\nApproved by: **${approverName}**\n\nCheck the **Requests** tab on the portal.`,
        color: 0x4caf50
      });
    }
    
    await updateSheets(env, `cirklehrRequests!F${rowIndex}:H${rowIndex}`, [
      ['Approve', new Date().toISOString(), '✅ Success']
    ]);
  } catch (e) {
    console.error('[WORKFLOW] Error approving request:', e);
  }
}

// Helper function: Process request rejection
async function processRequestReject(env, rowIndex, approverName) {
  try {
    const data = await getSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
    const row = data[0];
    const userId = row[0];
    
    console.log(`[WORKFLOW] Rejecting request for user ${userId}`);
    
    if (userId && env.DISCORD_BOT_TOKEN) {
      await sendDM(env, userId, {
        title: '❌ Request Rejected',
        description: `Your request has been **rejected**.\n\nRejected by: **${approverName}**\n\nCheck the **Requests** tab on the portal for details.`,
        color: 0xf44336
      });
    }
    
    await updateSheets(env, `cirklehrRequests!F${rowIndex}:H${rowIndex}`, [
      ['Reject', new Date().toISOString(), '✅ Success']
    ]);
  } catch (e) {
    console.error('[WORKFLOW] Error rejecting request:', e);
  }
}

// Helper function: Process absence approval
async function processAbsenceApprove(env, rowIndex) {
  try {
    const data = await getSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
    const row = data[0];
    const discordId = row[7]; // Column H: Discord ID
    const absenceType = row[3]; // Column D: Reason
    const startDate = row[1];   // Column B: Start Date
    
    console.log(`[WORKFLOW] Approving absence for user ${discordId}`);
    
    if (discordId && env.DISCORD_BOT_TOKEN) {
      await sendDM(env, discordId, {
        title: '✅ Absence Approved',
        description: `Your **${absenceType || 'absence'}** request from **${startDate}** has been **approved**!\n\nCheck the **Absences** tab on the portal.`,
        color: 0x4caf50
      });
    }
    
    // Update approval status in columns G-J
    await updateSheets(env, `cirklehrAbsences!G${rowIndex}:J${rowIndex}`, [
      ['Approved', 'System', new Date().toISOString(), '✅ Success']
    ]);
  } catch (e) {
    console.error('[WORKFLOW] Error approving absence:', e);
  }
}

// Helper function: Process absence rejection
async function processAbsenceReject(env, rowIndex) {
  try {
    const data = await getSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
    const row = data[0];
    const discordId = row[7]; // Column H: Discord ID
    const absenceType = row[3]; // Column D: Reason
    const startDate = row[1];   // Column B: Start Date
    
    console.log(`[WORKFLOW] Rejecting absence for user ${discordId}`);
    
    if (discordId && env.DISCORD_BOT_TOKEN) {
      await sendDM(env, discordId, {
        title: '❌ Absence Rejected',
        description: `Your **${absenceType || 'absence'}** request from **${startDate}** has been **rejected**.\n\nCheck the **Absences** tab on the portal for details.`,
        color: 0xf44336
      });
    }
    
    // Update approval status in columns G-J
    await updateSheets(env, `cirklehrAbsences!G${rowIndex}:J${rowIndex}`, [
      ['Rejected', 'System', new Date().toISOString(), '✅ Rejected']
    ]);
  } catch (e) {
    console.error('[WORKFLOW] Error rejecting absence:', e);
  }
}
