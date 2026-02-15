/**
 * Cloudflare Worker - Timeclock Backend
 * Uses KV Storage for all data (no external APIs except Discord & Resend)
 */

const GENERAL_LOG_CHANNEL = '1472640182170943812';

async function postDiscordEmbed(env, channelId, embed) {
  if (!env?.DISCORD_BOT_TOKEN || !channelId) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.error('[DISCORD-LOG]', error);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || 'https://portal.cirkledevelopment.co.uk';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ============================================================================
      // HEALTH CHECK
      // ============================================================================
      if (url.pathname === '/api/status') {
        return new Response(JSON.stringify({
          status: 'ok',
          worker: 'ok',
          storage: 'kv',
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders });
      }

      // ============================================================================
      // USER DATA ENDPOINTS
      // ============================================================================

      // Get full account info (with all related data)
      if (url.pathname.startsWith('/api/accounts/')) {
        const userId = url.pathname.split('/api/accounts/')[1];
        const accountKey = `user:${userId}`;
        const account = await env.DATA.get(accountKey, 'json');

        if (!account) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // Fetch all related data from KV
        const absencesKey = `absences:${userId}`;
        const payslipsKey = `payslips:${userId}`;
        const disciplinariesKey = `disciplinaries:${userId}`;
        const reportsKey = `reports:${userId}`;
        const requestsKey = `requests:${userId}`;

        const [absences, payslips, disciplinaries, reports, requests] = await Promise.all([
          env.DATA.get(absencesKey, 'json'),
          env.DATA.get(payslipsKey, 'json'),
          env.DATA.get(disciplinariesKey, 'json'),
          env.DATA.get(reportsKey, 'json'),
          env.DATA.get(requestsKey, 'json')
        ]);

        // Merge all data into response
        const fullAccount = {
          ...account,
          absences: absences || [],
          payslips: payslips || [],
          disciplinaries: disciplinaries || [],
          reports: reports || [],
          requests: requests || []
        };

        return new Response(JSON.stringify(fullAccount), { headers: corsHeaders });
      }

      // Get user profile (MUST exclude /api/user/profile/update path)
      if (url.pathname.startsWith('/api/user/profile/') && !url.pathname.includes('update')) {
        const userId = url.pathname.split('/api/user/profile/')[1];
        const profileKey = `profile:${userId}`;
        const profile = await env.DATA.get(profileKey, 'json');

        if (!profile) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(profile), { headers: corsHeaders });
      }

      // Get user absences
      if (url.pathname.startsWith('/api/user/absences/')) {
        const userId = url.pathname.split('/api/user/absences/')[1];
        const absencesKey = `absences:${userId}`;
        const absences = await env.DATA.get(absencesKey, 'json') || [];

        return new Response(JSON.stringify(absences), { headers: corsHeaders });
      }

      // Fetch user profile by Discord ID (POST)
      if (url.pathname === '/api/user/profile' && request.method === 'POST') {
        const body = await request.json();
        const { discordId } = body;

        if (!discordId) {
          return new Response(JSON.stringify({ error: 'Missing discordId' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const profileKey = `profile:${discordId}`;
        const profile = await env.DATA.get(profileKey, 'json');

        if (!profile) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(profile), { headers: corsHeaders });
      }

      // Update user profile (PUT or POST to /api/user/profile/update)
      if ((url.pathname === '/api/user/profile/update' || url.pathname === '/api/profile/update') && request.method === 'POST') {
        const body = await request.json();
        const { discordId, name, email, department, staffId, timezone, country } = body;

        if (!discordId) {
          return new Response(JSON.stringify({ error: 'Missing discordId' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const profileKey = `profile:${discordId}`;
        const existingProfile = await env.DATA.get(profileKey, 'json') || {};

        console.log(`[PROFILE UPDATE] Updating profile for ${discordId}`, { name, email, department, staffId });
        console.log(`[PROFILE UPDATE] Existing profile:`, existingProfile);

        // Update profile with new values (use !== undefined to allow empty strings)
        const updatedProfile = {
          ...existingProfile,
          id: discordId,
          name: name !== undefined ? name : existingProfile.name,
          email: email !== undefined ? email : existingProfile.email,
          department: department !== undefined ? department : existingProfile.department,
          staffId: staffId !== undefined ? staffId : existingProfile.staffId,
          timezone: timezone !== undefined ? timezone : existingProfile.timezone,
          country: country !== undefined ? country : existingProfile.country,
          discordTag: existingProfile.discordTag,
          discordId: discordId,
          avatar: existingProfile.avatar,
          updatedAt: new Date().toISOString()
        };

        console.log(`[PROFILE UPDATE] Updated profile:`, updatedProfile);

        // Save updated profile to KV
        await env.DATA.put(profileKey, JSON.stringify(updatedProfile));

        // Also update the user account entry
        const accountKey = `user:${discordId}`;
        const existingAccount = await env.DATA.get(accountKey, 'json') || {};
        const updatedAccount = {
          ...existingAccount,
          id: discordId,
          profile: updatedProfile,
          updatedAt: new Date().toISOString()
        };
        await env.DATA.put(accountKey, JSON.stringify(updatedAccount));
        
        // Add user to index if not already there
        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(discordId)) {
          usersIndex.push(discordId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
          console.log(`[PROFILE UPDATE] Added user ${discordId} to index`);
        }

        return new Response(JSON.stringify({
          success: true,
          profile: updatedProfile,
          message: 'Profile updated successfully'
        }), { headers: corsHeaders });
      }

      // Get user status (suspension check)
      if (url.pathname === '/api/user-status' && request.method === 'POST') {
        const body = await request.json();
        const { discordId } = body;

        if (!discordId) {
          return new Response(JSON.stringify({ error: 'Missing discordId' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const profileKey = `profile:${discordId}`;
        const profile = await env.DATA.get(profileKey, 'json');

        if (!profile) {
          return new Response(JSON.stringify({ 
            suspended: false,
            exists: false  
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({
          suspended: profile.suspended === true,
          exists: true,
          utilisation: profile.utilisation || 'Active'
        }), { headers: corsHeaders });
      }

      // Submit absence from staff portal (matches script.js payload format)
      if (url.pathname === '/api/absence' && request.method === 'POST') {
        const body = await request.json();
        const { discordId, name, startDate, endDate, reason, totalDays, comment } = body;

        if (!discordId || !startDate || !reason) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const absence = {
          id: `absence_${Date.now()}`,
          userId: discordId,
          name: name || 'Unknown User',
          startDate,
          endDate: endDate || startDate,
          type: reason, // "reason" field from script.js is actually the type (e.g., "sick")
          reason: comment || '',
          comment: comment || '',
          days: totalDays || '1',
          status: 'pending',
          submittedAt: new Date().toISOString(),
          approvedAt: null,
          approvedBy: null
        };

        const absencesKey = `absences:${discordId}`;
        const absences = await env.DATA.get(absencesKey, 'json') || [];
        absences.push(absence);
        await env.DATA.put(absencesKey, JSON.stringify(absences));

        // Ensure user is in the index so admins can see this absence
        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(discordId)) {
          usersIndex.push(discordId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
        }

        await postDiscordEmbed(env, GENERAL_LOG_CHANNEL, {
          title: 'New Absence Request',
          color: 0xf59e0b,
          fields: [
            { name: 'User', value: `${name || 'Unknown'} (${discordId})`, inline: false },
            { name: 'Type', value: reason || 'N/A', inline: true },
            { name: 'Start', value: startDate || 'N/A', inline: true },
            { name: 'End', value: endDate || startDate || 'N/A', inline: true },
            { name: 'Days', value: totalDays ? String(totalDays) : '1', inline: true },
            { name: 'Comment', value: comment || 'N/A', inline: false }
          ],
          timestamp: new Date().toISOString()
        });

        return new Response(JSON.stringify({ success: true, absence }), { headers: corsHeaders });
      }

      // Create absence request (alternative endpoint for different payload format)
      if (url.pathname === '/api/absence/create' && request.method === 'POST') {
        const body = await request.json();
        const { userId, startDate, endDate, reason, type } = body;

        if (!userId || !startDate || !reason) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const absence = {
          id: `absence:${userId}:${Date.now()}`,
          userId,
          startDate,
          endDate: endDate || startDate,
          reason,
          type: type || 'sick',
          status: 'pending',
          createdAt: new Date().toISOString(),
          approvedAt: null,
          approvedBy: null
        };

        const absencesKey = `absences:${userId}`;
        const absences = await env.DATA.get(absencesKey, 'json') || [];
        absences.push(absence);
        await env.DATA.put(absencesKey, JSON.stringify(absences));

        return new Response(JSON.stringify({ success: true, absence }), { headers: corsHeaders });
      }

      // Check if absence is approved
      if (url.pathname === '/api/absence/check-approved' && request.method === 'POST') {
        const body = await request.json();
        const { userId, absenceId } = body;

        if (!userId || !absenceId) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const absencesKey = `absences:${userId}`;
        const absences = await env.DATA.get(absencesKey, 'json') || [];
        const absence = absences.find(a => a.id === absenceId);

        if (!absence) {
          return new Response(JSON.stringify({ approved: false, error: 'Not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({
          approved: absence.status === 'approved',
          status: absence.status,
          absence
        }), { headers: corsHeaders });
      }

      // ============================================================================
      // PAYSLIPS
      // ============================================================================

      if (url.pathname === '/api/payslips/fetch' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const payslipsKey = `payslips:${userId}`;
        const payslips = await env.DATA.get(payslipsKey, 'json') || [];

        return new Response(JSON.stringify({ success: true, payslips }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/payslips/check-pending' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ pending: [] }), { headers: corsHeaders });
        }

        const payslipsKey = `payslips:${userId}`;
        const payslips = await env.DATA.get(payslipsKey, 'json') || [];
        const pending = payslips.filter(p => p.status === 'pending');

        return new Response(JSON.stringify({ pending }), { headers: corsHeaders });
      }

      // ============================================================================
      // DISCIPLINARIES (Strikes)
      // ============================================================================

      if (url.pathname === '/api/disciplinaries/fetch' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const disciplinariesKey = `disciplinaries:${userId}`;
        const disciplinaries = await env.DATA.get(disciplinariesKey, 'json') || [];

        return new Response(JSON.stringify({ success: true, disciplinaries }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/disciplinaries/create' && request.method === 'POST') {
        const body = await request.json();
        const { userId, strikeType, reason, employer, customPoints, employerId, employerAvatar } = body;

        if (!userId || !reason) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const disciplinary = {
          id: `strike:${userId}:${Date.now()}`,
          userId,
          strikeType: strikeType || 'Disciplinary',
          reason,
          comment: reason,
          assignedBy: employer || 'OC Director',
          assignedById: employerId || null,
          assignedByAvatar: employerAvatar || null,
          dateAssigned: new Date().toISOString(),
          customPoints: customPoints || null,
          status: 'active'
        };

        const disciplinariesKey = `disciplinaries:${userId}`;
        const disciplinaries = await env.DATA.get(disciplinariesKey, 'json') || [];
        disciplinaries.push(disciplinary);
        await env.DATA.put(disciplinariesKey, JSON.stringify(disciplinaries));

        // Ensure user is in the index so admins can see this disciplinary
        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(userId)) {
          usersIndex.push(userId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
        }

        return new Response(JSON.stringify({ success: true, disciplinary }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/disciplinaries/check-pending' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ pending: [] }), { headers: corsHeaders });
        }

        const disciplinariesKey = `disciplinaries:${userId}`;
        const disciplinaries = await env.DATA.get(disciplinariesKey, 'json') || [];
        const pending = disciplinaries.filter(d => d.status === 'pending');

        return new Response(JSON.stringify({ pending }), { headers: corsHeaders });
      }

      // ============================================================================
      // REPORTS
      // ============================================================================

      if (url.pathname === '/api/reports/fetch' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const reportsKey = `reports:${userId}`;
        const reports = await env.DATA.get(reportsKey, 'json') || [];

        return new Response(JSON.stringify({ success: true, reports }), { headers: corsHeaders });
      }

      // ============================================================================
      // REQUESTS (Time-off, etc)
      // ============================================================================

      if (url.pathname === '/api/requests/fetch' && request.method === 'POST') {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const requestsKey = `requests:${userId}`;
        const requests = await env.DATA.get(requestsKey, 'json') || [];

        return new Response(JSON.stringify({ success: true, requests }), { headers: corsHeaders });
      }

      // Submit request (create new request)
      if (url.pathname === '/api/requests/submit' && request.method === 'POST') {
        const body = await request.json();
        const { userId, type, comment, details } = body;

        if (!userId || !type) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const request_item = {
          id: `request:${userId}:${Date.now()}`,
          userId,
          type,
          comment: comment || details || '',
          details: comment || details || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          reviewedAt: null,
          reviewedBy: null
        };

        const requestsKey = `requests:${userId}`;
        const requests = await env.DATA.get(requestsKey, 'json') || [];
        requests.push(request_item);
        await env.DATA.put(requestsKey, JSON.stringify(requests));

        // Ensure user is in the index so admins can see this request
        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(userId)) {
          usersIndex.push(userId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
        }

        await postDiscordEmbed(env, GENERAL_LOG_CHANNEL, {
          title: 'New Request Submitted',
          color: 0x3b82f6,
          fields: [
            { name: 'User', value: userId, inline: false },
            { name: 'Type', value: type || 'N/A', inline: true },
            { name: 'Details', value: comment || details || 'N/A', inline: false }
          ],
          timestamp: new Date().toISOString()
        });

        return new Response(JSON.stringify({ success: true, request: request_item }), { headers: corsHeaders });
      }

      // ============================================================================
      // DISCORD OAUTH
      // ============================================================================

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
          const clientId = env.DISCORD_CLIENT_ID || '1417915896634277888';
          const clientSecret = env.DISCORD_CLIENT_SECRET;
          
          if (!clientSecret) {
            return new Response(JSON.stringify({ error: 'Discord client secret not configured' }), {
              status: 500,
              headers: corsHeaders
            });
          }
          
          const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: redirectUri || 'https://portal.cirkledevelopment.co.uk'
            })
          });

          if (!tokenResponse.ok) {
            return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
              status: tokenResponse.status,
              headers: corsHeaders
            });
          }

          const tokenData = await tokenResponse.json();
          const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
          });

          if (!userResponse.ok) {
            return new Response(JSON.stringify({ error: 'Failed to get user info' }), {
              status: userResponse.status,
              headers: corsHeaders
            });
          }

          const userData = await userResponse.json();
          const userId = userData.id;

          // Auto-create user in KV if they don't exist yet (first-time login)
          const accountKey = `user:${userId}`;
          const existingAccount = await env.DATA.get(accountKey, 'json');
          
          if (!existingAccount) {
            // First-time user: create basic profile in KV
            const newProfile = {
              id: userId,
              name: userData.global_name || userData.username,
              email: 'Not set',
              department: 'Not set',
              discordTag: userData.username,
              discordId: userId,
              avatar: userData.avatar,
              createdAt: new Date().toISOString()
            };
            
            const profileKey = `profile:${userId}`;
            await env.DATA.put(profileKey, JSON.stringify(newProfile));
            
            const newAccount = {
              id: userId,
              profile: newProfile,
              absences: [],
              payslips: [],
              disciplinaries: [],
              reports: [],
              requests: []
            };
            await env.DATA.put(accountKey, JSON.stringify(newAccount));
            
            // Add user to index
            const usersIndex = await env.DATA.get('users:index', 'json') || [];
            if (!usersIndex.includes(userId)) {
              usersIndex.push(userId);
              await env.DATA.put('users:index', JSON.stringify(usersIndex));
            }
            
            console.log(`[AUTH] New user created in KV: ${userId}`);
          } else {
            console.log(`[AUTH] User already exists in KV: ${userId}`);
          }

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

      // ============================================================================
      // EMAIL (Resend API)
      // ============================================================================

      if (url.pathname === '/api/email/send' && request.method === 'POST') {
        const body = await request.json();
        const resendApiKey = env.RESEND_API_KEY;

        if (!resendApiKey) {
          return new Response(JSON.stringify({ success: false, error: 'Resend API key not configured' }), {
            status: 500,
            headers: corsHeaders
          });
        }

        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: body.from,
              to: body.to,
              cc: body.cc,
              bcc: body.bcc,
              subject: body.subject,
              html: body.html,
              reply_to: body.replyTo
            })
          });

          const data = await response.json();
          return new Response(JSON.stringify({ success: response.ok, ...data }), {
            status: response.status,
            headers: corsHeaders
          });
        } catch (error) {
          console.error('[EMAIL]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // DISCORD DM SEND
      // ============================================================================

      if (url.pathname === '/api/send-dm' && request.method === 'POST') {
        const { userId, embed } = await request.json();

        if (!userId || !embed) {
          return new Response(JSON.stringify({ success: false, error: 'userId and embed required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        try {
          const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: userId })
          });

          if (!dmResponse.ok) {
            throw new Error(`DM creation failed: ${dmResponse.status}`);
          }

          const dmChannel = await dmResponse.json();

          const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ embeds: [embed] })
          });

          if (!messageResponse.ok) {
            throw new Error(`Message send failed: ${messageResponse.status}`);
          }

          return new Response(JSON.stringify({ success: true, message: 'DM sent' }), { headers: corsHeaders });
        } catch (error) {
          console.error('[SEND-DM]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // WEBHOOKS
      // ============================================================================

      // Admin login notification webhook
      if (url.pathname === '/api/webhooks/admin-login' && request.method === 'POST') {
        const { adminId, adminName, timestamp } = await request.json();

        if (!adminId) {
          return new Response(JSON.stringify({ success: false, error: 'adminId required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        try {
          // Send DM to admin notifying them they've logged in
          const embed = {
            title: '🔐 OC Portal Login',
            description: `You have successfully logged into the OC Portal.`,
            color: 0x3498db, // Blue
            fields: [
              { name: 'Admin', value: adminName || 'Unknown', inline: true },
              { name: 'Time', value: new Date(timestamp).toLocaleString('en-GB', { timeZone: 'Europe/London' }), inline: true }
            ],
            footer: { text: 'Cirkle Development Security' },
            timestamp: timestamp || new Date().toISOString()
          };

          const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: adminId })
          });

          if (dmResponse.ok) {
            const dmChannel = await dmResponse.json();
            await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ embeds: [embed] })
            });
          }

          return new Response(JSON.stringify({ success: true, message: 'Login notification sent' }), { headers: corsHeaders });
        } catch (error) {
          console.error('[ADMIN-LOGIN-WEBHOOK]', error);
          // Don't fail the request if notification fails
          return new Response(JSON.stringify({ success: true, message: 'Login successful (notification failed)' }), { 
            headers: corsHeaders 
          });
        }
      }

      // ============================================================================
      // DEBUG ENDPOINTS
      // ============================================================================
      
      // Debug: Get all KV keys for a user
      if (url.pathname.startsWith('/api/debug/user/') && request.method === 'GET') {
        const userId = url.pathname.split('/api/debug/user/')[1];
        try {
          const profileKey = `profile:${userId}`;
          const accountKey = `user:${userId}`;
          
          const profile = await env.DATA.get(profileKey, 'json');
          const account = await env.DATA.get(accountKey, 'json');
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          
          return new Response(JSON.stringify({
            userId,
            inIndex: usersIndex.includes(userId),
            profileKey: profileKey,
            profileExists: !!profile,
            profile: profile,
            accountKey: accountKey,
            accountExists: !!account,
            account: account
          }, null, 2), { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // ============================================================================
      // ADMIN DATA OPERATIONS
      // ============================================================================

      // Store/update user profile
      if (url.pathname === '/api/admin/user/create' && request.method === 'POST') {
        const body = await request.json();
        const { userId, profile } = body;

        if (!userId || !profile) {
          return new Response(JSON.stringify({ error: 'Missing userId or profile' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const profileKey = `profile:${userId}`;
        await env.DATA.put(profileKey, JSON.stringify(profile));

        const accountKey = `user:${userId}`;
        const account = {
          id: userId,
          profile,
          absences: [],
          payslips: [],
          disciplinaries: [],
          reports: [],
          requests: []
        };
        await env.DATA.put(accountKey, JSON.stringify(account));
        
        // Add user to index if not already there
        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(userId)) {
          usersIndex.push(userId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
          console.log(`[ADMIN CREATE] Added user ${userId} to index`);
        }

        return new Response(JSON.stringify({ success: true, userId }), { headers: corsHeaders });
      }

      // Get all users (for admin)
      if (url.pathname === '/api/admin/users/list' && request.method === 'GET') {
        // KV doesn't have list functionality in free tier, so return empty
        // For production, you'd need KV with metadata or use D1 database
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }

      // ============================================================================
      // ADMIN ENDPOINTS
      // ============================================================================
      
      // Get Discord user info
      if (url.pathname.startsWith('/api/discord/user/') && request.method === 'GET') {
        const userId = url.pathname.split('/api/discord/user/')[1];
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing userId' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        // First try to get from stored profile
        const profileKey = `profile:${userId}`;
        const profile = await env.DATA.get(profileKey, 'json');
        
        if (profile) {
          // Return profile data in Discord API format
          return new Response(JSON.stringify({
            id: userId,
            username: profile.discordTag || profile.name,
            global_name: profile.name,
            avatar: profile.avatar,
            avatar_url: profile.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${profile.avatar}.png?size=128` : null
          }), { headers: corsHeaders });
        }
        
        // If not in KV, return a default response
        return new Response(JSON.stringify({
          id: userId,
          username: 'User',
          global_name: 'User',
          avatar: null,
          avatar_url: null
        }), { headers: corsHeaders });
      }
      
      // Get all users for admin dashboard
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        try {
          const fixedStaffIds = {
            'Marcus Ray': 'OC061021',
            'Appler Smith': 'OC486133',
            'Sam Caster': 'OC638542'
          };

          // Get user index
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          
          // Fetch each user's profile
          const users = [];
          for (const userId of usersIndex) {
            const accountKey = `user:${userId}`;
            const account = await env.DATA.get(accountKey, 'json');
            if (account && account.profile) {
              const desiredStaffId = fixedStaffIds[account.profile.name] || '';
              if (desiredStaffId && account.profile.staffId !== desiredStaffId) {
                account.profile.staffId = desiredStaffId;
                await env.DATA.put(`profile:${userId}`, JSON.stringify(account.profile));
                await env.DATA.put(accountKey, JSON.stringify(account));
              }

              let avatarUrl = '';
              if (account.profile.avatar) {
                if (account.profile.avatar.startsWith('http')) {
                  avatarUrl = account.profile.avatar;
                } else {
                  avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${account.profile.avatar}.png?size=128`;
                }
              }

              users.push({
                discordId: userId,
                name: account.profile.name || 'Unknown',
                email: account.profile.email || 'Not set',
                department: account.profile.department || 'Not set',
                baseLevel: account.profile.baseLevel || '',
                staffId: account.profile.staffId || desiredStaffId || '',
                avatar: avatarUrl || null,
                timezone: account.profile.timezone || '',
                country: account.profile.country || '',
                suspended: account.profile.suspended || false,
                createdAt: account.profile.createdAt || new Date().toISOString(),
                dateOfSignup: account.profile.dateOfSignup || account.profile.createdAt || ''
              });
            }
          }
          
          return new Response(JSON.stringify({ success: true, users }), { headers: corsHeaders });
        } catch (e) {
          console.error('[ADMIN] Error fetching users:', e);
          return new Response(JSON.stringify({ success: false, error: e.message, users: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get all absences for admin dashboard
      if (url.pathname === '/api/admin/absences' && request.method === 'GET') {
        try {
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const allAbsences = [];
          
          for (const userId of usersIndex) {
            const absencesKey = `absences:${userId}`;
            const userAbsences = await env.DATA.get(absencesKey, 'json') || [];
            allAbsences.push(...userAbsences.map(a => ({ ...a, userId })));
          }
          
          return new Response(JSON.stringify({ success: true, absences: allAbsences }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, absences: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get all requests for admin dashboard
      if (url.pathname === '/api/admin/requests' && request.method === 'GET') {
        try {
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const allRequests = [];
          
          for (const userId of usersIndex) {
            const requestsKey = `requests:${userId}`;
            const userRequests = await env.DATA.get(requestsKey, 'json') || [];
            allRequests.push(...userRequests.map(r => ({ ...r, userId })));
          }
          
          return new Response(JSON.stringify({ success: true, requests: allRequests }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, requests: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get all payslips for admin dashboard
      if (url.pathname === '/api/admin/payslips' && request.method === 'GET') {
        try {
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const allPayslips = [];
          
          for (const userId of usersIndex) {
            const payslipsKey = `payslips:${userId}`;
            const userPayslips = await env.DATA.get(payslipsKey, 'json') || [];
            allPayslips.push(...userPayslips.map(p => ({ ...p, userId })));
          }
          
          return new Response(JSON.stringify({ success: true, payslips: allPayslips }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, payslips: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get all reports for admin dashboard
      if (url.pathname === '/api/admin/reports' && request.method === 'GET') {
        try {
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const allReports = [];
          
          for (const userId of usersIndex) {
            const reportsKey = `reports:${userId}`;
            const userReports = await env.DATA.get(reportsKey, 'json') || [];
            allReports.push(...userReports.map(r => ({ ...r, userId })));
          }
          
          return new Response(JSON.stringify({ success: true, reports: allReports }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, reports: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get all disciplinaries/strikes for admin dashboard
      if (url.pathname === '/api/admin/strikes' && request.method === 'GET') {
        try {
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const allStrikes = [];
          
          for (const userId of usersIndex) {
            const strikesKey = `disciplinaries:${userId}`;
            const userStrikes = await env.DATA.get(strikesKey, 'json') || [];
            allStrikes.push(...userStrikes.map(s => ({ ...s, userId })));
          }
          
          return new Response(JSON.stringify({ success: true, strikes: allStrikes }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, strikes: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Get calendar events
      if (url.pathname === '/api/calendar/events' && request.method === 'GET') {
        try {
          const events = await env.DATA.get('calendar:events', 'json') || [];
          return new Response(JSON.stringify({ success: true, events }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, events: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Create calendar event
      if (url.pathname === '/api/calendar/events' && request.method === 'POST') {
        try {
          const body = await request.json();
          const events = await env.DATA.get('calendar:events', 'json') || [];
          const newEvent = {
            id: `event_${Date.now()}`,
            ...body,
            createdAt: new Date().toISOString()
          };
          events.push(newEvent);
          await env.DATA.put('calendar:events', JSON.stringify(events));
          return new Response(JSON.stringify({ success: true, event: newEvent }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Get admin logs
      if (url.pathname === '/api/admin/logs' && request.method === 'GET') {
        try {
          const logs = await env.DATA.get('admin:logs', 'json') || [];
          return new Response(JSON.stringify({ success: true, logs }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, logs: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Create admin log entry
      if (url.pathname === '/api/admin/logs' && request.method === 'POST') {
        try {
          const body = await request.json();
          const logs = await env.DATA.get('admin:logs', 'json') || [];
          const newLog = {
            id: `log_${Date.now()}`,
            ...body,
            timestamp: new Date().toISOString()
          };
          logs.push(newLog);
          // Keep only last 1000 logs to prevent KV storage overflow
          if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
          }
          await env.DATA.put('admin:logs', JSON.stringify(logs));
          return new Response(JSON.stringify({ success: true, log: newLog }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Get user emails
      if (url.pathname.startsWith('/api/email/account/') && request.method === 'GET') {
        const userId = url.pathname.split('/api/email/account/')[1];
        try {
          const emailsKey = `emails:${userId}`;
          const emails = await env.DATA.get(emailsKey, 'json') || [];
          return new Response(JSON.stringify({ success: true, emails }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, emails: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Update user (admin)
      if (url.pathname === '/api/admin/user/update' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, name, email, department, baseLevel, utilisation } = body;
          
          if (!discordId) {
            return new Response(JSON.stringify({ success: false, error: 'Missing discordId' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          // Update profile
          const profileKey = `profile:${discordId}`;
          const profile = await env.DATA.get(profileKey, 'json') || {};
          
          if (name !== undefined) profile.name = name;
          if (email !== undefined) profile.email = email;
          if (department !== undefined) profile.department = department;
          if (baseLevel !== undefined) profile.baseLevel = baseLevel;
          if (utilisation !== undefined) {
            profile.suspended = utilisation === 'Suspended';
            profile.utilisation = utilisation;
          }
          
          profile.updatedAt = new Date().toISOString();
          await env.DATA.put(profileKey, JSON.stringify(profile));
          
          // Update account
          const accountKey = `user:${discordId}`;
          const account = await env.DATA.get(accountKey, 'json') || { id: discordId };
          account.profile = profile;
          if (name !== undefined) account.name = name;
          if (email !== undefined) account.email = email;
          await env.DATA.put(accountKey, JSON.stringify(account));
          
          return new Response(JSON.stringify({ success: true, profile }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Delete user account (admin)
      if (url.pathname === '/api/admin/user/delete' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId } = body;
          
          if (!discordId) {
            return new Response(JSON.stringify({ success: false, error: 'Missing discordId' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          // Delete all user data from KV
          await env.DATA.delete(`profile:${discordId}`);
          await env.DATA.delete(`user:${discordId}`);
          await env.DATA.delete(`absences:${discordId}`);
          await env.DATA.delete(`payslips:${discordId}`);
          await env.DATA.delete(`disciplinaries:${discordId}`);
          await env.DATA.delete(`reports:${discordId}`);
          await env.DATA.delete(`requests:${discordId}`);
          
          // Remove from users index
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          const newIndex = usersIndex.filter(id => id !== discordId);
          await env.DATA.put('users:index', JSON.stringify(newIndex));
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Delete single record (admin)
      if (url.pathname === '/api/admin/records/delete' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, recordType, recordId } = body;

          if (!discordId || !recordType || !recordId) {
            return new Response(JSON.stringify({ success: false, error: 'discordId, recordType, and recordId required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const keyMap = {
            absences: `absences:${discordId}`,
            requests: `requests:${discordId}`,
            payslips: `payslips:${discordId}`,
            reports: `reports:${discordId}`,
            disciplinaries: `disciplinaries:${discordId}`
          };

          const dataKey = keyMap[recordType];
          if (!dataKey) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid recordType' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const records = await env.DATA.get(dataKey, 'json') || [];
          const filtered = records.filter(r => r.id !== recordId);
          await env.DATA.put(dataKey, JSON.stringify(filtered));

          return new Response(JSON.stringify({ success: true, removed: records.length - filtered.length }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Erase all records for a type (admin)
      if (url.pathname === '/api/admin/records/erase-all' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, recordType } = body;

          if (!discordId || !recordType) {
            return new Response(JSON.stringify({ success: false, error: 'discordId and recordType required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const keyMap = {
            absences: `absences:${discordId}`,
            requests: `requests:${discordId}`,
            payslips: `payslips:${discordId}`,
            reports: `reports:${discordId}`,
            disciplinaries: `disciplinaries:${discordId}`
          };

          const dataKey = keyMap[recordType];
          if (!dataKey) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid recordType' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          await env.DATA.put(dataKey, JSON.stringify([]));
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Update absence status (admin)
      if (url.pathname === '/api/admin/absence/update-status' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, absenceId, status, adminName, reason, adminId, adminAvatar } = body;
          
          const absencesKey = `absences:${userId}`;
          const absences = await env.DATA.get(absencesKey, 'json') || [];
          
          const absence = absences.find(a => a.id === absenceId);
          if (absence) {
            absence.status = status.toLowerCase(); // Normalize to lowercase (pending/approved/rejected)
            absence.approvedBy = adminName;
            absence.approvedById = adminId || absence.approvedById || null;
            absence.approvedByAvatar = adminAvatar || absence.approvedByAvatar || null;
            absence.approvedAt = new Date().toISOString();
            if (reason) absence.adminNotes = reason;
            await env.DATA.put(absencesKey, JSON.stringify(absences));
            
            // Send Discord DM notification to user
            try {
              const embed = {
                title: status.toLowerCase() === 'approved' ? '✅ Absence Request Approved' : '❌ Absence Request Denied',
                description: `Your absence request has been **${status.toLowerCase()}** by ${adminName}.`,
                color: status.toLowerCase() === 'approved' ? 0x4CAF50 : 0xE74C3C,
                fields: [
                  { name: 'Type', value: absence.type || absence.reason || 'N/A', inline: true },
                  { name: 'Start Date', value: absence.startDate, inline: true },
                  { name: 'End Date', value: absence.endDate || absence.startDate, inline: true },
                  { name: 'Days', value: absence.days || absence.totalDays || '1', inline: true }
                ],
                footer: { text: 'Cirkle Development HR Portal' },
                timestamp: new Date().toISOString()
              };
              
              if (reason) {
                embed.fields.push({ name: 'Note from Admin', value: reason, inline: false });
              }
              
              const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
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
                  body: JSON.stringify({ embeds: [embed] })
                });
              }
            } catch (dmError) {
              console.error('[DM-ABSENCE-UPDATE]', dmError);
              // Don't fail the request if DM fails
            }
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Update request status (admin)
      if (url.pathname === '/api/admin/requests/update-status' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, requestId, status, adminName, reason, adminId, adminAvatar } = body;
          
          const requestsKey = `requests:${userId}`;
          const requests = await env.DATA.get(requestsKey, 'json') || [];
          
          const request = requests.find(r => r.id === requestId);
          if (request) {
            const normalized = (status || '').toLowerCase();
            request.status = normalized === 'approved' ? 'approved' : normalized === 'rejected' ? 'rejected' : normalized;
            request.approvedBy = adminName;
            request.approverName = adminName;
            request.approvedById = adminId || request.approvedById || null;
            request.approvedByAvatar = adminAvatar || request.approvedByAvatar || null;
            request.response = reason || request.response || '';
            request.approvedAt = new Date().toISOString();
            if (reason) request.adminNotes = reason;
            await env.DATA.put(requestsKey, JSON.stringify(requests));
            
            // Send Discord DM notification to user
            try {
              const embed = {
                title: status.toLowerCase() === 'approved' ? '✅ Request Approved' : '❌ Request Denied',
                description: `Your ${request.type || 'request'} has been **${status.toLowerCase()}** by ${adminName}.`,
                color: status.toLowerCase() === 'approved' ? 0x4CAF50 : 0xE74C3C,
                fields: [
                  { name: 'Request Type', value: request.type || 'General Request', inline: true },
                  { name: 'Details', value: request.details || request.comment || 'N/A', inline: false }
                ],
                footer: { text: 'Cirkle Development HR Portal' },
                timestamp: new Date().toISOString()
              };
              
              if (reason) {
                embed.fields.push({ name: 'Note from Admin', value: reason, inline: false });
              }
              
              const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
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
                  body: JSON.stringify({ embeds: [embed] })
                });
              }
            } catch (dmError) {
              console.error('[DM-REQUEST-UPDATE]', dmError);
              // Don't fail the request if DM fails
            }
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Create payslip (admin)
      if (url.pathname === '/api/admin/payslips/create' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, period, link, comment, assignedBy, assignedById, assignedByAvatar } = body;
          if (!userId || !link) {
            return new Response(JSON.stringify({ success: false, error: 'userId and link required' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const payslipsKey = `payslips:${userId}`;
          const payslips = await env.DATA.get(payslipsKey, 'json') || [];
          
          const newPayslip = {
            id: `payslip_${Date.now()}`,
            period: period || '',
            link,
            comment: comment || '',
            assignedBy: assignedBy || 'OC Director',
            assignedById: assignedById || null,
            assignedByAvatar: assignedByAvatar || null,
            dateAssigned: new Date().toISOString(),
            status: 'issued'
          };
          
          payslips.push(newPayslip);
          await env.DATA.put(payslipsKey, JSON.stringify(payslips));

          // Ensure user is in the index so admins can see this payslip
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          if (!usersIndex.includes(userId)) {
            usersIndex.push(userId);
            await env.DATA.put('users:index', JSON.stringify(usersIndex));
          }

          // Send DM to user with direct link
          try {
            const embed = {
              title: 'New Payslip Available',
              description: 'You have received a new payslip.',
              color: 0x0dcaf0,
              fields: [
                { name: 'Period', value: period || 'N/A', inline: true },
                { name: 'Assigned By', value: assignedBy || 'OC Director', inline: true },
                { name: 'Link', value: link, inline: false }
              ],
              footer: { text: 'Cirkle Development HR Portal' },
              timestamp: new Date().toISOString()
            };

            const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
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
                body: JSON.stringify({ embeds: [embed] })
              });
            }
          } catch (dmError) {
            console.error('[DM-PAYSLIP]', dmError);
          }
          
          return new Response(JSON.stringify({ success: true, payslip: newPayslip }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }
      
      // Create report (admin)
      if (url.pathname === '/api/reports/create' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, type, comment, publishedBy, publishedById, publishedByAvatar, scale } = body;
          if (!userId || !type) {
            return new Response(JSON.stringify({ success: false, error: 'userId and type required' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const reportsKey = `reports:${userId}`;
          const reports = await env.DATA.get(reportsKey, 'json') || [];
          
          const newReport = {
            id: `report_${Date.now()}`,
            type: type || scale || 'Report',
            comment: comment || '',
            publishedBy: publishedBy || 'OC Director',
            publishedById: publishedById || null,
            publishedByAvatar: publishedByAvatar || null,
            timestamp: new Date().toISOString()
          };
          
          reports.push(newReport);
          await env.DATA.put(reportsKey, JSON.stringify(reports));

          // Ensure user is in the index so admins can see this report
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          if (!usersIndex.includes(userId)) {
            usersIndex.push(userId);
            await env.DATA.put('users:index', JSON.stringify(usersIndex));
          }
          
          return new Response(JSON.stringify({ success: true, report: newReport }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // ==========================================================================
      // NOTIFICATION ENDPOINTS (DM helpers)
      // ==========================================================================

      if (url.pathname === '/api/notifications/payslip' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, payslipData } = body;
          if (!discordId || !payslipData) {
            return new Response(JSON.stringify({ success: false, error: 'discordId and payslipData required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const embed = {
            title: 'New Payslip Available',
            description: 'You have received a new payslip.',
            color: 0x0dcaf0,
            fields: [
              { name: 'Date', value: payslipData.date || 'N/A', inline: true },
              { name: 'Link', value: payslipData.link || 'N/A', inline: false }
            ],
            footer: { text: 'Cirkle Development HR Portal' },
            timestamp: new Date().toISOString()
          };

          const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: discordId })
          });

          if (dmResponse.ok) {
            const dmChannel = await dmResponse.json();
            await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ embeds: [embed] })
            });
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      if (url.pathname === '/api/notifications/disciplinary' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, disciplinaryData } = body;
          if (!discordId || !disciplinaryData) {
            return new Response(JSON.stringify({ success: false, error: 'discordId and disciplinaryData required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const embed = {
            title: 'New Disciplinary Notice',
            description: 'You have received a new disciplinary notice.',
            color: 0xef4444,
            fields: [
              { name: 'Type', value: disciplinaryData.type || 'N/A', inline: true },
              { name: 'Date', value: disciplinaryData.date || 'N/A', inline: true },
              { name: 'Reason', value: disciplinaryData.reason || 'See portal for details', inline: false }
            ],
            footer: { text: 'Cirkle Development HR Portal' },
            timestamp: new Date().toISOString()
          };

          const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: discordId })
          });

          if (dmResponse.ok) {
            const dmChannel = await dmResponse.json();
            await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ embeds: [embed] })
            });
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Create payslip (admin)
      if (url.pathname === '/api/admin/payslips/create' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Reset workflow (for users)
      if (url.pathname === '/api/users/workflow/reset' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ============================================================================
      // CALENDAR ENDPOINTS
      // ============================================================================
      
      // Get calendar events
      if (url.pathname === '/api/calendar/events' && request.method === 'GET') {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }

      // Create calendar event
      if (url.pathname === '/api/calendar/events' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ============================================================================
      // LOGGING ENDPOINTS
      // ============================================================================
      
      // Get admin logs
      if (url.pathname === '/api/admin/logs' && request.method === 'GET') {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }

      // Log admin action
      if (url.pathname === '/api/admin/logs' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ============================================================================
      // EMAIL ENDPOINTS
      // ============================================================================

      // Get user email/mail account
      if (url.pathname.startsWith('/api/email/account/') && request.method === 'GET') {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }

      // ============================================================================
      // DISCORD ENDPOINTS
      // ============================================================================

      // Get Discord user info
      if (url.pathname.match(/^\/api\/discord\/user\/\d+$/) && request.method === 'GET') {
        return new Response(JSON.stringify({ error: 'Not found' }), { 
          status: 404,
          headers: corsHeaders 
        });
      }

      // ============================================================================
      // 404 - Endpoint not found
      // ============================================================================

      return new Response(JSON.stringify({ error: 'Endpoint not found', path: url.pathname }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('[WORKER]', error);
      return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
