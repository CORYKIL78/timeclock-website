/**
 * Cloudflare Worker - Timeclock Backend
 * Uses KV Storage for all data (no external APIs except Discord & Resend)
 */

const ABSENCE_LOG_CHANNEL = '1472640182170943812';
const REQUEST_LOG_CHANNEL = '1472954759525957652';
const TIMECLOCK_CHANNEL = '1472956106753183919';
const STAFF_ALERT_ROLE = '1472955487099289706';
const STAFF_SERVER_GUILD_ID = '1460025375655723283';
const OC_ADMIN_URL = 'https://portal.cirkledevelopment.co.uk/admin';
const EMAIL_INBOUND_DEDUPE_PREFIX = 'email:inbound:dedupe:';
const DEPARTMENT_EMAIL_CHANNELS = {
  'finance@departments.cirkledevelopment.co.uk': '1473829029306957866',
  'marketing@departments.cirkledevelopment.co.uk': '1473829616715038832',
  'development@departments.cirkledevelopment.co.uk': '1473829651792138395',
  'customerrelations@departments.cirkledevelopment.co.uk': '1473829693042987018'
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function truncateText(value, maxLen = 1024) {
  const text = String(value || '').trim();
  if (!text) return 'Not provided';
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function flattenAddressList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap(flattenAddressList).filter(Boolean);
  }
  if (typeof input === 'object') {
    return [
      input.email,
      input.address,
      input.value,
      input.to,
      input.recipient
    ].filter(Boolean).map(normalizeEmail);
  }
  return String(input)
    .split(/[;,]/)
    .map(item => item.replace(/.*<([^>]+)>.*/, '$1'))
    .map(normalizeEmail)
    .filter(Boolean);
}

function tryParseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function toUint8ArrayFromBase64(base64Value) {
  const binary = atob(base64Value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function parseSvixSignatures(signatureHeader) {
  return String(signatureHeader || '')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const parts = item.split(',');
      return { version: parts[0], signature: parts.slice(1).join(',') };
    })
    .filter(item => item.version === 'v1' && item.signature);
}

async function verifyResendWebhookSignature(request, env) {
  const webhookSecret = String(env?.RESEND_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return { ok: true, skipped: true, reason: 'No RESEND_WEBHOOK_SECRET configured' };
  }

  const svixId = request.headers.get('svix-id') || request.headers.get('Svix-Id');
  const svixTimestamp = request.headers.get('svix-timestamp') || request.headers.get('Svix-Timestamp');
  const svixSignature = request.headers.get('svix-signature') || request.headers.get('Svix-Signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'Missing svix signature headers' };
  }

  const rawBody = await request.clone().text();
  const payload = `${svixId}.${svixTimestamp}.${rawBody}`;

  let secretBytes;
  if (webhookSecret.startsWith('whsec_')) {
    const encodedSecret = webhookSecret.slice(6);
    secretBytes = toUint8ArrayFromBase64(encodedSecret);
  } else {
    secretBytes = new TextEncoder().encode(webhookSecret);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  const signatureBytes = new Uint8Array(signedBuffer);
  const expectedSignature = btoa(String.fromCharCode(...signatureBytes));

  const candidates = parseSvixSignatures(svixSignature);
  const matched = candidates.some(item => constantTimeEqual(item.signature, expectedSignature));

  if (!matched) {
    return { ok: false, reason: 'Webhook signature mismatch' };
  }

  return { ok: true, eventId: svixId, timestamp: svixTimestamp };
}

async function parseInboundEmailRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    const data = body?.data || body?.email || body || {};

    const resolvedFrom = pickFirstNonEmpty(
      body?.from,
      body?.sender,
      data?.from,
      data?.sender,
      data?.envelope?.from
    );

    const resolvedTo = pickFirstNonEmpty(
      body?.to,
      body?.recipients,
      data?.to,
      data?.recipients,
      data?.envelope?.to
    );

    const resolvedSubject = pickFirstNonEmpty(
      body?.subject,
      data?.subject,
      '(No subject)'
    );

    const resolvedText = pickFirstNonEmpty(
      body?.text,
      body?.body,
      body?.text_body,
      body?.textBody,
      body?.['stripped-text'],
      body?.strippedText,
      data?.text,
      data?.body,
      data?.text_body,
      data?.textBody,
      data?.['stripped-text'],
      data?.strippedText,
      data?.content,
      data?.message
    );

    const resolvedHtml = pickFirstNonEmpty(
      body?.html,
      body?.html_body,
      body?.htmlBody,
      body?.['stripped-html'],
      body?.strippedHtml,
      data?.html,
      data?.html_body,
      data?.htmlBody,
      data?.['stripped-html'],
      data?.strippedHtml
    );

    return {
      from: resolvedFrom,
      to: resolvedTo,
      subject: resolvedSubject,
      text: resolvedText,
      html: resolvedHtml,
      messageId: body.id || body.message_id || body.email_id || data?.id || data?.message_id || '',
      attachments: body.attachments || data?.attachments || []
    };
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    const parsedAttachments = [];

    for (const [key, value] of form.entries()) {
      if ((key.startsWith('attachment') || key.startsWith('attachments')) && value instanceof File) {
        parsedAttachments.push({
          filename: value.name || 'attachment',
          contentType: value.type || 'application/octet-stream',
          file: value
        });
      }
    }

    const encodedAttachments = form.get('attachments');
    const parsedEncoded = typeof encodedAttachments === 'string' ? tryParseJson(encodedAttachments, []) : [];

    return {
      from: pickFirstNonEmpty(form.get('from'), form.get('sender'), form.get('from_email')),
      to: pickFirstNonEmpty(form.get('to'), form.get('recipient'), form.get('recipients'), form.get('to_email')),
      subject: pickFirstNonEmpty(form.get('subject'), '(No subject)'),
      text: pickFirstNonEmpty(
        form.get('text'),
        form.get('body'),
        form.get('text_body'),
        form.get('TextBody'),
        form.get('stripped-text'),
        form.get('strippedText'),
        form.get('content')
      ),
      html: pickFirstNonEmpty(
        form.get('html'),
        form.get('html_body'),
        form.get('HtmlBody'),
        form.get('stripped-html'),
        form.get('strippedHtml')
      ),
      messageId: form.get('id') || form.get('message_id') || '',
      attachments: [...parsedAttachments, ...(Array.isArray(parsedEncoded) ? parsedEncoded : [])]
    };
  }

  return {
    from: '',
    to: '',
    subject: '(No subject)',
    text: '',
    html: '',
    messageId: '',
    attachments: []
  };
}

async function resolveDiscordFilesFromAttachments(attachments = []) {
  const files = [];

  for (const attachment of attachments) {
    if (!attachment) continue;

    if (attachment.file instanceof File) {
      files.push(attachment.file);
      continue;
    }

    const fileName = attachment.filename || attachment.name || `attachment-${files.length + 1}`;
    const fileType = attachment.contentType || attachment.type || 'application/octet-stream';

    if (attachment.url) {
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) continue;
        const blob = await response.blob();
        files.push(new File([blob], fileName, { type: blob.type || fileType }));
      } catch {
      }
      continue;
    }

    const base64Content = attachment.content || attachment.data || '';
    if (typeof base64Content === 'string' && base64Content) {
      try {
        const cleaned = base64Content.replace(/^data:[^;]+;base64,/, '');
        const binary = atob(cleaned);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        files.push(new File([bytes], fileName, { type: fileType }));
      } catch {
      }
    }
  }

  return files;
}

async function postDiscordMessageWithFiles(env, channelId, payload, files = []) {
  if (!env?.DISCORD_BOT_TOKEN || !channelId) return null;

  if (!Array.isArray(files) || files.length === 0) {
    return postDiscordMessage(env, channelId, payload);
  }

  try {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(payload));
    files.slice(0, 10).forEach((file, index) => {
      const safeName = file?.name || `attachment-${index + 1}`;
      formData.append(`files[${index}]`, file, safeName);
    });

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Discord upload failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[DISCORD-FILE-UPLOAD]', error);
    return null;
  }
}

async function postDiscordMessage(env, channelId, payload) {
  if (!env?.DISCORD_BOT_TOKEN || !channelId) return null;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Discord message failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[DISCORD-LOG]', error);
    return null;
  }
}

async function postDiscordEmbed(env, channelId, embed, content = '', allowedMentions = null) {
  const payload = { embeds: [embed] };
  if (content) payload.content = content;
  if (allowedMentions) payload.allowed_mentions = allowedMentions;
  return await postDiscordMessage(env, channelId, payload);
}

async function updateDiscordMessage(env, channelId, messageId, payload) {
  if (!env?.DISCORD_BOT_TOKEN || !channelId || !messageId) return false;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Discord update failed: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error('[DISCORD-UPDATE]', error);
    return false;
  }
}

async function sendDiscordDM(env, userId, embed) {
  if (!env?.DISCORD_BOT_TOKEN || !userId || !embed) return false;
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

    return messageResponse.ok;
  } catch (error) {
    console.error('[DISCORD-DM]', error);
    return false;
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
        const { discordId, name, email, department, staffId, timezone, country, robloxId, robloxUsername } = body;

        if (!discordId) {
          return new Response(JSON.stringify({ error: 'Missing discordId' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const profileKey = `profile:${discordId}`;
        const existingProfile = await env.DATA.get(profileKey, 'json') || {};

        console.log(`[PROFILE UPDATE] Updating profile for ${discordId}`, { name, email, department, staffId, robloxId });
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
          robloxId: robloxId !== undefined ? robloxId : existingProfile.robloxId,
          robloxUsername: robloxUsername !== undefined ? robloxUsername : existingProfile.robloxUsername,
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

        await postDiscordEmbed(
          env,
          ABSENCE_LOG_CHANNEL,
          {
            title: 'New Absence Request',
            description: `Review in OC Portal: ${OC_ADMIN_URL}`,
            color: 0xf59e0b,
            fields: [
              { name: 'User', value: `${name || 'Unknown'} (${discordId})`, inline: false },
              { name: 'Type', value: reason || 'N/A', inline: true },
              { name: 'Start', value: startDate || 'N/A', inline: true },
              { name: 'End', value: endDate || startDate || 'N/A', inline: true },
              { name: 'Total Days', value: totalDays ? String(totalDays) : '1', inline: true },
              { name: 'Reason', value: comment || 'N/A', inline: false }
            ],
            timestamp: new Date().toISOString()
          },
          `<@&${STAFF_ALERT_ROLE}>`,
          { roles: [STAFF_ALERT_ROLE] }
        );

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

        const profile = await env.DATA.get(`profile:${userId}`, 'json');
        const userLabel = profile?.name ? `${profile.name} (${userId})` : userId;

        await postDiscordEmbed(
          env,
          REQUEST_LOG_CHANNEL,
          {
            title: 'New Request Submitted',
            description: `Review in OC Portal: ${OC_ADMIN_URL}`,
            color: 0x3b82f6,
            fields: [
              { name: 'User', value: userLabel, inline: false },
              { name: 'Type', value: type || 'N/A', inline: true },
              { name: 'Details', value: comment || details || 'N/A', inline: false }
            ],
            timestamp: new Date().toISOString()
          },
          `<@&${STAFF_ALERT_ROLE}>`,
          { roles: [STAFF_ALERT_ROLE] }
        );

        return new Response(JSON.stringify({ success: true, request: request_item }), { headers: corsHeaders });
      }

      // Submit change request (department/name/email)
      if (url.pathname === '/api/change-request/submit' && request.method === 'POST') {
        const body = await request.json();
        const { discordId, requestType, currentValue, requestedValue, reason, staffName, email, department, staffId } = body;

        if (!discordId || !requestType || !requestedValue || !reason) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const normalizedType = String(requestType).toLowerCase();
        const typeLabel = normalizedType === 'department'
          ? 'Department Change'
          : normalizedType === 'name'
          ? 'Name Change'
          : normalizedType === 'email'
          ? 'Email Change'
          : 'Change Request';

        const requestItem = {
          id: `request:${discordId}:${Date.now()}`,
          userId: discordId,
          type: typeLabel,
          comment: reason,
          details: reason,
          currentValue: currentValue || '',
          requestedValue,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        const requestsKey = `requests:${discordId}`;
        const requests = await env.DATA.get(requestsKey, 'json') || [];
        requests.push(requestItem);
        await env.DATA.put(requestsKey, JSON.stringify(requests));

        const usersIndex = await env.DATA.get('users:index', 'json') || [];
        if (!usersIndex.includes(discordId)) {
          usersIndex.push(discordId);
          await env.DATA.put('users:index', JSON.stringify(usersIndex));
        }

        const userLabel = staffName ? `${staffName} (${discordId})` : discordId;
        await postDiscordEmbed(
          env,
          REQUEST_LOG_CHANNEL,
          {
            title: `New ${typeLabel}`,
            description: `Review in OC Portal: ${OC_ADMIN_URL}`,
            color: 0x3b82f6,
            fields: [
              { name: 'User', value: userLabel, inline: false },
              { name: 'Reason', value: reason, inline: false },
              { name: 'Old', value: currentValue || 'N/A', inline: true },
              { name: 'New', value: requestedValue || 'N/A', inline: true },
              { name: 'Staff ID', value: staffId || 'Not assigned', inline: true },
              { name: 'Email', value: email || 'Not set', inline: true },
              { name: 'Department', value: department || 'Not set', inline: true }
            ],
            timestamp: new Date().toISOString()
          },
          `<@&${STAFF_ALERT_ROLE}>`,
          { roles: [STAFF_ALERT_ROLE] }
        );

        return new Response(JSON.stringify({ success: true, request: requestItem }), { headers: corsHeaders });
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

      if (url.pathname === '/api/email/inbound' && request.method === 'POST') {
        try {
          const signatureCheck = await verifyResendWebhookSignature(request, env);
          if (!signatureCheck.ok) {
            return new Response(JSON.stringify({ success: false, error: signatureCheck.reason }), {
              status: 401,
              headers: corsHeaders
            });
          }

          const inbound = await parseInboundEmailRequest(request);
          const recipientList = [...new Set(flattenAddressList(inbound.to))];
          const matchedRecipients = recipientList.filter(email => Boolean(DEPARTMENT_EMAIL_CHANNELS[email]));

          const dedupeId = signatureCheck.eventId || inbound.messageId || '';
          if (dedupeId && env?.DATA) {
            const dedupeKey = `${EMAIL_INBOUND_DEDUPE_PREFIX}${dedupeId}`;
            const alreadyProcessed = await env.DATA.get(dedupeKey);
            if (alreadyProcessed) {
              return new Response(JSON.stringify({ success: true, duplicate: true, dedupeId }), {
                status: 200,
                headers: corsHeaders
              });
            }
            await env.DATA.put(dedupeKey, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 7 });
          }

          if (matchedRecipients.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No mapped department recipient found',
              recipients: recipientList
            }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const textBody = String(inbound.text || '').trim();
          const htmlBody = String(inbound.html || '').trim();
          const finalBody = textBody || stripHtml(htmlBody) || 'No body content provided by sender.';
          const attachmentItems = Array.isArray(inbound.attachments) ? inbound.attachments : [];
          const discordFiles = await resolveDiscordFilesFromAttachments(attachmentItems);

          const attachmentNames = attachmentItems
            .map(item => item?.filename || item?.name || item?.url || null)
            .filter(Boolean)
            .slice(0, 20)
            .map(item => `• ${truncateText(item, 120)}`)
            .join('\n');

          const fromValue = truncateText(inbound.from || 'Unknown sender', 1024);
          const subjectValue = truncateText(inbound.subject || '(No subject)', 1024);
          const bodyValue = truncateText(finalBody, 3900);
          const attachmentsValue = truncateText(attachmentNames || 'None', 1024);

          const results = [];

          for (const recipient of matchedRecipients) {
            const channelId = DEPARTMENT_EMAIL_CHANNELS[recipient];
            const embed = {
              title: '📨 Department Email Received',
              color: 0x5865f2,
              description: `**Body**\n${bodyValue}`,
              fields: [
                { name: 'From', value: fromValue, inline: false },
                { name: 'To', value: recipient, inline: false },
                { name: 'Subject', value: subjectValue, inline: false },
                { name: 'Attachments', value: attachmentsValue, inline: false }
              ],
              timestamp: new Date().toISOString(),
              footer: { text: `Total attachments: ${attachmentItems.length}` }
            };

            const sent = await postDiscordMessageWithFiles(env, channelId, {
              embeds: [embed],
              allowed_mentions: { parse: [] }
            }, discordFiles);

            results.push({ recipient, channelId, sent: Boolean(sent) });
          }

          const sentCount = results.filter(item => item.sent).length;
          return new Response(JSON.stringify({
            success: sentCount > 0,
            routed: results,
            recipients: matchedRecipients,
            attachmentsReceived: attachmentItems.length,
            attachmentsForwarded: discordFiles.length
          }), {
            status: sentCount > 0 ? 200 : 500,
            headers: corsHeaders
          });
        } catch (error) {
          console.error('[EMAIL-INBOUND]', error);
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

      // Timeclock webhook (clock in/out embeds)
      if (url.pathname === '/api/webhooks/timeclock' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { action, userId, userName, staffId, timestamp, messageId, activity, duration } = body;

          if (!userId || !action) {
            return new Response(JSON.stringify({ success: false, error: 'userId and action required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const actionLower = String(action).toLowerCase();
          const displayName = userName || 'Unknown User';
          const timeText = timestamp ? new Date(timestamp).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');

          if (actionLower === 'clock_in') {
            const embed = {
              title: 'Timeclock: Clocked In',
              color: 0x22c55e,
              fields: [
                { name: 'User', value: `${displayName} (${userId})`, inline: false },
                { name: 'Staff ID', value: staffId || 'Not assigned', inline: true },
                { name: 'Clocked In At', value: timeText, inline: true }
              ],
              timestamp: new Date().toISOString()
            };

            const message = await postDiscordMessage(env, TIMECLOCK_CHANNEL, {
              embeds: [embed],
              allowed_mentions: { parse: [] }
            });

            if (message?.id) {
              await env.DATA.put(`timeclock:message:${userId}`, message.id);
            }

            return new Response(JSON.stringify({ success: true, messageId: message?.id || null }), { headers: corsHeaders });
          }

          if (actionLower === 'clock_out') {
            const storedMessageId = messageId || await env.DATA.get(`timeclock:message:${userId}`);
            const embed = {
              title: 'Timeclock: Clocked Out',
              color: 0xef4444,
              fields: [
                { name: 'User', value: `${displayName} (${userId})`, inline: false },
                { name: 'Staff ID', value: staffId || 'Not assigned', inline: true },
                { name: 'Clocked Out At', value: timeText, inline: true },
                { name: 'Work Completed', value: activity || 'No activity logged', inline: false }
              ],
              timestamp: new Date().toISOString()
            };

            let updated = false;
            if (storedMessageId) {
              updated = await updateDiscordMessage(env, TIMECLOCK_CHANNEL, storedMessageId, {
                embeds: [embed],
                allowed_mentions: { parse: [] }
              });
            }

            if (!updated) {
              const replyPayload = {
                embeds: [embed],
                allowed_mentions: { parse: [] }
              };
              if (storedMessageId) {
                replyPayload.message_reference = { message_id: storedMessageId };
              }
              await postDiscordMessage(env, TIMECLOCK_CHANNEL, replyPayload);
            }

            return new Response(JSON.stringify({ success: true, updated }), { headers: corsHeaders });
          }

          return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
            status: 400,
            headers: corsHeaders
          });
        } catch (error) {
          console.error('[TIMELOCK-WEBHOOK]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Staff server membership status (verification)
      if (url.pathname === '/api/discord/member-status' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, guildId } = body;

          if (!userId) {
            return new Response(JSON.stringify({ success: false, error: 'userId required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const targetGuild = guildId || STAFF_SERVER_GUILD_ID;
          const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${targetGuild}/members/${userId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          const isMember = memberResponse.ok;
          const statusKey = `staff-server:verified:${userId}`;
          const previousStatus = await env.DATA.get(statusKey);

          if (isMember && previousStatus !== 'true') {
            await env.DATA.put(statusKey, 'true');
            await sendDiscordDM(env, userId, {
              title: 'Verification Complete',
              description: 'You have been verified as you have joined the staff server. Your status has been updated automatically.',
              color: 0x22c55e,
              timestamp: new Date().toISOString()
            });
          }

          if (!isMember && previousStatus !== 'false') {
            await env.DATA.put(statusKey, 'false');
          }

          return new Response(JSON.stringify({ success: true, isMember }), { headers: corsHeaders });
        } catch (error) {
          console.error('[STAFF-SERVER-STATUS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Absence webhook compatibility (no-op to avoid duplicates)
      if (url.pathname === '/api/webhooks/absence' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ============================================================================
      // ADMIN PIN VERIFICATION
      // ============================================================================

      if (url.pathname === '/api/admin/verify-pin' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, pin, admins } = body;

          if (!discordId || !pin) {
            return new Response(JSON.stringify({ valid: false, error: 'Missing fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          // Try to get admin config from KV storage first
          let adminConfig = await env.DATA.get('config:admins', 'json');
          
          // If provided in request, use that (for browser-based verification)
          if (admins && !adminConfig) {
            adminConfig = admins;
            // Also store in KV for future use
            try {
              await env.DATA.put('config:admins', JSON.stringify(admins));
            } catch (e) {
              console.error('[ADMIN PIN] Could not cache admins to KV:', e);
            }
          }

          // If still no config, return invalid
          if (!adminConfig || !adminConfig[discordId]) {
            return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
          }

          const adminData = adminConfig[discordId];
          const isValid = adminData.pin === pin;

          return new Response(JSON.stringify({ 
            valid: isValid,
            admin: isValid ? adminData.name : undefined
          }), { headers: corsHeaders });
        } catch (error) {
          console.error('[ADMIN PIN]', error);
          return new Response(JSON.stringify({ valid: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // TASK LOGGING ENDPOINTS
      // ============================================================================

      // Get task logs
      if (url.pathname.startsWith('/api/tasks/logs/')) {
        const taskId = url.pathname.split('/api/tasks/logs/')[1];
        const logsKey = `task:logs:${taskId}`;
        const logs = await env.DATA.get(logsKey, 'json') || [];

        return new Response(JSON.stringify(logs), { headers: corsHeaders });
      }

      // Create task log entry
      if (url.pathname === '/api/tasks/log' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId, action, details, userId, userName } = body;

          if (!taskId || !action) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const logsKey = `task:logs:${taskId}`;
          const logs = await env.DATA.get(logsKey, 'json') || [];

          const logEntry = {
            id: `log_${Date.now()}`,
            taskId,
            action, // 'created', 'claimed', 'priority_set', 'completed', 'overdue', 'closed', etc.
            details: details || {},
            userId: userId || 'system',
            userName: userName || 'System',
            timestamp: new Date().toISOString()
          };

          logs.push(logEntry);
          await env.DATA.put(logsKey, JSON.stringify(logs));

          // Also add to global task activity log
          const globalKey = 'tasks:activity:all';
          const globalLogs = await env.DATA.get(globalKey, 'json') || [];
          globalLogs.push(logEntry);
          // Keep only last 1000 entries
          if (globalLogs.length > 1000) {
            globalLogs.shift();
          }
          await env.DATA.put(globalKey, JSON.stringify(globalLogs));

          return new Response(JSON.stringify({ success: true, log: logEntry }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASK LOG]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Get all task activity logs
      if (url.pathname === '/api/tasks/logs' && request.method === 'GET') {
        try {
          const globalKey = 'tasks:activity:all';
          const logs = await env.DATA.get(globalKey, 'json') || [];

          // Return most recent first
          return new Response(JSON.stringify(logs.reverse()), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASK LOGS]', error);
          return new Response(JSON.stringify({ error: error.message }), {
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

      if (url.pathname === '/api/admin/staff-analytics' && request.method === 'GET') {
        try {
          const staffId = (url.searchParams.get('staffId') || '').trim();
          if (!staffId) {
            return new Response(JSON.stringify({ success: false, error: 'Missing staffId' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          let matchedUserId = null;
          let matchedProfile = null;

          for (const userId of usersIndex) {
            const profile = await env.DATA.get(`profile:${userId}`, 'json');
            const candidateStaffId = (profile?.staffId || '').toString().trim();
            if (candidateStaffId && candidateStaffId.toLowerCase() === staffId.toLowerCase()) {
              matchedUserId = userId;
              matchedProfile = profile;
              break;
            }
          }

          if (!matchedUserId) {
            return new Response(JSON.stringify({ success: false, error: 'Staff member not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          const [account, absences, requests, sessions, eventsIndex] = await Promise.all([
            env.DATA.get(`user:${matchedUserId}`, 'json'),
            env.DATA.get(`absences:${matchedUserId}`, 'json'),
            env.DATA.get(`requests:${matchedUserId}`, 'json'),
            env.DATA.get(`timeclock:sessions:${matchedUserId}`, 'json'),
            env.DATA.get('events:index', 'json')
          ]);

          const safeAbsences = absences || [];
          const safeRequests = requests || [];
          const safeSessions = sessions || [];
          const safeEventsIndex = eventsIndex || [];

          let attended = 0;
          let unattended = 0;
          let unsure = 0;
          let respondedTotal = 0;

          for (const eventId of safeEventsIndex) {
            const event = await env.DATA.get(`events:${eventId}`, 'json');
            const response = event?.responses?.find(r => r.userId === matchedUserId);
            if (!response) continue;
            respondedTotal += 1;
            const normalized = String(response.status || '').toLowerCase();
            if (normalized === 'attend' || normalized === 'attending') attended += 1;
            else if (normalized === 'cannot' || normalized === 'not_attending') unattended += 1;
            else if (normalized === 'unsure') unsure += 1;
          }

          const notAnswered = Math.max(safeEventsIndex.length - respondedTotal, 0);

          return new Response(JSON.stringify({
            success: true,
            userId: matchedUserId,
            profile: matchedProfile,
            account: account || null,
            counts: {
              absences: safeAbsences.length,
              requests: safeRequests.length,
              clockins: safeSessions.length,
              eventsAttended: attended,
              eventsUnattended: unattended,
              eventsUnsure: unsure,
              eventsNotAnswered: notAnswered
            },
            absences: safeAbsences,
            requests: safeRequests,
            sessions: safeSessions
          }), { headers: corsHeaders });
        } catch (error) {
          console.error('[ADMIN STAFF ANALYTICS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
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

      // Verify and lookup Roblox profile
      if (url.pathname === '/api/roblox/lookup' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { robloxId } = body;

          if (!robloxId) {
            return new Response(JSON.stringify({ success: false, error: 'Missing robloxId' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          // Call Roblox API to verify user exists
          const robloxResponse = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
          
          if (!robloxResponse.ok) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'Roblox profile not found. Please check your ID.' 
            }), {
              status: 404,
              headers: corsHeaders
            });
          }

          const robloxUser = await robloxResponse.json();
          
          return new Response(JSON.stringify({
            success: true,
            profile: {
              id: robloxUser.id,
              username: robloxUser.name,
              displayName: robloxUser.displayName
            }
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to verify Roblox profile: ' + e.message 
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
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
                robloxId: account.profile.robloxId || '',
                robloxUsername: account.profile.robloxUsername || '',
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
          const { discordId, name, email, department, baseLevel, utilisation, robloxId, robloxUsername, staffId } = body;
          
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
          if (robloxId !== undefined) profile.robloxId = robloxId;
          if (robloxUsername !== undefined) profile.robloxUsername = robloxUsername;
          if (staffId !== undefined) profile.staffId = staffId;
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
          if (robloxId !== undefined) account.robloxId = robloxId;
          if (robloxUsername !== undefined) account.robloxUsername = robloxUsername;
          if (staffId !== undefined) account.staffId = staffId;
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
          
          const foundRequest = requests.find(r => r.id === requestId);
          if (foundRequest) {
            const normalized = (status || '').toLowerCase();
            foundRequest.status = normalized === 'approved' ? 'approved' : normalized === 'rejected' ? 'rejected' : normalized;
            foundRequest.approvedBy = adminName;
            foundRequest.approverName = adminName;
            foundRequest.approvedById = adminId || foundRequest.approvedById || null;
            foundRequest.approvedByAvatar = adminAvatar || foundRequest.approvedByAvatar || null;
            foundRequest.response = reason || foundRequest.response || '';
            foundRequest.approvedAt = new Date().toISOString();
            if (reason) foundRequest.adminNotes = reason;
            await env.DATA.put(requestsKey, JSON.stringify(requests));
            
            // Send Discord DM notification to user
            try {
              const embed = {
                title: status.toLowerCase() === 'approved' ? '✅ Request Approved' : '❌ Request Denied',
                description: `Your ${foundRequest.type || 'request'} has been **${status.toLowerCase()}** by ${adminName}.`,
                color: status.toLowerCase() === 'approved' ? 0x4CAF50 : 0xE74C3C,
                fields: [
                  { name: 'Request Type', value: foundRequest.type || 'General Request', inline: true },
                  { name: 'Details', value: foundRequest.details || foundRequest.comment || 'N/A', inline: false }
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
      // ADMIN AUTHENTICATION & VALIDATION
      // ============================================================================

      // Validate admin credentials securely
      if (url.pathname === '/api/admin/validate' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { discordId, pin } = body;

          if (!discordId || !pin) {
            return new Response(JSON.stringify({ success: false, error: 'Missing credentials' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          // Get admin credentials from environment variables
          // Format: ADMIN_{DISCORD_ID}_PIN and ADMIN_{DISCORD_ID}_NAME
          const adminPinKey = `ADMIN_${discordId}_PIN`;
          const adminNameKey = `ADMIN_${discordId}_NAME`;
          const adminPin = env[adminPinKey];
          const adminName = env[adminNameKey];

          if (!adminPin || adminPin !== pin) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
              status: 401,
              headers: corsHeaders
            });
          }

          // Check if account is suspended (stored in KV)
          const adminAccountKey = `admin:${discordId}`;
          const adminAccount = await env.DATA.get(adminAccountKey, 'json');

          if (adminAccount?.suspended) {
            return new Response(JSON.stringify({ success: false, error: 'Account suspended' }), {
              status: 403,
              headers: corsHeaders
            });
          }

          return new Response(JSON.stringify({
            success: true,
            adminId: discordId,
            adminName: adminName || 'Admin'
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // STAFF PROFILE FIELDS (Description, Notes, Alt Accounts, Promotion History)
      // ============================================================================

      // Get staff profile extra fields
      if (url.pathname.startsWith('/api/staff/profile/') && request.method === 'GET') {
        try {
          const userId = url.pathname.split('/api/staff/profile/')[1];
          const staffProfileKey = `staff:profile:${userId}`;
          const profile = await env.DATA.get(staffProfileKey, 'json') || {
            description: null,
            notes: null,
            altAccounts: [],
            promotionHistory: []
          };
          return new Response(JSON.stringify(profile), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Update staff profile fields
      if (url.pathname.startsWith('/api/staff/profile/') && request.method === 'POST') {
        try {
          const userId = url.pathname.split('/api/staff/profile/')[1];
          const body = await request.json();
          const { description, notes, altAccounts } = body;

          const staffProfileKey = `staff:profile:${userId}`;
          const profile = await env.DATA.get(staffProfileKey, 'json') || {
            description: null,
            notes: null,
            altAccounts: [],
            promotionHistory: []
          };

          if (description !== undefined) profile.description = description;
          if (notes !== undefined) profile.notes = notes;
          if (altAccounts !== undefined) profile.altAccounts = Array.isArray(altAccounts) ? altAccounts : [];

          await env.DATA.put(staffProfileKey, JSON.stringify(profile));
          return new Response(JSON.stringify({ success: true, profile }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Add promotion record
      if (url.pathname === '/api/staff/promotion' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, newBaseLevel, reason, promotedBy, promotedById, timestamp } = body;

          if (!userId || !newBaseLevel) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const staffProfileKey = `staff:profile:${userId}`;
          const profile = await env.DATA.get(staffProfileKey, 'json') || {
            description: null,
            notes: null,
            altAccounts: [],
            promotionHistory: []
          };

          const promotion = {
            id: `promo_${Date.now()}`,
            newBaseLevel,
            reason: reason || '',
            promotedBy: promotedBy || 'System',
            promotedById: promotedById || null,
            timestamp: timestamp || new Date().toISOString(),
            previousLevel: null
          };

          profile.promotionHistory = profile.promotionHistory || [];
          profile.promotionHistory.push(promotion);

          // Update user's actual base level
          const userKey = `user:${userId}`;
          const user = await env.DATA.get(userKey, 'json');
          if (user) {
            promotion.previousLevel = user.baseLevel;
            user.baseLevel = newBaseLevel;
            user.promotionHistory = user.promotionHistory || [];
            user.promotionHistory.push(promotion);
            await env.DATA.put(userKey, JSON.stringify(user));
          }

          await env.DATA.put(staffProfileKey, JSON.stringify(profile));

          // Send Discord DM notification
          await apiPost(`/api/send-dm`, {
            userId,
            embed: {
              title: '🎉 Promotion!',
              description: `Congratulations! You have been promoted to **${newBaseLevel}**\n\n**Reason:** ${reason || 'N/A'}\n\n**Promoted by:** ${promotedBy || 'System'}`,
              color: 0x22c55e
            }
          });

          return new Response(JSON.stringify({ success: true, promotion }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Get promotion history
      if (url.pathname.startsWith('/api/staff/promotions/') && request.method === 'GET') {
        try {
          const userId = url.pathname.split('/api/staff/promotions/')[1];
          const staffProfileKey = `staff:profile:${userId}`;
          const profile = await env.DATA.get(staffProfileKey, 'json') || {};
          return new Response(JSON.stringify({ promotions: profile.promotionHistory || [] }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
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
      // EVENTS ENDPOINTS (Staff Events with RSVP)
      // ============================================================================

      // Get all staff events (for both admin and staff)
      if (url.pathname === '/api/events' && request.method === 'GET') {
        try {
          const eventsIndex = await env.DATA.get('events:index', 'json') || [];
          const events = [];
          
          for (const eventId of eventsIndex) {
            const eventKey = `events:${eventId}`;
            const event = await env.DATA.get(eventKey, 'json');
            if (event) events.push({ id: eventId, ...event });
          }
          
          return new Response(JSON.stringify({ success: true, events }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, events: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Get admin staff events (same as above but for admin dashboard)
      if (url.pathname === '/api/admin/events' && request.method === 'GET') {
        try {
          const eventsIndex = await env.DATA.get('events:index', 'json') || [];
          const events = [];
          
          for (const eventId of eventsIndex) {
            const eventKey = `events:${eventId}`;
            const event = await env.DATA.get(eventKey, 'json');
            if (event) events.push({ _id: eventId, ...event });
          }
          
          return new Response(JSON.stringify({ success: true, events }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, events: [] }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Create a new staff event (admin only)
      if (url.pathname === '/api/admin/events' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { category, date, startTime, endTime, title, description, mandatory, createdBy, createdByName } = body;
          
          if (!category || !date || !startTime || !endTime || !title) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const eventData = {
            id: eventId,
            category,
            date,
            startTime,
            endTime,
            title,
            description: description || '',
            mandatory: mandatory || 'optional',
            createdBy,
            createdByName,
            createdAt: new Date().toISOString(),
            responses: []
          };
          
          // Save event
          await env.DATA.put(`events:${eventId}`, JSON.stringify(eventData));
          
          // Update index
          const eventsIndex = await env.DATA.get('events:index', 'json') || [];
          eventsIndex.push(eventId);
          await env.DATA.put('events:index', JSON.stringify(eventsIndex));
          
          return new Response(JSON.stringify({ success: true, eventId, event: eventData }), { headers: corsHeaders });
        } catch (e) {
          console.error('[EVENTS] Error creating event:', e);
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Record user RSVP response to an event
      if (url.pathname === '/api/events/respond' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { eventId, userId, userName, status, comment, respondedAt } = body;
          
          if (!eventId || !userId || !status) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }
          
          const eventKey = `events:${eventId}`;
          const event = await env.DATA.get(eventKey, 'json');
          
          if (!event) {
            return new Response(JSON.stringify({ success: false, error: 'Event not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }
          
          // Remove existing response from this user
          event.responses = event.responses?.filter(r => r.userId !== userId) || [];
          
          // Add new response
          event.responses.push({
            userId,
            userName,
            status,
            comment: comment || '',
            respondedAt: respondedAt || new Date().toISOString()
          });
          
          // Update event
          await env.DATA.put(eventKey, JSON.stringify(event));
          
          return new Response(JSON.stringify({ success: true, event }), { headers: corsHeaders });
        } catch (e) {
          console.error('[EVENTS] Error recording response:', e);
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      // Send event notifications to all staff
      if (url.pathname === '/api/admin/events/notify' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { eventId, eventTitle, eventDate, eventTime, eventDescription, mandatory, senderName, senderId } = body;

          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          console.log(`[EVENTS/NOTIFY] Starting notification for event "${eventTitle}". Users to notify: ${usersIndex.length}`);
          
          let sent = 0;
          let failed = 0;

          for (const userId of usersIndex) {
            if (!userId) continue;
            if (senderId && String(senderId) === String(userId)) {
              console.log(`[EVENTS/NOTIFY] Skipping sender ${userId}`);
              continue;
            }

            const ok = await sendDiscordDM(env, String(userId), {
              title: '📅 New Staff Event',
              description: `A new event has been posted in the staff portal.`,
              color: 0x6366f1,
              fields: [
                { name: 'Event', value: eventTitle || 'Untitled Event', inline: false },
                { name: 'Date', value: eventDate || 'TBA', inline: true },
                { name: 'Time', value: eventTime || 'TBA', inline: true },
                { name: 'Attendance', value: mandatory || 'optional', inline: true },
                { name: 'Details', value: truncateText(eventDescription || 'Open the calendar tab in portal for full details.', 1024), inline: false },
                { name: 'Posted By', value: senderName || 'OC Portal', inline: false }
              ],
              footer: { text: eventId ? `Event ID: ${eventId}` : 'Staff Portal Event' },
              timestamp: new Date().toISOString()
            });

            console.log(`[EVENTS/NOTIFY] User ${userId}: ${ok ? 'sent' : 'failed'}`);
            if (ok) sent += 1;
            else failed += 1;
          }

          console.log(`[EVENTS/NOTIFY] Complete - Sent: ${sent}, Failed: ${failed}, Total: ${usersIndex.length}`);
          return new Response(JSON.stringify({
            success: true,
            message: 'Notifications processed',
            sent,
            failed,
            total: usersIndex.length
          }), { headers: corsHeaders });
        } catch (e) {
          console.error('[EVENTS/NOTIFY] Error sending notifications:', e);
          return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
      }

      if (url.pathname === '/api/admin/broadcast-staff' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { senderId, senderName, message } = body;

          const safeMessage = String(message || '').trim();
          if (!safeMessage) {
            return new Response(JSON.stringify({ success: false, error: 'message required' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const usersIndex = await env.DATA.get('users:index', 'json') || [];
          let sent = 0;
          let failed = 0;

          for (const userId of usersIndex) {
            if (!userId) continue;
            if (senderId && String(senderId) === String(userId)) continue;

            const ok = await sendDiscordDM(env, String(userId), {
              title: '📣 Staff Broadcast Message',
              description: truncateText(safeMessage, 4000),
              color: 0x3b82f6,
              fields: [
                { name: 'From', value: senderName || senderId || 'OC Portal', inline: false }
              ],
              timestamp: new Date().toISOString()
            });

            if (ok) sent += 1;
            else failed += 1;
          }

          return new Response(JSON.stringify({
            success: true,
            sent,
            failed,
            total: usersIndex.length
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // CALENDAR ENDPOINTS
      // ============================================================================

      // Get user calendar events
      if (url.pathname.startsWith('/api/user/calendar/') && !url.pathname.includes('/create')) {
        const userId = url.pathname.split('/api/user/calendar/')[1];
        const calendarKey = `calendar:${userId}`;
        const events = await env.DATA.get(calendarKey, 'json') || [];

        return new Response(JSON.stringify(events), { headers: corsHeaders });
      }

      // Create calendar event
      if (url.pathname === '/api/user/calendar/create' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, title, date, startDate, description, createdBy } = body;

          if (!userId || !title || !date && !startDate) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const calendarKey = `calendar:${userId}`;
          const events = await env.DATA.get(calendarKey, 'json') || [];

          const newEvent = {
            id: `event_${Date.now()}`,
            title,
            date: date || startDate,
            description: description || '',
            createdBy: createdBy || userId,
            createdAt: new Date().toISOString()
          };

          events.push(newEvent);
          await env.DATA.put(calendarKey, JSON.stringify(events));

          return new Response(JSON.stringify({ success: true, event: newEvent }), { headers: corsHeaders });
        } catch (error) {
          console.error('[CALENDAR]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // TASKTRACK ENDPOINTS
      // ============================================================================

      // Get timeclock sessions for a user (cross-device sync)
      if (url.pathname.startsWith('/api/timeclock/sessions/') && request.method === 'GET') {
        try {
          const userId = url.pathname.split('/api/timeclock/sessions/')[1];
          if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing user ID' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const key = `timeclock:sessions:${userId}`;
          const sessions = await env.DATA.get(key, 'json') || [];
          return new Response(JSON.stringify({ success: true, sessions }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TIMECLOCK SESSIONS GET]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Save a timeclock session for a user (cross-device sync)
      if (url.pathname === '/api/timeclock/sessions/save' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { userId, session } = body;

          if (!userId || !session) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const key = `timeclock:sessions:${userId}`;
          const sessions = await env.DATA.get(key, 'json') || [];
          const existingIndex = sessions.findIndex(s => s.id === session.id);

          if (existingIndex >= 0) {
            sessions[existingIndex] = session;
          } else {
            sessions.push(session);
          }

          if (sessions.length > 250) {
            sessions.splice(0, sessions.length - 250);
          }

          await env.DATA.put(key, JSON.stringify(sessions));
          return new Response(JSON.stringify({ success: true, count: sessions.length }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TIMECLOCK SESSIONS SAVE]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Get user tasks
      if (url.pathname.startsWith('/api/tasks/user/')) {
        const userId = url.pathname.split('/api/tasks/user/')[1];
        const tasksKey = `tasks:${userId}`;
        const tasks = await env.DATA.get(tasksKey, 'json') || [];

        return new Response(JSON.stringify(tasks), { headers: corsHeaders });
      }

      // Get single task by ID
      if (url.pathname.startsWith('/api/tasks/') && !url.pathname.endsWith('/claim') && !url.pathname.endsWith('/priority') && !url.pathname.endsWith('/overdue') && !url.pathname.endsWith('/close') && !url.pathname.endsWith('/update') && !url.pathname.endsWith('/status') && !url.pathname.endsWith('/create') && !url.pathname.endsWith('/log') && request.method === 'GET') {
        try {
          const taskId = url.pathname.split('/api/tasks/')[1];
          if (!taskId) {
            return new Response(JSON.stringify({ error: 'Task ID required' }), { status: 400, headers: corsHeaders });
          }
          
          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');
          
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: corsHeaders });
          }
          
          return new Response(JSON.stringify(task), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS GET]', error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
      }

      // Create task
      if (url.pathname === '/api/tasks/create' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { title, description, dueDate, extraInfo, department, createdBy, createdByName, threadId } = body;

          if (!title || !department || !createdBy) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskId = `task_${Date.now()}`;
          const task = {
            id: taskId,
            title,
            description: description || '',
            dueDate: dueDate || '',
            extraInfo: extraInfo || '',
            department,
            createdBy,
            createdByName: createdByName || 'Unknown',
            threadId: threadId || null,
            status: 'open',
            priority: 'medium',
            claimedBy: null,
            claimedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
            updates: []
          };

          // Store task in general tasks index
          const tasksIndexKey = 'tasks:index';
          const tasksIndex = await env.DATA.get(tasksIndexKey, 'json') || [];
          tasksIndex.push(taskId);
          await env.DATA.put(tasksIndexKey, JSON.stringify(tasksIndex));

          // Store task details
          const taskKey = `task:${taskId}`;
          await env.DATA.put(taskKey, JSON.stringify(task));

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Claim task
      if (url.pathname === '/api/tasks/claim' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId, userId, userName } = body;

          if (!taskId || !userId) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');

          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          task.claimedBy = userId;
          task.claimedByName = userName || 'Unknown';
          task.claimedAt = new Date().toISOString();
          task.status = 'claimed';
          task.updatedAt = new Date().toISOString();
          task.updatedBy = userId;
          task.updatedByName = userName || 'Unknown';

          await env.DATA.put(taskKey, JSON.stringify(task));

          // Add to user's claimed tasks
          const userTasksKey = `tasks:${userId}`;
          const userTasks = await env.DATA.get(userTasksKey, 'json') || [];
          const existingTaskIndex = userTasks.findIndex(t => t.id === taskId);
          if (existingTaskIndex >= 0) {
            userTasks[existingTaskIndex] = task;
          } else {
            userTasks.push(task);
          }
          await env.DATA.put(userTasksKey, JSON.stringify(userTasks));

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Complete task
      if (url.pathname === '/api/tasks/complete' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId } = body;

          if (!taskId) {
            return new Response(JSON.stringify({ error: 'Missing task ID' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');

          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          task.status = 'complete';
          task.completedAt = new Date().toISOString();

          await env.DATA.put(taskKey, JSON.stringify(task));

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Set task priority
      if (url.pathname === '/api/tasks/priority' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId, priority, userId, userName } = body;

          if (!taskId || !priority) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const allowedPriorities = ['low', 'medium', 'high', 'critical'];
          const normalizedPriority = String(priority).toLowerCase();
          if (!allowedPriorities.includes(normalizedPriority)) {
            return new Response(JSON.stringify({ error: 'Invalid priority value' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');

          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          task.priority = normalizedPriority;
          task.updatedAt = new Date().toISOString();
          task.updatedBy = userId || 'system';
          task.updatedByName = userName || 'System';

          await env.DATA.put(taskKey, JSON.stringify(task));

          if (task.claimedBy) {
            const userTasksKey = `tasks:${task.claimedBy}`;
            const userTasks = await env.DATA.get(userTasksKey, 'json') || [];
            const updatedUserTasks = userTasks.map(t => t.id === taskId ? task : t);
            await env.DATA.put(userTasksKey, JSON.stringify(updatedUserTasks));
          }

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS PRIORITY]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Set task status (open, claimed, overdue, completed, closed)
      if (url.pathname === '/api/tasks/status' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId, status, userId, userName, threadId, createdBy, title, completedBy, completedAt, claimedAt, updates } = body;

          if (!taskId || !status) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const allowedStatuses = ['open', 'claimed', 'overdue', 'completed', 'closed'];
          const normalizedStatus = String(status).toLowerCase();
          if (!allowedStatuses.includes(normalizedStatus)) {
            return new Response(JSON.stringify({ error: 'Invalid status value' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');

          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          task.status = normalizedStatus;
          task.updatedAt = new Date().toISOString();
          task.updatedBy = userId || 'system';
          task.updatedByName = userName || 'System';

          if (normalizedStatus === 'completed' || normalizedStatus === 'closed') {
            task.completedAt = new Date().toISOString();
          }

          await env.DATA.put(taskKey, JSON.stringify(task));

          if (task.claimedBy) {
            const userTasksKey = `tasks:${task.claimedBy}`;
            const userTasks = await env.DATA.get(userTasksKey, 'json') || [];
            const updatedUserTasks = userTasks.map(t => t.id === taskId ? task : t);
            await env.DATA.put(userTasksKey, JSON.stringify(updatedUserTasks));
          }

          const resolvedThreadId = threadId || task.threadId;
          const resolvedCreatorId = createdBy || task.createdBy;
          const resolvedTitle = title || task.title || 'Task';
          const resolvedClaimedAt = claimedAt || task.claimedAt;
          const resolvedUpdates = Array.isArray(updates) ? updates : (task.updates || []);

          // Handle task completion webhook
          if ((normalizedStatus === 'completed' || normalizedStatus === 'closed') && resolvedThreadId) {
            try {
              // Build timeline
              let timeline = '';
              if (resolvedClaimedAt) timeline += `✅ **Claimed:** <t:${Math.floor(new Date(resolvedClaimedAt).getTime() / 1000)}:f>\n`;
              timeline += `✓ **Completed:** <t:${Math.floor(new Date().getTime() / 1000)}:f>`;
              
              // Build updates timeline
              let updatesTimeline = '';
              if (resolvedUpdates && resolvedUpdates.length > 0) {
                updatesTimeline += '\n\n**Update History:**\n';
                for (let i = 0; i < Math.min(resolvedUpdates.length, 3); i++) {
                  const update = resolvedUpdates[i];
                  updatesTimeline += `• ${update.content.substring(0, 100)}${update.content.length > 100 ? '...' : ''}\n`;
                }
                if (resolvedUpdates.length > 3) updatesTimeline += `• ... and ${resolvedUpdates.length - 3} more updates`;
              }
              
              // Send embed to thread
              const completionEmbed = {
                title: '✅ Task Completed',
                description: `**${resolvedTitle}** has been marked as complete`,
                color: 3066993,  // Green
                fields: [
                  {
                    name: 'Completed By',
                    value: completedBy || 'Unknown',
                    inline: true
                  },
                  {
                    name: 'Status',
                    value: '🎉 Complete',
                    inline: true
                  },
                  {
                    name: 'Timeline',
                    value: timeline,
                    inline: false
                  }
                ],
                timestamp: new Date().toISOString()
              };
              
              if (updatesTimeline) {
                completionEmbed.fields.push({
                  name: 'Updates',
                  value: updatesTimeline,
                  inline: false
                });
              }
              
              // Create content with mention
              let content = '';
              if (resolvedCreatorId) {
                content = `<@${resolvedCreatorId}> Task marked as complete.`;
              }
              
              // Send message
              const messageResponse = await fetch(`https://discord.com/api/v10/channels/${resolvedThreadId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  content: content || undefined,
                  embeds: [completionEmbed]
                })
              });
              
              if (messageResponse.ok) {
                // Close/lock the thread
                try {
                  // Edit thread name to add CLOSED prefix
                  await fetch(`https://discord.com/api/v10/channels/${resolvedThreadId}`, {
                    method: 'PATCH',
                    headers: {
                      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      name: `CLOSED: ${resolvedTitle}`,
                      locked: true,
                      archived: true
                    })
                  });
                } catch (threadUpdateError) {
                  console.log('[DISCORD] Could not update thread name (may lack permissions):', threadUpdateError.message);
                }
              }
            } catch (discordError) {
              console.error('[DISCORD] Failed to send completion webhook:', discordError.message);
              // Don't fail the request
            }
          }

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS STATUS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Update task
      if (url.pathname === '/api/tasks/update' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { taskId, update, threadId, userName } = body;

          if (!taskId || !update) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
              status: 400,
              headers: corsHeaders
            });
          }

          const taskKey = `task:${taskId}`;
          const task = await env.DATA.get(taskKey, 'json');

          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: corsHeaders
            });
          }

          task.updates = task.updates || [];
          task.updates.push({
            id: `update_${Date.now()}`,
            content: update,
            createdAt: new Date().toISOString()
          });

          await env.DATA.put(taskKey, JSON.stringify(task));

          const resolvedThreadId = threadId || task.threadId;

          // Send update to Discord thread if threadId is provided
          if (resolvedThreadId) {
            try {
              await fetch(`https://discord.com/api/v10/channels/${resolvedThreadId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  embeds: [{
                    title: '📝 Task Update',
                    description: update,
                    color: 9683183,  // Purple
                    author: {
                      name: userName || 'Unknown User'
                    },
                    timestamp: new Date().toISOString()
                  }]
                })
              });
            } catch (discordError) {
              console.error('[DISCORD] Failed to send update to thread:', discordError.message);
              // Don't fail the request if Discord fails
            }
          }

          return new Response(JSON.stringify({ success: true, task }), { headers: corsHeaders });
        } catch (error) {
          console.error('[TASKS]', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // ============================================================================
      // Serve portal HTML for non-API routes (SPA fallback)
      // ============================================================================

      // For any non-API route, try to serve from static assets
      // If static assets aren't available, serve a simple index redirect
      if (!url.pathname.startsWith('/api/')) {
        try {
          // Try to fetch the static file
          const response = await fetch(new URL('/index.html', request.url).toString());
          if (response.ok) {
            return new Response(response.body, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': origin
              }
            });
          }
        } catch (e) {
          // If static fetch fails, return a redirect or error
          console.log('[PORTAL-FALLBACK] Static fetch failed:', e.message);
        }
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
