/**
 * Backend API Endpoints for Employee Management Discord Bot Commands
 * Add these endpoints to your Cloudflare Worker (timeclock-backend)
 * 
 * NEW ENDPOINTS TO ADD:
 * - POST /api/attendance/log - Log attendance for multiple users
 * - POST /api/events/create - Create new company event
 * - POST /api/employees/hire - Hire new employee with welcome email
 * - POST /api/employees/dismiss - Dismiss employee
 * - POST /api/absence/manual - Manually manage absences (add/remove/approve/deny)
 * 
 * These integrate with the Staff Portal and Google Sheets backend
 */

// ============================================================================
// ATTENDANCE LOGGING API
// ============================================================================

/**
 * POST /api/attendance/log
 * Log attendance for multiple users at events
 * Connected to Staff Portal attendance counter
 */
async function handleAttendanceLog(request, env) {
    try {
        const { userDiscordIds, eventName, loggedBy, timestamp } = await request.json();

        if (!userDiscordIds || !Array.isArray(userDiscordIds) || userDiscordIds.length === 0) {
            return jsonResponse({ success: false, error: 'userDiscordIds array is required' }, 400);
        }

        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Get current attendance data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrAttendance!A:E',
        });

        const rows = response.data.values || [];
        const updates = [];

        for (const discordId of userDiscordIds) {
            // Find user's row
            const rowIndex = rows.findIndex(row => row[0] === discordId);
            
            if (rowIndex >= 0) {
                // Increment attendance count
                const currentCount = parseInt(rows[rowIndex][1]) || 0;
                const newCount = currentCount + 1;
                
                updates.push({
                    range: `cirklehrAttendance!B${rowIndex + 1}`,
                    values: [[newCount]]
                });

                // Log event details
                const eventLog = `${eventName} | ${new Date(timestamp).toLocaleString()} | Logged by: ${loggedBy}`;
                updates.push({
                    range: `cirklehrAttendance!E${rowIndex + 1}`,
                    values: [[eventLog]]
                });
            } else {
                // Create new row for user
                updates.push({
                    range: 'cirklehrAttendance!A:E',
                    values: [[discordId, 1, '', '', `${eventName} | ${new Date(timestamp).toLocaleString()}`]]
                });
            }
        }

        // Batch update
        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: env.SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'RAW',
                    data: updates
                }
            });
        }

        return jsonResponse({
            success: true,
            message: `Logged attendance for ${userDiscordIds.length} user(s)`,
            eventName: eventName,
            usersLogged: userDiscordIds.length
        });

    } catch (error) {
        console.error('Attendance log error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// ============================================================================
// EVENTS CREATION API
// ============================================================================

/**
 * POST /api/events/create
 * Create new company event
 * Appears in Staff Portal events calendar and sends notifications
 */
async function handleEventCreate(request, env) {
    try {
        const { title, description, date, time, createdBy, createdAt } = await request.json();

        if (!title || !description || !date) {
            return jsonResponse({ success: false, error: 'title, description, and date are required' }, 400);
        }

        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Generate event ID
        const eventId = `EVT-${Date.now()}`;
        
        // Add event to cirklehrEvents sheet
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
                    createdAt || new Date().toISOString()
                ]]
            }
        });

        // Trigger notifications to all employees
        // This would integrate with your notification system
        // For now, we'll just return success

        return jsonResponse({
            success: true,
            message: 'Event created successfully',
            eventId: eventId,
            title: title,
            date: date
        });

    } catch (error) {
        console.error('Event creation error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// ============================================================================
// EMPLOYEE HIRE API
// ============================================================================

/**
 * POST /api/employees/hire
 * Hire new employee and send welcome email
 */
async function handleEmployeeHire(request, env) {
    try {
        const { discordId, discordUsername, name, role, department, hiredBy, hiredAt, sendWelcomeEmail } = await request.json();

        if (!discordId || !name || !role || !department) {
            return jsonResponse({ success: false, error: 'discordId, name, role, and department are required' }, 400);
        }

        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Add employee to cirklehrEmployees sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrEmployees!A:H',
            valueInputOption: 'RAW',
            resource: {
                values: [[
                    discordId,
                    discordUsername,
                    name,
                    role,
                    department,
                    'Active',
                    hiredAt || new Date().toISOString(),
                    hiredBy
                ]]
            }
        });

        // Send welcome email via internal mail system
        if (sendWelcomeEmail) {
            await sendInternalMail(env, {
                toUserId: discordId,
                fromUserId: 'system',
                subject: 'Welcome to Staff Portal',
                content: `Dear ${name},\n\nWelcome to your new Staff Portal. You have been hired as a ${role} in the ${department} department.\n\nPlease explore all the features and get familiar with everything. We hope you enjoy using the portal!\n\nKind Regards,\nCirkle Development`
            });
        }

        return jsonResponse({
            success: true,
            message: 'Employee hired successfully',
            employee: {
                discordId: discordId,
                name: name,
                role: role,
                department: department
            }
        });

    } catch (error) {
        console.error('Employee hire error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// ============================================================================
// EMPLOYEE DISMISS API
// ============================================================================

/**
 * POST /api/employees/dismiss
 * Dismiss employee and archive data
 */
async function handleEmployeeDismiss(request, env) {
    try {
        const { discordId, reason, dismissedBy, dismissedAt } = await request.json();

        if (!discordId) {
            return jsonResponse({ success: false, error: 'discordId is required' }, 400);
        }

        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Get employee data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrEmployees!A:H',
        });

        const rows = response.data.values || [];
        const employeeIndex = rows.findIndex(row => row[0] === discordId);

        if (employeeIndex < 0) {
            return jsonResponse({ success: false, error: 'Employee not found' }, 404);
        }

        const employeeName = rows[employeeIndex][2];

        // Update employee status to 'Dismissed'
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `cirklehrEmployees!F${employeeIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
                values: [['Dismissed']]
            }
        });

        // Add dismissal reason and date
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `cirklehrEmployees!I${employeeIndex + 1}:J${employeeIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
                values: [[dismissedAt || new Date().toISOString(), reason || 'No reason provided']]
            }
        });

        return jsonResponse({
            success: true,
            message: 'Employee dismissed successfully',
            employeeName: employeeName,
            discordId: discordId
        });

    } catch (error) {
        console.error('Employee dismiss error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// ============================================================================
// MANUAL ABSENCE MANAGEMENT API
// ============================================================================

/**
 * POST /api/absence/manual
 * Manually manage absences - add, remove, approve, or deny
 */
async function handleManualAbsence(request, env) {
    try {
        const { action, discordId, absenceId, type, startDate, endDate, reason, status, addedBy, approvedBy, deniedBy, removedBy } = await request.json();

        if (!action || !discordId) {
            return jsonResponse({ success: false, error: 'action and discordId are required' }, 400);
        }

        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });

        if (action === 'add') {
            // Add new absence
            if (!type || !startDate || !endDate || !reason) {
                return jsonResponse({ success: false, error: 'type, startDate, endDate, and reason are required for add action' }, 400);
            }

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
                        status || 'approved',
                        new Date().toISOString(),
                        addedBy,
                        'Manually added'
                    ]]
                }
            });

            return jsonResponse({
                success: true,
                message: 'Absence added successfully',
                absenceId: newAbsenceId
            });

        } else if (action === 'remove') {
            // Remove absence
            if (!absenceId) {
                return jsonResponse({ success: false, error: 'absenceId is required for remove action' }, 400);
            }

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: env.SPREADSHEET_ID,
                range: 'cirklehrAbsences!A:J',
            });

            const rows = response.data.values || [];
            const absenceIndex = rows.findIndex(row => row[0] === absenceId && row[1] === discordId);

            if (absenceIndex < 0) {
                return jsonResponse({ success: false, error: 'Absence not found' }, 404);
            }

            // Delete row (mark as deleted or actually remove)
            await sheets.spreadsheets.values.update({
                spreadsheetId: env.SPREADSHEET_ID,
                range: `cirklehrAbsences!G${absenceIndex + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [['deleted']]
                }
            });

            return jsonResponse({
                success: true,
                message: 'Absence removed successfully'
            });

        } else if (action === 'approve') {
            // Approve absence
            if (!absenceId) {
                return jsonResponse({ success: false, error: 'absenceId is required for approve action' }, 400);
            }

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: env.SPREADSHEET_ID,
                range: 'cirklehrAbsences!A:J',
            });

            const rows = response.data.values || [];
            const absenceIndex = rows.findIndex(row => row[0] === absenceId && row[1] === discordId);

            if (absenceIndex < 0) {
                return jsonResponse({ success: false, error: 'Absence not found' }, 404);
            }

            await sheets.spreadsheets.values.update({
                spreadsheetId: env.SPREADSHEET_ID,
                range: `cirklehrAbsences!G${absenceIndex + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [['approved']]
                }
            });

            return jsonResponse({
                success: true,
                message: 'Absence approved successfully'
            });

        } else if (action === 'deny') {
            // Deny absence
            if (!absenceId) {
                return jsonResponse({ success: false, error: 'absenceId is required for deny action' }, 400);
            }

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: env.SPREADSHEET_ID,
                range: 'cirklehrAbsences!A:J',
            });

            const rows = response.data.values || [];
            const absenceIndex = rows.findIndex(row => row[0] === absenceId && row[1] === discordId);

            if (absenceIndex < 0) {
                return jsonResponse({ success: false, error: 'Absence not found' }, 404);
            }

            await sheets.spreadsheets.values.update({
                spreadsheetId: env.SPREADSHEET_ID,
                range: `cirklehrAbsences!G${absenceIndex + 1}:H${absenceIndex + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [['denied', reason || 'No reason provided']]
                }
            });

            return jsonResponse({
                success: true,
                message: 'Absence denied successfully'
            });

        } else {
            return jsonResponse({ success: false, error: 'Invalid action. Must be: add, remove, approve, or deny' }, 400);
        }

    } catch (error) {
        console.error('Manual absence error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send internal mail via Staff Portal mail system
 */
async function sendInternalMail(env, { toUserId, fromUserId, subject, content }) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        const mailId = `MAIL-${Date.now()}`;
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'cirklehrMail!A:G',
            valueInputOption: 'RAW',
            resource: {
                values: [[
                    mailId,
                    fromUserId,
                    toUserId,
                    subject,
                    content,
                    new Date().toISOString(),
                    'unread'
                ]]
            }
        });

        return { success: true, mailId: mailId };
    } catch (error) {
        console.error('Send internal mail error:', error);
        return { success: false, error: error.message };
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// ============================================================================
// ADD TO YOUR MAIN WORKER ROUTER
// ============================================================================

/**
 * Add these routes to your main Cloudflare Worker fetch handler:
 * 
 * if (pathname === '/api/attendance/log' && request.method === 'POST') {
 *     return handleAttendanceLog(request, env);
 * }
 * 
 * if (pathname === '/api/events/create' && request.method === 'POST') {
 *     return handleEventCreate(request, env);
 * }
 * 
 * if (pathname === '/api/employees/hire' && request.method === 'POST') {
 *     return handleEmployeeHire(request, env);
 * }
 * 
 * if (pathname === '/api/employees/dismiss' && request.method === 'POST') {
 *     return handleEmployeeDismiss(request, env);
 * }
 * 
 * if (pathname === '/api/absence/manual' && request.method === 'POST') {
 *     return handleManualAbsence(request, env);
 * }
 */
