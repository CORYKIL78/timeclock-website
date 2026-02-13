/**
 * Cloudflare Worker - Timeclock Backend
 * Backend API for employee management, absences, payslips, disciplinaries, etc.
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
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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

      // ============================================================================
      // ACCOUNTS API: Get comprehensive account details (absences, payslips, disciplinaries, etc.)
      // ============================================================================
      if (url.pathname.startsWith('/api/accounts/') && request.method === 'GET') {
        const userId = url.pathname.split('/api/accounts/')[1];
        
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'Account ID required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        try {
          // Fetch account profile
          const usersData = await getCachedSheetsData(env, 'cirklehrUsers!A1:Z1000');
          const userRow = usersData.find(row => row[3] === userId); // Column D: Discord ID
          
          const profile = userRow ? {
            id: userRow[3] || userId,
            name: userRow[0] || '',
            email: userRow[1] || '',
            department: userRow[2] || '',
            discordId: userRow[3] || '',
            timezone: userRow[4] || '',
            country: userRow[5] || '',
            dateOfSignup: userRow[6] || '',
            utilisation: userRow[7] || '',
            suspended: (userRow[7] || '').toLowerCase() === 'suspended',
            baseLevel: userRow[10] || '',
            role: userRow[10] || ''
          } : null;

          // Fetch absences
          const absencesData = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
          const absences = (absencesData || [])
            .filter(row => row[7] === userId) // Column H: User ID
            .map(row => ({
              id: `${row[7]}-${row[8]}`,
              name: row[0],
              startDate: row[1],
              endDate: row[2],
              reason: row[3],
              totalDays: row[4],
              comment: row[5],
              status: (row[6] || 'Pending').toLowerCase(),
              approvedBy: row[7],
              timestamp: row[8]
            }));

          // Fetch payslips
          const payslipsData = await getCachedSheetsData(env, 'cirklehrPayslips!A3:G1000');
          const payslips = (payslipsData || [])
            .filter(row => row[0] === userId) // Column A: User ID
            .map(row => ({
              userId: row[0],
              period: row[1],
              assignedBy: row[2] || 'HR',
              link: row[3],
              dateAssigned: row[4],
              status: row[5] || 'Issued',
              acknowledged: row[5] === 'Acknowledged'
            }));

          // Fetch disciplinaries
          const disciplinariesData = await getCachedSheetsData(env, 'cirklehrStrikes!A3:H1000');
          const disciplinaries = (disciplinariesData || [])
            .filter(row => row[0] === userId) // Column A: User ID
            .map(row => ({
              userId: row[0],
              strikeType: row[2],
              reason: row[3],
              assignedBy: row[4],
              timestamp: row[6],
              status: row[7]
            }));

          // Fetch requests
          const requestsData = await getCachedSheetsData(env, 'cirklehrRequests!A3:H1000');
          const requests = (requestsData || [])
            .filter(row => row[0] === userId) // Column A: User ID
            .map(row => ({
              type: row[1],
              comment: row[2],
              status: row[5],
              timestamp: row[6]
            }));

          // Fetch reports
          const reportsData = await getCachedSheetsData(env, 'cirklehrReports!A3:I1000');
          const reports = (reportsData || [])
            .filter(row => row[0] === userId) // Column A: User ID
            .map(row => ({
              type: row[2],
              comment: row[3],
              scale: row[4],
              publishedBy: row[5],
              status: row[8] || row[6],
              timestamp: row[7]
            }));

          // Return comprehensive account data
          return new Response(JSON.stringify({
            success: true,
            account: {
              userId: userId,
              profile: profile,
              absences: absences,
              payslips: payslips,
              disciplinaries: disciplinaries,
              requests: requests,
              reports: reports,
              summary: {
                totalAbsences: absences.length,
                approvedAbsences: absences.filter(a => a.status === 'approved').length,
                pendingAbsences: absences.filter(a => a.status === 'pending').length,
                totalDisciplinaries: disciplinaries.length,
                totalPayslips: payslips.length,
                pendingRequests: requests.filter(r => r.status?.toLowerCase() === 'submit').length,
                totalReports: reports.length
              }
            }
          }), { headers: corsHeaders });

        } catch (error) {
          console.error('[ACCOUNTS] Error fetching account:', error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Send Discord DM endpoint (exposed for frontend)
      if (url.pathname === '/api/send-dm' && request.method === 'POST') {
        try {
          const { userId, embed } = await request.json();
          
          if (!userId || !embed) {
            return new Response(JSON.stringify({ success: false, error: 'userId and embed required' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          // Call internal sendDM function
          await sendDM(env, userId, embed);
          
          return new Response(JSON.stringify({ success: true, message: 'DM sent' }), {
            headers: corsHeaders
          });
        } catch (error) {
          console.error('[SEND-DM] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // DEBUG: Dump current absence data
      if (url.pathname === '/api/debug/absences' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrAbsences!A1:J1000');
          return new Response(JSON.stringify({ 
            total: data.length,
            absences: data.map((row, i) => ({
              row: i,
              name: row[0],
              startDate: row[1],
              endDate: row[2],
              reason: row[3],
              totalDays: row[4],
              comment: row[5],
              approvalStatus: row[6],  // Column G - THIS IS KEY
              discordId: row[7],
              timestamp: row[8],
              status: row[9]
            }))
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
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
          const usersData = await getCachedSheetsData(env, 'cirklehrUsers!A1:Z1000');
          
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
          const usersData = await getCachedSheetsData(env, 'cirklehrUsers!A3:Z1000');
          
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
          
          // Fetch absences from Google Sheets (limited to first 1000 rows for performance)
          const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
          
          const processedAbsences = [];
          let hasNewStatuses = false;
          
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            // Column A: Name (or User ID), H: Discord ID
            // Column G: Approval status (Pending, Approved, Rejected, CANCELLED, VOIDED)
            // Column I: Timestamp, Column J: Status (for tracking if user has acknowledged)
            const rowName = row[0];
            const rowDiscordId = row[7]; // Column H
            const absenceStatus = row[6]; // Column G: Approval status
            const startDate = row[1];     // Column B
            const endDate = row[2];       // Column C
            const userAcknowledged = row[9]; // Column J: Used to track if user has been notified
            
            // Match by name or Discord ID
            // Check if status is not empty and not 'Pending'
            const normalizedStatus = (absenceStatus || '').trim().toLowerCase();
            // Only return absences that have been decided (not pending) AND haven't been acknowledged yet
            if ((rowName === name || rowDiscordId === discordId) && normalizedStatus && normalizedStatus !== 'pending' && !userAcknowledged) {
              hasNewStatuses = true;
              // Handle variations: 'Approved', 'Approve', 'Approved', 'APPROVED', etc.
              const isApproved = normalizedStatus.startsWith('approv'); // Matches 'approved' and 'approve'
              processedAbsences.push({
                startDate,
                endDate,
                status: isApproved ? 'approved' : 'rejected',
                sheets_status: absenceStatus,
                sheets_row: i + 2  // Add 2 because data starts from row 2, and arrays are 0-indexed
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
      
      // Mark absence as acknowledged (user has been notified)
      if (url.pathname === '/api/absence/acknowledge' && request.method === 'POST') {
        try {
          const { startDate, endDate, discordId } = await request.json();
          
          if (!startDate || !endDate) {
            return new Response(JSON.stringify({ success: false, error: 'startDate and endDate required' }), { 
              status: 400,
              headers: corsHeaders 
            });
          }
          
          // Fetch all absences from Google Sheets
          const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
          
          // Find the matching absence row
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowStartDate = row[1];
            const rowEndDate = row[2];
            const rowDiscordId = row[7];
            
            if (rowStartDate === startDate && rowEndDate === endDate && rowDiscordId === discordId) {
              // Mark column J as "notified" to prevent re-notification
              await updateSheets(env, `cirklehrAbsences!J${i + 1}:J${i + 1}`, [['notified']]);
              console.log(`[ABSENCE ACK] Marked absence as acknowledged for row ${i + 1}`);
              return new Response(JSON.stringify({ success: true }), { 
                headers: corsHeaders 
              });
            }
          }
          
          return new Response(JSON.stringify({ success: false, error: 'Absence not found' }), { 
            status: 404,
            headers: corsHeaders 
          });
        } catch (error) {
          console.error('[ABSENCE ACK] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Events removed - was broken
      
      // Debug endpoint to list all sheets
      if (url.pathname === '/api/debug/sheets') {
        try {
          const sheets = ['cirklehrUsers', 'cirklehrStrikes', 'cirklehrAbsences', 'cirklehrReports', 'cirklehrPayslips'];
          const results = {};
          
          for (const sheetName of sheets) {
            try {
              const data = await getCachedSheetsData(env, `${sheetName}!A1:Z10`);
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
        const data = await getCachedSheetsData(env, 'cirklehrUsers!A1:Z1000');
        
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
        const data = await getCachedSheetsData(env, 'cirklehrUsers!A1:Z1000');
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
        const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
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
        const data = await getCachedSheetsData(env, 'cirklehrPayslips!A3:G1000');
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
        const data = await getCachedSheetsData(env, 'cirklehrStrikes!A3:H1000');
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
        const data = await getCachedSheetsData(env, 'cirklehrReports!A3:J1000');
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
        try {
          const data = await getCachedSheetsData(env, 'cirklehrReports!A3:I1000');
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
              try {
                await updateSheets(env, `cirklehrReports!G${i + 1}`, [['Processed']]);
                processed++;
              } catch (e) {
                console.error('Error updating sheets:', e);
                errors.push({ row: i + 1, error: 'Update failed' });
              }
            }
          }
          
          return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
        } catch (error) {
          console.error('[REPORTS CHECK-PENDING] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Events removed - was broken

      // Attendance
      if (url.pathname === '/api/attendance/log') {
        const { userIds, meetingName } = await request.json();
        const data = await getCachedSheetsData(env, 'cirklehrAttendance!A3:E1000');
        
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
        const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
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
        const data = await getCachedSheetsData(env, `cirklehrAbsences!C${rowIndex}`);
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
        const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
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

      // Admin fetch all absences endpoint
      if (url.pathname === '/api/admin/absences' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
          
          const absences = (data || []).map((row, index) => {
            const rowIndex = index + 2; // Row 2 is the first data row (index 0)
            return {
              rowIndex: rowIndex,
              name: row[0] || '',           // A: Name
              startDate: row[1] || '',      // B: Start Date
              endDate: row[2] || '',        // C: End Date
              reason: row[3] || '',         // D: Reason
              totalDays: row[4] || 0,       // E: Total Days
              comment: row[5] || '',        // F: Comment
              status: (row[6] || 'pending').toLowerCase(), // G: Approval Status (Pending/Approved/Rejected)
              discordId: row[7] || '',      // H: Discord ID
              timestamp: row[8] || '',      // I: Timestamp
              acknowledgment: row[9] || ''  // J: Acknowledgment
            };
          }).filter(absence => {
            // Filter out empty rows and header rows
            if (!absence.name) return false;
            // Skip header row (contains "Name", "Start Date", etc.)
            if (absence.name === 'Name' || absence.startDate === 'Start Date') return false;
            return true;
          });
          
          return new Response(JSON.stringify({ success: true, absences }), { headers: corsHeaders });
        } catch (error) {
          console.error('[ADMIN] Error fetching absences:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { 
            headers: corsHeaders,
            status: 500
          });
        }
      }
      
      // Absence approval
      // Admin absence update status endpoint
      if (url.pathname === '/api/admin/absence/update-status' && request.method === 'POST') {
        try {
          const { rowIndex, status } = await request.json();
          
          if (!rowIndex || !status) {
            return new Response(JSON.stringify({ success: false, error: 'rowIndex and status required' }), { 
              headers: corsHeaders, 
              status: 400 
            });
          }
          
          // Fetch the absence row to get user info
          const data = await getCachedSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
          if (!data || !data[0]) {
            return new Response(JSON.stringify({ success: false, error: 'Absence not found' }), { 
              headers: corsHeaders, 
              status: 404 
            });
          }
          
          const absenceRow = data[0];
          const discordId = absenceRow[7]; // Column H: Discord ID
          const absenceType = absenceRow[3] || 'Absence'; // Column D: Reason/Type
          const startDate = absenceRow[1]; // Column B
          const endDate = absenceRow[2];   // Column C
          
          console.log(`[ADMIN] Updating absence at row ${rowIndex} to status: ${status}, Discord ID: ${discordId}`);
          
          // Update columns G and I-J (Approval status, Timestamp, Success status)
          // Skip column H (Discord ID) - do not overwrite it
          await updateSheets(env, `cirklehrAbsences!G${rowIndex}:G${rowIndex}`, [[
            status === 'Approved' ? 'Approved' : 'Rejected'
          ]]);
          
          await updateSheets(env, `cirklehrAbsences!I${rowIndex}:J${rowIndex}`, [[
            new Date().toISOString(),
            '✅ Success'
          ]]);
          
          console.log(`[ADMIN] Sheet updated for row ${rowIndex}`);
          
          // Send Discord DM if bot token available
          if (discordId && env.DISCORD_BOT_TOKEN) {
            try {
              const isApproved = status === 'Approved';
              const emoji = isApproved ? '✅' : '❌';
              const statusText = isApproved ? 'approved' : 'rejected';
              const color = isApproved ? 0x00ff00 : 0xff0000;
              
              const dmResult = await sendDM(env, discordId, {
                title: `${emoji} Absence Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
                description: `Your absence request has been ${statusText}!\n\n**Dates:** ${startDate} to ${endDate}\n**Status:** ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
                color: color,
                footer: { text: 'Cirkle Development HR Portal' },
                timestamp: new Date().toISOString()
              });
              console.log(`[ADMIN] DM sent to user ${discordId}, result:`, dmResult);
            } catch (e) {
              console.error('[ADMIN] Failed to send DM:', e);
            }
          } else {
            console.log(`[ADMIN] No DM sent - Discord ID: ${discordId}, Bot token: ${env.DISCORD_BOT_TOKEN ? 'set' : 'NOT SET'}`);
          }
          
          return new Response(JSON.stringify({ success: true, message: `Absence ${status.toLowerCase()}` }), { 
            headers: corsHeaders 
          });
        } catch (error) {
          console.error('[ADMIN] Error updating absence:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { 
            headers: corsHeaders,
            status: 500
          });
        }
      }

      if (url.pathname === '/api/absence/approve') {
        const { rowIndex, approved, approverId } = await request.json();
        const status = approved ? 'Approved' : 'Rejected';
        
        if (!rowIndex) {
          return new Response(JSON.stringify({ success: false, error: 'rowIndex is required' }), { headers: corsHeaders, status: 400 });
        }
        
        // Get the absence row to find the user ID
        const data = await getCachedSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
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
          const data = await getCachedSheetsData(env, 'cirklehrAbsences!A3:J1000');
          
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
        try {
          const data = await getCachedSheetsData(env, 'cirklehrPayslips!A3:G1000');
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
                          description: `Your payslip is ready!\n\nPlease check the **Staff Portal** to view it.`,
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
              
              try {
                await updateSheets(env, `cirklehrPayslips!F${i + 1}:G${i + 1}`, [
                  ['Processed', new Date().toISOString()]
                ]);
                processed++;
              } catch (e) {
                console.error('Error updating sheets:', e);
                errors.push({ row: i + 1, error: 'Update failed' });
              }
            }
          }
          
          return new Response(JSON.stringify({ success: true, processed, errors: errors.length > 0 ? errors : undefined }), { headers: corsHeaders });
        } catch (error) {
          console.error('[PAYSLIPS CHECK-PENDING] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Requests endpoints
      // Requests fetch
      if (url.pathname === '/api/requests/fetch' && request.method === 'POST') {
        const body = await request.json();
        const userId = body.userId || body.staffId;
        const data = await getCachedSheetsData(env, 'cirklehrRequests!A3:H1000');
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
        const data = await getCachedSheetsData(env, `cirklehrRequests!A${rowIndex}:G${rowIndex}`);
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
        try {
          const data = await getCachedSheetsData(env, 'cirklehrRequests!A3:G1000');
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
                          description: `Your **${requestType}** request has been processed.\n\nPlease check the **Staff Portal** for details and any required actions.`,
                          color: 0x2196f3,
                          footer: { text: 'portal.cirkledevelopment.co.uk' }
                        }]
                      })
                    });
                  }
                  
                  processed++;
                  // Update status to Success
                  try {
                    await updateSheets(env, `cirklehrRequests!F${i + 1}`, [['Success']]);
                  } catch (e) {
                    console.error('Error updating sheets:', e);
                  }
                } catch (dmError) {
                  console.error('DM error for request:', dmError);
                  errors.push({ row: i + 1, error: 'DM failed' });
                  // Update status to Failed
                  try {
                    await updateSheets(env, `cirklehrRequests!F${i + 1}`, [['Failed']]);
                  } catch (e) {
                    console.error('Error updating sheets:', e);
                  }
                }
              }
            }
          }
          
          return new Response(JSON.stringify({ success: true, processed, errors }), { headers: corsHeaders });
        } catch (error) {
          console.error('[REQUESTS CHECK-PENDING] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      if (url.pathname === '/api/requests/fetch') {
        const { userId } = await request.json();
        const data = await getCachedSheetsData(env, 'cirklehrRequests!A3:G1000');
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
        try {
          const data = await getCachedSheetsData(env, 'cirklehrStrikes!A3:H1000');
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
        } catch (error) {
          console.error('[DISCIPLINARIES CHECK-PENDING] Error:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // ============================================================================
      // REPORTS WORKFLOW: Submit → DM + Update Sheets + Portal
      // ============================================================================
      if (url.pathname === '/api/reports/workflow/submit-approval' && request.method === 'POST') {
        const { rowIndex, submitterName } = await request.json();
        if (!rowIndex) return new Response(JSON.stringify({ error: 'rowIndex required' }), { headers: corsHeaders, status: 400 });
        
        try {
          const data = await getCachedSheetsData(env, `cirklehrReports!A${rowIndex}:I${rowIndex}`);
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
          const data = await getCachedSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
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
          const data = await getCachedSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
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
          const data = await getCachedSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
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
          const data = await getCachedSheetsData(env, `cirklehrAbsences!A${rowIndex}:J${rowIndex}`);
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
          const payslipsData = await getCachedSheetsData(env, 'cirklehrPayslips!A:A');
          for (let i = payslipsData.length - 1; i >= 1; i--) {
            if (payslipsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrPayslips', i + 1);
            }
          }
          
          // Delete from cirklehrAbsences
          const absencesData = await getCachedSheetsData(env, 'cirklehrAbsences!A:A');
          for (let i = absencesData.length - 1; i >= 1; i--) {
            if (absencesData[i][0] === userId) {
              await deleteRow(env, 'cirklehrAbsences', i + 1);
            }
          }
          
          // Delete from cirklehrRequests
          const requestsData = await getCachedSheetsData(env, 'cirklehrRequests!A:A');
          for (let i = requestsData.length - 1; i >= 1; i--) {
            if (requestsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrRequests', i + 1);
            }
          }
          
          // Delete from cirklehrReports
          const reportsData = await getCachedSheetsData(env, 'cirklehrReports!A:A');
          for (let i = reportsData.length - 1; i >= 1; i--) {
            if (reportsData[i][0] === userId) {
              await deleteRow(env, 'cirklehrReports', i + 1);
            }
          }
          
          // Delete from cirklehrDisciplinaries
          const disciplinariesData = await getCachedSheetsData(env, 'cirklehrDisciplinaries!A:A');
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

      // ============================================================================
      // ADMIN DASHBOARD ENDPOINTS
      // ============================================================================

      // Admin: Get all users from sheets
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrUsers!A3:Z1000');
          const users = (data || [])
            .filter(row => row[0] && row[0] !== 'Name' && row[3])
            .map((row, index) => ({
              rowIndex: index + 3,
              name: row[0] || '',
              email: row[1] || '',
              department: row[2] || '',
              discordId: row[3] || '',
              timezone: row[4] || '',
              country: row[5] || '',
              dateOfSignup: row[6] || '',
              utilisation: row[7] || '',
              suspended: (row[7] || '').toLowerCase() === 'suspended',
              points: parseInt(row[8]) || 0,
              baseLevel: row[10] || ''
            }));

          // Batch fetch Discord avatars
          const enriched = [];
          for (const user of users) {
            if (user.discordId && env.DISCORD_BOT_TOKEN) {
              try {
                const res = await fetch(`https://discord.com/api/v10/users/${user.discordId}`, {
                  headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` }
                });
                if (res.ok) {
                  const d = await res.json();
                  user.avatar = d.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${d.avatar}.png?size=128`
                    : null;
                  user.discordName = d.global_name || d.username;
                }
              } catch (e) {}
            }
            enriched.push(user);
          }

          return new Response(JSON.stringify({ success: true, users: enriched }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Get all requests
      if (url.pathname === '/api/admin/requests' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrRequests!A3:H1000');
          const requests = (data || [])
            .filter(row => row[0] && row[0] !== 'User ID' && row[0] !== 'Name')
            .map((row, index) => ({
              rowIndex: index + 3,
              name: row[0] || '',
              type: row[1] || '',
              request: row[1] || '',
              comment: row[2] || '',
              userComment: row[2] || '',
              userId: row[3] || row[0] || '',
              employerName: row[4] || '',
              status: row[5] || 'Pending',
              timestamp: row[6] || '',
              statusDetail: row[7] || ''
            }));
          return new Response(JSON.stringify({ success: true, requests }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Update request status with reason
      if (url.pathname === '/api/admin/requests/update-status' && request.method === 'POST') {
        try {
          const { rowIndex, approved, reason, approver } = await request.json();
          if (!rowIndex) return new Response(JSON.stringify({ success: false, error: 'rowIndex required' }), { status: 400, headers: corsHeaders });

          const status = approved ? 'Approved' : 'Denied';
          const data = await getCachedSheetsData(env, `cirklehrRequests!A${rowIndex}:H${rowIndex}`);
          const row = data[0];
          const targetUserId = row ? (row[3] || row[0]) : null;

          await updateSheets(env, `cirklehrRequests!E${rowIndex}:H${rowIndex}`, [[
            approver || '', status, new Date().toISOString(), reason ? `${status} by ${approver || 'Admin'} - ${reason}` : `${status} by ${approver || 'Admin'}`
          ]]);

          if (targetUserId && env.DISCORD_BOT_TOKEN) {
            try {
              await sendDM(env, targetUserId, {
                title: approved ? '✅ Request Approved' : '❌ Request Denied',
                description: `Your request has been **${status.toLowerCase()}** by ${approver || 'Admin'}.${reason ? `\n\n**Reason:** ${reason}` : ''}`,
                color: approved ? 0x22c55e : 0xef4444
              });
            } catch (e) { console.error('[ADMIN] DM error:', e); }
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Get all payslips
      if (url.pathname === '/api/admin/payslips' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrPayslips!A3:G1000');
          const payslips = (data || [])
            .filter(row => row[0] && row[0] !== 'User ID')
            .map((row, index) => ({
              rowIndex: index + 3,
              userId: row[0] || '',
              period: row[1] || '',
              assignedBy: row[2] || '',
              link: row[3] || '',
              dateAssigned: row[4] || '',
              status: row[5] || 'Issued'
            }));
          return new Response(JSON.stringify({ success: true, payslips }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Create payslip
      if (url.pathname === '/api/admin/payslips/create' && request.method === 'POST') {
        try {
          const { userId, period, link, comment, assignedBy } = await request.json();
          if (!userId || !link) return new Response(JSON.stringify({ success: false, error: 'userId and link required' }), { status: 400, headers: corsHeaders });

          await appendToSheet(env, 'cirklehrPayslips!A:G', [[
            userId,
            period || '',
            assignedBy || 'Admin',
            link,
            new Date().toISOString(),
            'Submit',
            comment || ''
          ]]);

          // Send DM
          if (env.DISCORD_BOT_TOKEN) {
            try {
              await sendDM(env, userId, {
                title: '💰 New Payslip Available',
                description: `Your payslip for **${period || 'this period'}** is ready!\n\nIssued by: ${assignedBy || 'Admin'}\n\nCheck the Staff Portal to view it.`,
                color: 0x22c55e
              });
            } catch (e) {}
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Get all reports
      if (url.pathname === '/api/admin/reports' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrReports!A3:I1000');
          const reports = (data || [])
            .filter(row => row[0] && row[0] !== 'User ID')
            .map((row, index) => ({
              rowIndex: index + 3,
              userId: row[0] || '',
              type: row[2] || '',
              comment: row[3] || '',
              scale: row[4] || '',
              publishedBy: row[5] || '',
              status: row[8] || row[6] || '',
              timestamp: row[7] || row[6] || ''
            }));
          return new Response(JSON.stringify({ success: true, reports }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Get all strikes/disciplinaries
      if (url.pathname === '/api/admin/strikes' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrStrikes!A3:H1000');
          const strikes = (data || [])
            .filter(row => row[0] && row[0] !== 'User ID')
            .map((row, index) => ({
              rowIndex: index + 3,
              userId: row[0] || '',
              strikeType: row[2] || '',
              reason: row[3] || '',
              comment: row[3] || '',
              assignedBy: row[4] || '',
              status: row[5] || '',
              timestamp: row[6] || '',
              successStatus: row[7] || ''
            }));
          return new Response(JSON.stringify({ success: true, strikes }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Admin: Update user profile fields
      if (url.pathname === '/api/admin/user/update' && request.method === 'POST') {
        try {
          const { discordId, department, baseLevel, utilisation, name, email, timezone, country } = await request.json();
          if (!discordId) return new Response(JSON.stringify({ success: false, error: 'discordId required' }), { status: 400, headers: corsHeaders });

          const data = await getCachedSheetsData(env, 'cirklehrUsers!A3:Z1000');
          let rowIdx = -1;
          for (let i = 0; i < data.length; i++) {
            if (data[i][3] === discordId) { rowIdx = i; break; }
          }
          if (rowIdx === -1) return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: corsHeaders });

          const sheetRow = rowIdx + 3;
          const current = data[rowIdx];

          // Update fields that were provided
          if (name !== undefined) await updateSheets(env, `cirklehrUsers!A${sheetRow}`, [[name]]);
          if (email !== undefined) await updateSheets(env, `cirklehrUsers!B${sheetRow}`, [[email]]);
          if (department !== undefined) await updateSheets(env, `cirklehrUsers!C${sheetRow}`, [[department]]);
          if (timezone !== undefined) await updateSheets(env, `cirklehrUsers!E${sheetRow}`, [[timezone]]);
          if (country !== undefined) await updateSheets(env, `cirklehrUsers!F${sheetRow}`, [[country]]);
          if (utilisation !== undefined) await updateSheets(env, `cirklehrUsers!H${sheetRow}`, [[utilisation]]);
          if (baseLevel !== undefined) await updateSheets(env, `cirklehrUsers!K${sheetRow}`, [[baseLevel]]);

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Discord user lookup (for admin login)
      if (url.pathname.startsWith('/api/discord/user/') && request.method === 'GET') {
        const userId = url.pathname.split('/api/discord/user/')[1];
        if (!userId || !env.DISCORD_BOT_TOKEN) {
          return new Response(JSON.stringify({ error: 'Not available' }), { status: 400, headers: corsHeaders });
        }
        try {
          const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` }
          });
          if (!res.ok) return new Response(JSON.stringify({ error: 'Discord lookup failed' }), { status: res.status, headers: corsHeaders });
          const d = await res.json();
          return new Response(JSON.stringify({
            id: d.id,
            username: d.username,
            global_name: d.global_name,
            avatar: d.avatar,
            avatar_url: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=128` : null
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Stub endpoints to prevent 404 errors
      if (url.pathname.startsWith('/roles/')) {
        return new Response(JSON.stringify({ roles: [] }), { headers: corsHeaders });
      }
      if (url.pathname === '/api/user-status') {
        return new Response(JSON.stringify({ status: 'active' }), { headers: corsHeaders });
      }

      // ===========================================
      // EMAIL API - Cirkle Mail using Resend
      // ===========================================
      
      // Send email via Resend
      if (url.pathname === '/api/email/send' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { from, to, cc, bcc, subject, html, replyTo } = body;
          
          if (!from || !to || !subject) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: from,
              to: Array.isArray(to) ? to : to.split(',').map(e => e.trim()),
              cc: cc ? (Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim())) : undefined,
              bcc: bcc ? (Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim())) : undefined,
              subject: subject,
              html: html || '<p>No content</p>',
              reply_to: replyTo
            })
          });
          
          const result = await resendResponse.json();
          
          if (!resendResponse.ok) {
            return new Response(JSON.stringify({ success: false, error: result.message || 'Failed to send email' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          // Store in sent emails sheet
          const senderEmail = from.match(/<(.+)>/)?.[1] || from;
          await appendToSheet(env, 'cirklehrEmails!A:H', [[
            result.id,
            senderEmail,
            Array.isArray(to) ? to.join(',') : to,
            subject,
            html || '',
            new Date().toISOString(),
            'sent',
            ''
          ]]);
          
          return new Response(JSON.stringify({ success: true, id: result.id }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Get inbox for user
      if (url.pathname.startsWith('/api/email/inbox/') && request.method === 'GET') {
        try {
          const userEmail = url.pathname.split('/api/email/inbox/')[1];
          const data = await getCachedSheetsData(env, 'cirklehrEmails!A3:H1000');
          
          const inbox = (data || [])
            .filter(row => row[2] && row[2].toLowerCase().includes(userEmail.toLowerCase()) && row[6] !== 'sent')
            .map(row => ({
              id: row[0],
              from: row[1],
              to: row[2],
              subject: row[3],
              body: row[4],
              timestamp: row[5],
              status: row[6],
              read: row[7] === 'true'
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          return new Response(JSON.stringify({ success: true, emails: inbox }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, emails: [] }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Get sent emails for user
      if (url.pathname.startsWith('/api/email/sent/') && request.method === 'GET') {
        try {
          const userEmail = url.pathname.split('/api/email/sent/')[1];
          const data = await getCachedSheetsData(env, 'cirklehrEmails!A3:H1000');
          
          const sent = (data || [])
            .filter(row => row[1] && row[1].toLowerCase().includes(userEmail.toLowerCase()) && row[6] === 'sent')
            .map(row => ({
              id: row[0],
              from: row[1],
              to: row[2],
              subject: row[3],
              body: row[4],
              timestamp: row[5],
              status: row[6]
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          return new Response(JSON.stringify({ success: true, emails: sent }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, emails: [] }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Save draft
      if (url.pathname === '/api/email/draft' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, to, cc, bcc, subject, html } = body;
          
          const draftId = `draft_${Date.now()}`;
          await appendToSheet(env, 'cirklehrEmailDrafts!A:G', [[
            draftId,
            discordId,
            to || '',
            cc || '',
            bcc || '',
            subject || '',
            html || '',
            new Date().toISOString()
          ]]);
          
          return new Response(JSON.stringify({ success: true, draftId }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Get drafts for user
      if (url.pathname.startsWith('/api/email/drafts/') && request.method === 'GET') {
        try {
          const discordId = url.pathname.split('/api/email/drafts/')[1];
          const data = await getCachedSheetsData(env, 'cirklehrEmailDrafts!A3:H1000');
          
          const drafts = (data || [])
            .filter(row => row[1] === discordId)
            .map(row => ({
              id: row[0],
              discordId: row[1],
              to: row[2],
              cc: row[3],
              bcc: row[4],
              subject: row[5],
              body: row[6],
              timestamp: row[7]
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          return new Response(JSON.stringify({ success: true, drafts }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, drafts: [] }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Get user's staff email
      if (url.pathname.startsWith('/api/email/account/') && request.method === 'GET') {
        try {
          const discordId = url.pathname.split('/api/email/account/')[1];
          const usersData = await getCachedSheetsData(env, 'cirklehrUsers!A3:Z1000');
          
          // Find user
          const userRow = (usersData || []).find(row => row[0] === discordId);
          if (!userRow) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }
          
          // Generate email from name (first and last name)
          const name = userRow[2] || userRow[1] || 'user';
          const nameParts = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
          let emailLocal = nameParts.length > 1 
            ? nameParts[0] + nameParts[nameParts.length - 1]
            : nameParts[0];
          if (!emailLocal) emailLocal = discordId;
          
          const staffEmail = `${emailLocal}@staff.cirkledevelopment.co.uk`;
          
          return new Response(JSON.stringify({ 
            success: true, 
            email: staffEmail,
            displayName: name,
            discordId
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ===========================================
      // CALENDAR API
      // ===========================================
      
      // Get calendar events
      if (url.pathname === '/api/calendar/events' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrCalendar!A3:G1000');
          
          const events = (data || []).map((row, idx) => ({
            id: row[0] || `event_${idx}`,
            date: row[1],
            title: row[2],
            description: row[3],
            type: row[4],
            createdBy: row[5],
            createdAt: row[6]
          }));
          
          return new Response(JSON.stringify({ success: true, events }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, events: [] }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Add calendar event (admin only)
      if (url.pathname === '/api/calendar/events' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { date, title, description, type, createdBy } = body;
          
          if (!date || !title) {
            return new Response(JSON.stringify({ success: false, error: 'Date and title required' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const eventId = `event_${Date.now()}`;
          await appendToSheet(env, 'cirklehrCalendar!A:G', [[
            eventId,
            date,
            title,
            description || '',
            type || 'event',
            createdBy || 'admin',
            new Date().toISOString()
          ]]);
          
          // Log admin action
          await appendToSheet(env, 'cirklehrAdminLogs!A:E', [[
            new Date().toISOString(),
            createdBy || 'admin',
            'calendar_event_added',
            `Added event "${title}" on ${date}`,
            eventId
          ]]);
          
          return new Response(JSON.stringify({ success: true, eventId }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ===========================================
      // ADMIN ACTIVITY LOGS
      // ===========================================
      
      // Get admin logs
      if (url.pathname === '/api/admin/logs' && request.method === 'GET') {
        try {
          const data = await getCachedSheetsData(env, 'cirklehrAdminLogs!A3:E1000');
          
          const logs = (data || []).map(row => ({
            timestamp: row[0],
            adminId: row[1],
            action: row[2],
            details: row[3],
            targetId: row[4]
          })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          return new Response(JSON.stringify({ success: true, logs }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, logs: [] }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      // Add admin log entry
      if (url.pathname === '/api/admin/logs' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { adminId, action, details, targetId } = body;
          
          await appendToSheet(env, 'cirklehrAdminLogs!A:E', [[
            new Date().toISOString(),
            adminId || 'unknown',
            action || 'unknown_action',
            details || '',
            targetId || ''
          ]]);
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
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
  // DISABLED: Google Sheets integration has been removed
  async scheduled(event, env) {
    console.log('[SCHEDULER] Scheduled handler disabled - use API endpoints instead');
    // Migration Note: Scheduled tasks now handled by application events or external triggers
  }
};

// Helper function: Get Google Sheets access token
async function getGoogleAccessToken(env) {
  const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = env.GOOGLE_CLIENT_EMAIL;
  
  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google credentials');
  }
  
  // Create JWT
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(header)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimB64 = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(claim)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${claimB64}`;
  
  // Import private key and sign
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Failed to get Google access token');
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Helper function: Get data from Google Sheets with caching
async function getCachedSheetsData(env, range) {
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID || '1kfW45cOFnA2Uv2FQ3YhE3DFQ7vLLHAV-dV9kW2xG1Zc';
  const accessToken = await getGoogleAccessToken(env);
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sheets API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.values || [];
}

// Helper function: Append data to Google Sheets
async function appendToSheet(env, range, values) {
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID || '1kfW45cOFnA2Uv2FQ3YhE3DFQ7vLLHAV-dV9kW2xG1Zc';
  const accessToken = await getGoogleAccessToken(env);
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sheets append error: ${response.status} - ${error}`);
  }
  
  return await response.json();
}

// Helper function: Update a cell in Google Sheets
async function updateSheetCell(env, range, value) {
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID || '1kfW45cOFnA2Uv2FQ3YhE3DFQ7vLLHAV-dV9kW2xG1Zc';
  const accessToken = await getGoogleAccessToken(env);
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [[value]] })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sheets update error: ${response.status} - ${error}`);
  }
  
  return await response.json();
}

// Helper function: Send Discord DM with embed
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
