/**
 * Backend API Endpoints for Employee Reports System
 * Add these endpoints to your Cloudflare Worker (timeclock-backend.marcusray.workers.dev)
 * 
 * NEW ENDPOINTS FOR REPORTS:
 * - POST /api/reports/fetch - Fetch all reports for a user
 * - POST /api/reports/check-pending - Auto-process pending reports (Submit status)
 * - POST /api/notifications/report - Send Discord DM when report is submitted
 * 
 * SECURITY:
 * - All endpoints use POST to prevent URL parameter leaking
 * - CORS restricted to portal.cirkledevelopment.co.uk
 * - No sensitive data exposed in responses
 * - Discord IDs validated before queries
 */

const { google } = require('googleapis');

// ============================================================================
// EMPLOYEE REPORTS FETCH API
// ============================================================================

/**
 * POST /api/reports/fetch
 * Fetch all employee reports for a specific user
 * Used by Staff Portal Reports tab
 */
async function handleReportsFetch(request, env) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return createJsonResponse({ 
                success: false, 
                error: 'userId is required' 
            }, 400);
        }

        // Validate Discord ID format (should be numeric string)
        if (!/^\d+$/.test(userId)) {
            return createJsonResponse({ 
                success: false, 
                error: 'Invalid userId format' 
            }, 400);
        }

        const sheets = google.sheets({ 
            version: 'v4', 
            auth: await getAuthClient(env) 
        });
        
        // Fetch from cirklehrReports sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrReports!A:I',
        });

        const rows = response.data.values || [];
        
        // Filter reports for this user (Column A = userId)
        // Skip header row
        const userReports = rows.slice(1)
            .filter(row => row[0] === userId)
            .map(row => ({
                userId: row[0],          // Column A - User ID
                reportType: row[2] || '',       // Column C - Report Type
                comment: row[3] || '',          // Column D - Comment
                selectScale: row[4] || '',      // Column E - Scale
                publishedBy: row[5] || 'Unknown', // Column F - Published By
                status: row[6] || '',           // Column G - Status
                timestamp: row[7] || '',        // Column H - Timestamp
                successStatus: row[8] || ''     // Column I - Success Status
            }))
            .filter(report => 
                // Only return successfully submitted reports
                report.status !== 'Remove' && 
                report.successStatus.includes('Success')
            );

        return createJsonResponse({
            success: true,
            reports: userReports,
            count: userReports.length
        }, 200);

    } catch (error) {
        console.error('[REPORTS] Fetch error:', error);
        return createJsonResponse({ 
            success: false, 
            error: 'Failed to fetch reports',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

// ============================================================================
// AUTO-PROCESS PENDING REPORTS
// ============================================================================

/**
 * POST /api/reports/check-pending
 * Check for reports with "Submit" status and process them
 * Should be called periodically via cron or from frontend polling
 */
async function handleReportsCheckPending(request, env) {
    try {
        const sheets = google.sheets({ 
            version: 'v4', 
            auth: await getAuthClient(env) 
        });
        
        // Fetch all reports
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrReports!A:I',
        });

        const rows = response.data.values || [];
        let processed = 0;
        let failed = 0;

        // Process each row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const userId = row[0];
            const reportType = row[2];
            const status = row[6]; // Column G
            const successStatus = row[8]; // Column I

            // Only process rows with "Submit" status and no success status yet
            if (status === 'Submit' && !successStatus) {
                try {
                    // Send Discord notification
                    const notificationSent = await sendReportNotification(env, {
                        discordId: userId,
                        reportType: reportType,
                        timestamp: new Date().toLocaleString()
                    });

                    const rowNum = i + 1;
                    const timestamp = new Date().toLocaleString();
                    const successText = notificationSent ? '✓ Success' : '✗ Failed: Notification error';

                    // Update timestamp and success status
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: env.SPREADSHEET_ID,
                        range: `cirklehrReports!H${rowNum}:I${rowNum}`,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[timestamp, successText]]
                        }
                    });

                    if (notificationSent) {
                        processed++;
                    } else {
                        failed++;
                    }

                } catch (error) {
                    console.error('[REPORTS] Processing error for row', i, ':', error);
                    
                    // Mark as failed in sheet
                    const rowNum = i + 1;
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: env.SPREADSHEET_ID,
                        range: `cirklehrReports!H${rowNum}:I${rowNum}`,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[
                                new Date().toLocaleString(),
                                `✗ Failed: ${error.message.substring(0, 50)}`
                            ]]
                        }
                    });
                    
                    failed++;
                }
            }
        }

        return createJsonResponse({
            success: true,
            message: `Processed ${processed} report(s), ${failed} failed`,
            processed: processed,
            failed: failed
        }, 200);

    } catch (error) {
        console.error('[REPORTS] Check pending error:', error);
        return createJsonResponse({ 
            success: false, 
            error: 'Failed to check pending reports',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

// ============================================================================
// SEND REPORT NOTIFICATION (DISCORD DM)
// ============================================================================

/**
 * POST /api/notifications/report
 * Send Discord DM notification when new report is submitted
 */
async function handleReportNotification(request, env) {
    try {
        const { discordId, reportData } = await request.json();

        if (!discordId) {
            return createJsonResponse({ 
                success: false, 
                error: 'discordId is required' 
            }, 400);
        }

        const sent = await sendReportNotification(env, {
            discordId,
            reportType: reportData?.type || 'N/A',
            timestamp: reportData?.date || new Date().toLocaleDateString()
        });

        if (sent) {
            return createJsonResponse({
                success: true,
                message: 'Notification sent successfully'
            }, 200);
        } else {
            return createJsonResponse({
                success: false,
                error: 'Failed to send notification'
            }, 500);
        }

    } catch (error) {
        console.error('[REPORTS] Notification error:', error);
        return createJsonResponse({ 
            success: false, 
            error: 'Failed to send notification',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

// ============================================================================
// HELPER FUNCTION: SEND DISCORD DM
// ============================================================================

/**
 * Send Discord DM to user about new report
 * @param {Object} env - Environment variables
 * @param {Object} data - Notification data
 * @returns {Promise<boolean>} - True if sent successfully
 */
async function sendReportNotification(env, { discordId, reportType, timestamp }) {
    try {
        // Validate Discord bot token exists
        if (!env.DISCORD_BOT_TOKEN) {
            console.error('[REPORTS] Discord bot token not configured');
            return false;
        }

        // Create DM channel with user
        const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                recipient_id: discordId 
            })
        });

        if (!channelResponse.ok) {
            const errorText = await channelResponse.text();
            console.error('[REPORTS] Failed to create DM channel:', errorText);
            return false;
        }

        const channel = await channelResponse.json();

        // Determine embed color based on report type
        let embedColor = 0x667eea; // Default purple
        let emoji = '📄';
        
        const reportTypeLower = reportType.toLowerCase();
        if (reportTypeLower.includes('commendation')) {
            embedColor = 0x10b981; // Green
            emoji = '⭐';
        } else if (reportTypeLower.includes('disruptive')) {
            embedColor = 0xef4444; // Red
            emoji = '⚠️';
        } else if (reportTypeLower.includes('negative')) {
            embedColor = 0xdc2626; // Dark red
            emoji = '❌';
        } else if (reportTypeLower.includes('monthly')) {
            embedColor = 0x3b82f6; // Blue
            emoji = '📊';
        }

        // Send DM with embed
        const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [{
                    title: `${emoji} Your report is in!`,
                    description: `Howdy <@${discordId}>, you have a new report available!\n\nPlease head to the **Disciplinaries** tab and click **"My Reports"** to view it.`,
                    fields: [
                        {
                            name: 'Report Type',
                            value: reportType || 'N/A',
                            inline: true
                        },
                        {
                            name: 'Date',
                            value: timestamp || 'N/A',
                            inline: true
                        }
                    ],
                    color: embedColor,
                    footer: {
                        text: 'Cirkle Development Staff Portal'
                    },
                    timestamp: new Date().toISOString()
                }]
            })
        });

        if (!messageResponse.ok) {
            const errorText = await messageResponse.text();
            console.error('[REPORTS] Failed to send DM:', errorText);
            return false;
        }

        console.log('[REPORTS] Successfully sent DM to user:', discordId);
        return true;

    } catch (error) {
        console.error('[REPORTS] Error sending Discord DM:', error);
        return false;
    }
}

// ============================================================================
// HELPER FUNCTION: CREATE JSON RESPONSE WITH CORS
// ============================================================================

/**
 * Create JSON response with proper CORS headers
 * SECURITY: Only allows portal.cirkledevelopment.co.uk origin
 */
function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://portal.cirkledevelopment.co.uk',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, X-Sentinel-Token',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        }
    });
}

// ============================================================================
// HELPER FUNCTION: GET GOOGLE AUTH CLIENT
// ============================================================================

/**
 * Get authenticated Google Sheets client
 * Uses service account credentials from environment
 */
async function getAuthClient(env) {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            type: 'service_account',
            project_id: env.GOOGLE_PROJECT_ID,
            private_key_id: env.GOOGLE_PRIVATE_KEY_ID,
            private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: env.GOOGLE_CLIENT_EMAIL,
            client_id: env.GOOGLE_CLIENT_ID,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth.getClient();
}

// ============================================================================
// ADD TO YOUR MAIN CLOUDFLARE WORKER ROUTER
// ============================================================================

/**
 * INTEGRATION INSTRUCTIONS:
 * 
 * Add these routes to your main Cloudflare Worker fetch handler:
 * 
 * export default {
 *   async fetch(request, env, ctx) {
 *     const url = new URL(request.url);
 *     const pathname = url.pathname;
 * 
 *     // Handle CORS preflight
 *     if (request.method === 'OPTIONS') {
 *       return new Response(null, {
 *         headers: {
 *           'Access-Control-Allow-Origin': 'https://portal.cirkledevelopment.co.uk',
 *           'Access-Control-Allow-Methods': 'POST, OPTIONS',
 *           'Access-Control-Allow-Headers': 'Content-Type',
 *           'Access-Control-Max-Age': '86400'
 *         }
 *       });
 *     }
 * 
 *     // Employee Reports Routes
 *     if (pathname === '/api/reports/fetch' && request.method === 'POST') {
 *       return handleReportsFetch(request, env);
 *     }
 * 
 *     if (pathname === '/api/reports/check-pending' && request.method === 'POST') {
 *       return handleReportsCheckPending(request, env);
 *     }
 * 
 *     if (pathname === '/api/notifications/report' && request.method === 'POST') {
 *       return handleReportNotification(request, env);
 *     }
 * 
 *     // ... your other routes ...
 *   }
 * }
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - DISCORD_BOT_TOKEN: Your Discord bot token
 * - SPREADSHEET_ID: Your Google Sheets ID
 * - GOOGLE_PROJECT_ID: Google service account project ID
 * - GOOGLE_PRIVATE_KEY_ID: Google service account private key ID
 * - GOOGLE_PRIVATE_KEY: Google service account private key
 * - GOOGLE_CLIENT_EMAIL: Google service account client email
 * - GOOGLE_CLIENT_ID: Google service account client ID
 * - DEBUG_MODE: (optional) Set to 'true' to expose error details
 * 
 * SETUP CRON TRIGGER (optional, for auto-processing):
 * Add to wrangler.toml:
 * 
 * [triggers]
 * crons = ["* * * * *"]  # Run every minute
 * 
 * Then add scheduled handler:
 * 
 * async scheduled(event, env, ctx) {
 *   // Auto-process pending reports
 *   await handleReportsCheckPending(
 *     new Request('http://internal/api/reports/check-pending', { 
 *       method: 'POST',
 *       body: JSON.stringify({})
 *     }), 
 *     env
 *   );
 * }
 */

module.exports = {
    handleReportsFetch,
    handleReportsCheckPending,
    handleReportNotification,
    sendReportNotification,
    createJsonResponse,
    getAuthClient
};
