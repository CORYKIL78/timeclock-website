// Service Worker for PWA offline support
const CACHE_NAME = 'staff-portal-v' + new Date().getTime();
const STATIC_CACHE = 'staff-portal-static-v4';
const DYNAMIC_CACHE = 'staff-portal-dynamic-v4';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css?v=3.0.3',
  '/script.js?v=2.1.0'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(urlsToCache)),
      // Delete old caches on every update
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && !cacheName.includes('staff-portal-v')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Cleanup old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && 
                   !cacheName.startsWith('staff-portal-v');
          }).map(cacheName => {
            console.log('[SW] Deleting cache during activation:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      // Notify all clients to refresh
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_UPDATE',
            message: 'New version available. Refresh your page to update.'
          });
        });
      })
    ])
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
  
  // Skip CORS requests to external APIs - CRITICAL for backend/Discord
  if (url.includes('timeclock-backend.marcusray.workers.dev') ||
      url.includes('discord.com') ||
      url.includes('cdn.discordapp.com') ||
      url.includes('googleapis.com') ||
      url.includes('sheets.googleapis.com')) {
    return; // Let browser handle these
  }
  
  // Always fetch HTML fresh
  if (request.mode === 'navigate' || url.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return caches.match(request);
          }
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, responseToCache));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  
  // Cache static assets with fallback
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseToCache));
            return response;
          })
          .catch(() => {
            // Return cached or offline page
            return caches.match('/index.html');
          });
      })
  );
});
