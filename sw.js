// Service Worker for PWA offline support
const CACHE_NAME = 'staff-portal-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Skip CORS requests to external APIs
  if (event.request.url.includes('timeclock-backend.marcusray.workers.dev') ||
      event.request.url.includes('discord.com') ||
      event.request.url.includes('cdn.discordapp.com')) {
    return; // Let the browser handle these requests
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return offline page or cached content
          return caches.match('/index.html');
        });
      })
  );
});
