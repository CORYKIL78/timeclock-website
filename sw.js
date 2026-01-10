// Service Worker for PWA offline support
const CACHE_NAME = 'staff-portal-v' + new Date().getTime();
const STATIC_CACHE = 'staff-portal-static-v2';
const DYNAMIC_CACHE = 'staff-portal-dynamic-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(urlsToCache)),
      // Delete old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && !cacheName.includes('staff-portal-v')) {
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
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && 
                 !cacheName.startsWith('staff-portal-v');
        }).map(cacheName => caches.delete(cacheName))
      );
    })
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
