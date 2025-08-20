/* sw.js — cache app shell + fallback offline */
const CACHE = 'sonqo-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './icons/sonqo-192.png',
  './icons/sonqo-512.png',
  './icons/sonqo-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Shell: cache-first
  if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')) || (p==='./' && url.pathname.endsWith('/')))) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // Default: network → fallback cache
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
