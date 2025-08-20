/* SONQO — Service Worker minimal */
const CACHE = 'sonqo-v4'; // <— bump
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.webmanifest',
  './backgrounds.json',
  './icons/sonqo-180.png',
  './icons/sonqo-192.png',
  './icons/sonqo-512.png',
  './icons/sonqo-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }

  const url = new URL(req.url);
  if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')) || (p==='./' && url.pathname.endsWith('/')))) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  const isMedia = req.destination === 'image' || req.destination === 'video';
  if (isMedia) {
    e.respondWith((async ()=>{
      const cache = await caches.open('media-v1');
      const cached = await cache.match(req);
      const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(()=>cached);
      return cached || net;
    })());
    return;
  }

  e.respondWith(fetch(req).catch(()=>caches.match(req)));
});


