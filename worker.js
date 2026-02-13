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

      // Get user profile
      if (url.pathname.startsWith('/api/user/profile/')) {
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

        return new Response(JSON.stringify({ success: true, userId }), { headers: corsHeaders });
      }

      // Get all users (for admin)
      if (url.pathname === '/api/admin/users/list' && request.method === 'GET') {
        // KV doesn't have list functionality in free tier, so return empty
        // For production, you'd need KV with metadata or use D1 database
        return new Response(JSON.stringify([]), { headers: corsHeaders });
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
