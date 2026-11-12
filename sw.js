const CACHE = 'mamchkin-v5';

const FILES = [
  './',
  'index.html',
  'emblem.png',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'h-waiting.jpg',
  'h-team.jpg',
  'h-secret.jpg',
  'h-memories.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;

  const page = r.mode === 'navigate' || r.url.endsWith('index.html');

  if (page) {
    e.respondWith(
      fetch(r)
        .then(x => {
          const c = x.clone();
          caches.open(CACHE).then(h => h.put(r, c));
          return x;
        })
        .catch(() => caches.match(r).then(m => m || caches.match('index.html')
