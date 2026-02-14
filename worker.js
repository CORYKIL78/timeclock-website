/**
 * Cloudflare Worker - Timeclock Backend
 * Uses KV Storage for all data (no external APIs except Discord & Resend)
 */

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

      // Create absence request
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

        return new Response(JSON.stringify(payslips), { headers: corsHeaders });
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

        return new Response(JSON.stringify(disciplinaries), { headers: corsHeaders });
      }

      if (url.pathname === '/api/disciplinaries/create' && request.method === 'POST') {
        const body = await request.json();
        const { userId, reason, severity } = body;

        if (!userId || !reason) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const disciplinary = {
          id: `strike:${userId}:${Date.now()}`,
          userId,
          reason,
          severity: severity || 'level-1',
          createdAt: new Date().toISOString(),
          status: 'active'
        };

        const disciplinariesKey = `disciplinaries:${userId}`;
        const disciplinaries = await env.DATA.get(disciplinariesKey, 'json') || [];
        disciplinaries.push(disciplinary);
        await env.DATA.put(disciplinariesKey, JSON.stringify(disciplinaries));

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

        return new Response(JSON.stringify(reports), { headers: corsHeaders });
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

        return new Response(JSON.stringify(requests), { headers: corsHeaders });
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
          // Get user index
          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          
          // Fetch each user's profile
          const users = [];
          for (const userId of usersIndex) {
            const accountKey = `user:${userId}`;
            const account = await env.DATA.get(accountKey, 'json');
            if (account && account.profile) {
              users.push({
                discordId: userId,
                name: account.profile.name || 'Unknown',
                email: account.profile.email || 'Not set',
                department: account.profile.department || 'Not set',
                staffId: account.profile.staffId || '',
                timezone: account.profile.timezone || '',
                country: account.profile.country || '',
                suspended: account.profile.suspended || false,
                createdAt: account.profile.createdAt || new Date().toISOString()
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
          const { discordId, department, baseLevel, utilisation } = body;
          
          if (!discordId) {
            return new Response(JSON.stringify({ success: false, error: 'Missing discordId' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          // Update profile
          const profileKey = `profile:${discordId}`;
          const profile = await env.DATA.get(profileKey, 'json') || {};
          
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
          await env.DATA.put(accountKey, JSON.stringify(account));
          
          return new Response(JSON.stringify({ success: true, profile }), { headers: corsHeaders });
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
          const { userId, absenceId, status, adminName } = body;
          
          const absencesKey = `absences:${userId}`;
          const absences = await env.DATA.get(absencesKey, 'json') || [];
          
          const absence = absences.find(a => a.id === absenceId);
          if (absence) {
            absence.status = status;
            absence.approvedBy = adminName;
            absence.approvedAt = new Date().toISOString();
            await env.DATA.put(absencesKey, JSON.stringify(absences));
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
          const { userId, requestId, status, adminName } = body;
          
          const requestsKey = `requests:${userId}`;
          const requests = await env.DATA.get(requestsKey, 'json') || [];
          
          const request = requests.find(r => r.id === requestId);
          if (request) {
            request.status = status;
            request.approvedBy = adminName;
            request.approvedAt = new Date().toISOString();
            await env.DATA.put(requestsKey, JSON.stringify(requests));
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
          const { userId, period, link, comment } = body;
          
          const payslipsKey = `payslips:${userId}`;
          const payslips = await env.DATA.get(payslipsKey, 'json') || [];
          
          const newPayslip = {
            id: `payslip_${Date.now()}`,
            period,
            link,
            comment,
            issuedAt: new Date().toISOString()
          };
          
          payslips.push(newPayslip);
          await env.DATA.put(payslipsKey, JSON.stringify(payslips));
          
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
          const { userId, reportType, description, employer } = body;
          
          const reportsKey = `reports:${userId}`;
          const reports = await env.DATA.get(reportsKey, 'json') || [];
          
          const newReport = {
            id: `report_${Date.now()}`,
            reportType,
            description,
            employer,
            createdAt: new Date().toISOString()
          };
          
          reports.push(newReport);
          await env.DATA.put(reportsKey, JSON.stringify(reports));
          
          return new Response(JSON.stringify({ success: true, report: newReport }), { headers: corsHeaders });
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
