/**
 * Backend API Endpoints for Commission Quote Management
 * Add these endpoints to your Cloudflare Worker (timeclock-backend)
 * 
 * Endpoints:
 * - GET  /api/quotes/list - List all quotes
 * - GET  /api/quotes/:id - Get quote by ID
 * - POST /api/quotes/create - Create new quote
 * - POST /api/quotes/:id/claim - Claim a quote
 * - POST /api/quotes/:id/payment - Update payment status
 * - POST /api/quotes/:id/invoice - Record invoice sent
 * - POST /api/quotes/:id/status - Update quote status
 */

// Add these to your Cloudflare Worker index.js

/**
 * Handle quote-related requests
 */
async function handleQuoteRequest(request, env, path) {
    const url = new URL(request.url);
    const pathParts = path.split('/');

    try {
        // GET /api/quotes/list
        if (request.method === 'GET' && path === '/api/quotes/list') {
            return await listQuotes(env);
        }

        // GET /api/quotes/:id
        if (request.method === 'GET' && pathParts[3]) {
            const quoteId = pathParts[3];
            return await getQuote(env, quoteId);
        }

        // POST /api/quotes/create
        if (request.method === 'POST' && path === '/api/quotes/create') {
            const data = await request.json();
            return await createQuote(env, data);
        }

        // POST /api/quotes/:id/claim
        if (request.method === 'POST' && pathParts[3] && pathParts[4] === 'claim') {
            const quoteId = pathParts[3];
            const data = await request.json();
            return await claimQuote(env, quoteId, data.claimedBy);
        }

        // POST /api/quotes/:id/payment
        if (request.method === 'POST' && pathParts[3] && pathParts[4] === 'payment') {
            const quoteId = pathParts[3];
            const data = await request.json();
            return await updatePaymentStatus(env, quoteId, data);
        }

        // POST /api/quotes/:id/invoice
        if (request.method === 'POST' && pathParts[3] && pathParts[4] === 'invoice') {
            const quoteId = pathParts[3];
            const data = await request.json();
            return await recordInvoiceSent(env, quoteId, data);
        }

        // POST /api/quotes/:id/status
        if (request.method === 'POST' && pathParts[3] && pathParts[4] === 'status') {
            const quoteId = pathParts[3];
            const data = await request.json();
            return await updateQuoteStatus(env, quoteId, data.status);
        }

        return new Response('Not found', { status: 404 });

    } catch (error) {
        console.error('Quote API error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * List all quotes
 */
async function listQuotes(env) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const quotes = rows.map((row, index) => ({
            id: row[0] || `QUOTE-${Date.now()}-${index}`,
            userId: row[1],
            username: row[2],
            price: parseFloat(row[3]) || 0,
            details: row[4],
            status: row[5] || 'pending',
            claimedBy: row[6] || null,
            createdAt: row[7] || new Date().toISOString(),
            paymentMethod: row[8] || null,
            paidAt: row[9] || null,
            invoiceSentAt: row[10] || null
        }));

        return new Response(JSON.stringify({ quotes }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error listing quotes:', error);
        throw error;
    }
}

/**
 * Get a specific quote by ID
 */
async function getQuote(env, quoteId) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === quoteId);

        if (rowIndex === -1) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const row = rows[rowIndex];
        const quote = {
            id: row[0],
            userId: row[1],
            username: row[2],
            price: parseFloat(row[3]) || 0,
            details: row[4],
            status: row[5] || 'pending',
            claimedBy: row[6] || null,
            createdAt: row[7] || new Date().toISOString(),
            paymentMethod: row[8] || null,
            paidAt: row[9] || null,
            invoiceSentAt: row[10] || null
        };

        return new Response(JSON.stringify(quote), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error getting quote:', error);
        throw error;
    }
}

/**
 * Create a new quote
 */
async function createQuote(env, data) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        const quoteId = `QUOTE-${Date.now()}`;
        const timestamp = new Date().toISOString();

        const values = [[
            quoteId,
            data.userId,
            data.username,
            data.price,
            data.details,
            'pending',
            '',
            timestamp,
            '',
            '',
            ''
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A:K',
            valueInputOption: 'RAW',
            resource: { values }
        });

        return new Response(JSON.stringify({ 
            success: true, 
            quoteId,
            message: 'Quote created successfully'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error creating quote:', error);
        throw error;
    }
}

/**
 * Claim a quote
 */
async function claimQuote(env, quoteId, claimedBy) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Find the quote
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === quoteId);

        if (rowIndex === -1) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if already claimed
        if (rows[rowIndex][6]) {
            return new Response(JSON.stringify({ error: 'Quote already claimed' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update the claimed by column (G)
        const updateRange = `CommissionQuotes!G${rowIndex + 2}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: updateRange,
            valueInputOption: 'RAW',
            resource: { values: [[claimedBy]] }
        });

        // Get updated quote
        const row = rows[rowIndex];
        const quote = {
            id: row[0],
            userId: row[1],
            username: row[2],
            price: parseFloat(row[3]) || 0,
            details: row[4],
            status: row[5] || 'pending',
            claimedBy: claimedBy,
            createdAt: row[7] || new Date().toISOString()
        };

        return new Response(JSON.stringify(quote), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error claiming quote:', error);
        throw error;
    }
}

/**
 * Update payment status
 */
async function updatePaymentStatus(env, quoteId, paymentData) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Find the quote
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === quoteId);

        if (rowIndex === -1) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update payment method (I) and paid at (J)
        const actualRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `CommissionQuotes!I${actualRow}:J${actualRow}`,
            valueInputOption: 'RAW',
            resource: { 
                values: [[
                    paymentData.paymentMethod,
                    paymentData.paidAt
                ]] 
            }
        });

        // Update status to 'paid'
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `CommissionQuotes!F${actualRow}`,
            valueInputOption: 'RAW',
            resource: { values: [['paid']] }
        });

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Payment status updated'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }
}

/**
 * Record invoice sent
 */
async function recordInvoiceSent(env, quoteId, invoiceData) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Find the quote
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === quoteId);

        if (rowIndex === -1) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update invoice sent timestamp (K)
        const actualRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `CommissionQuotes!K${actualRow}`,
            valueInputOption: 'RAW',
            resource: { values: [[invoiceData.invoiceSentAt]] }
        });

        // Update status to 'invoice_sent'
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `CommissionQuotes!F${actualRow}`,
            valueInputOption: 'RAW',
            resource: { values: [['invoice_sent']] }
        });

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Invoice recorded'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error recording invoice:', error);
        throw error;
    }
}

/**
 * Update quote status
 */
async function updateQuoteStatus(env, quoteId, status) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: await getAuthClient(env) });
        
        // Find the quote
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CommissionQuotes!A2:K',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === quoteId);

        if (rowIndex === -1) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update status (F)
        const actualRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: `CommissionQuotes!F${actualRow}`,
            valueInputOption: 'RAW',
            resource: { values: [[status]] }
        });

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Status updated'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
}

// Export the handler
module.exports = { handleQuoteRequest };
