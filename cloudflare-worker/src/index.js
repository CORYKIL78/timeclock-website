import { 
    handleReportsFetch, 
    handleReportsCheckPending, 
    handleReportNotification 
} from './reports-handlers.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': 'https://portal.cirkledevelopment.co.uk',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Sentinel-Token',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        // Employee Reports Routes
        if (pathname === '/api/reports/fetch' && request.method === 'POST') {
            return handleReportsFetch(request, env);
        }

        if (pathname === '/api/reports/check-pending' && request.method === 'POST') {
            return handleReportsCheckPending(request, env);
        }

        if (pathname === '/api/notifications/report' && request.method === 'POST') {
            return handleReportNotification(request, env);
        }

        // Default response for unknown routes
        return new Response('Not Found', { status: 404 });
    },

    // Cron trigger for auto-processing reports
    async scheduled(event, env, ctx) {
        console.log('[CRON] Auto-processing pending reports...');
        try {
            await handleReportsCheckPending(
                new Request('http://internal/api/reports/check-pending', { 
                    method: 'POST',
                    body: JSON.stringify({})
                }), 
                env
            );
            console.log('[CRON] Successfully processed reports');
        } catch (error) {
            console.error('[CRON] Error processing reports:', error);
        }
    }
};
