// Employee Reports API Handlers
// Integrated from discord-bot/backend-reports-api.js

/**
 * POST /api/reports/fetch
 * Fetch all employee reports for a specific user
 */
export async function handleReportsFetch(request, env) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return jsonResponse({ 
                success: false, 
                error: 'userId is required' 
            }, 400);
        }

        // Validate Discord ID format
        if (!/^\d+$/.test(userId)) {
            return jsonResponse({ 
                success: false, 
                error: 'Invalid userId format' 
            }, 400);
        }
        
        // Fetch from cirklehrReports sheet
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/cirklehrReports!A:I?key=${env.GOOGLE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Google Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];
        
        // Filter reports for this user (Column A = userId)
        const userReports = rows.slice(1)
            .filter(row => row[0] === userId)
            .map(row => ({
                userId: row[0],
                reportType: row[2] || '',
                comment: row[3] || '',
                selectScale: row[4] || '',
                publishedBy: row[5] || 'Unknown',
                status: row[6] || '',
                timestamp: row[7] || '',
                successStatus: row[8] || ''
            }))
            .filter(report => 
                report.status !== 'Remove' && 
                report.successStatus.includes('Success')
            );

        return jsonResponse({
            success: true,
            reports: userReports,
            count: userReports.length
        });

    } catch (error) {
        console.error('[REPORTS] Fetch error:', error);
        return jsonResponse({ 
            success: false, 
            error: 'Failed to fetch reports',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

/**
 * POST /api/reports/check-pending
 * Check for reports with "Submit" status and process them
 */
export async function handleReportsCheckPending(request, env) {
    try {
        // Fetch all reports
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/cirklehrReports!A:I?key=${env.GOOGLE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Google Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];
        let processed = 0;
        let failed = 0;

        // Process each row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const userId = row[0];
            const reportType = row[2];
            const status = row[6];
            const successStatus = row[8];

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
                    await updateSheetCell(env, `cirklehrReports!H${rowNum}:I${rowNum}`, [[timestamp, successText]]);

                    if (notificationSent) {
                        processed++;
                    } else {
                        failed++;
                    }

                } catch (error) {
                    console.error('[REPORTS] Processing error for row', i, ':', error);
                    
                    const rowNum = i + 1;
                    await updateSheetCell(env, `cirklehrReports!H${rowNum}:I${rowNum}`, [[
                        new Date().toLocaleString(),
                        `✗ Failed: ${error.message.substring(0, 50)}`
                    ]]);
                    
                    failed++;
                }
            }
        }

        return jsonResponse({
            success: true,
            message: `Processed ${processed} report(s), ${failed} failed`,
            processed,
            failed
        });

    } catch (error) {
        console.error('[REPORTS] Check pending error:', error);
        return jsonResponse({ 
            success: false, 
            error: 'Failed to check pending reports',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

/**
 * POST /api/notifications/report
 * Send Discord DM notification when new report is submitted
 */
export async function handleReportNotification(request, env) {
    try {
        const { discordId, reportData } = await request.json();

        if (!discordId) {
            return jsonResponse({ 
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
            return jsonResponse({
                success: true,
                message: 'Notification sent successfully'
            });
        } else {
            return jsonResponse({
                success: false,
                error: 'Failed to send notification'
            }, 500);
        }

    } catch (error) {
        console.error('[REPORTS] Notification error:', error);
        return jsonResponse({ 
            success: false, 
            error: 'Failed to send notification',
            details: env.DEBUG_MODE ? error.message : undefined
        }, 500);
    }
}

// Helper: Send Discord DM
async function sendReportNotification(env, { discordId, reportType, timestamp }) {
    try {
        if (!env.DISCORD_BOT_TOKEN) {
            console.error('[REPORTS] Discord bot token not configured');
            return false;
        }

        // Create DM channel
        const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: discordId })
        });

        if (!channelResponse.ok) {
            console.error('[REPORTS] Failed to create DM channel');
            return false;
        }

        const channel = await channelResponse.json();

        // Determine embed color
        let embedColor = 0x667eea;
        let emoji = '📄';
        
        const reportTypeLower = reportType.toLowerCase();
        if (reportTypeLower.includes('commendation')) {
            embedColor = 0x10b981;
            emoji = '⭐';
        } else if (reportTypeLower.includes('disruptive')) {
            embedColor = 0xef4444;
            emoji = '⚠️';
        } else if (reportTypeLower.includes('negative')) {
            embedColor = 0xdc2626;
            emoji = '❌';
        } else if (reportTypeLower.includes('monthly')) {
            embedColor = 0x3b82f6;
            emoji = '📊';
        }

        // Send DM
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
            console.error('[REPORTS] Failed to send DM');
            return false;
        }

        console.log('[REPORTS] Successfully sent DM to user:', discordId);
        return true;

    } catch (error) {
        console.error('[REPORTS] Error sending Discord DM:', error);
        return false;
    }
}

// Helper: Update Google Sheet cell
async function updateSheetCell(env, range, values) {
    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?valueInputOption=RAW&key=${env.GOOGLE_API_KEY}`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values })
        }
    );
    return response.ok;
}

// Helper: JSON response with CORS
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
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
