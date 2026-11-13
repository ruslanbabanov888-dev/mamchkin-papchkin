// Мамчкин и Папчкин — Service Worker
// Сетевой приоритет для страниц, кеш для статических ресурсов и офлайн-резерв.

const CACHE = 'mamchkin-papchkin-v6';
const LEGACY_CACHES = ['mamchkin-v3', 'mamchkin-v5'];

const CORE_FILES = [
  './',
  'index.html'
];

const OPTIONAL_FILES = [
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

const STATIC_DESTINATIONS = new Set([
  'image',
  'script',
  'style',
  'font',
  'worker'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Эти файлы обязательны для офлайн-запуска приложения.
    await cache.addAll(CORE_FILES);

    // Дополнительные изображения и иконки не должны срывать установку,
    // даже если один из необязательных файлов временно недоступен.
    await Promise.all(
      OPTIONAL_FILES.map(file => cache.add(file).catch(() => null))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    // Удаляем только кеши этого приложения и явно известные старые версии.
    await Promise.all(
      names
        .filter(name =>
          name.startsWith('mamchkin-papchkin-') ||
          LEGACY_CACHES.includes(name)
        )
        .filter(name => name !== CACHE)
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  // Не трогаем внешние сайты и другие проекты на общем домене github.io.
  if (
    requestUrl.origin !== scopeUrl.origin ||
    !requestUrl.pathname.startsWith(scopeUrl.pathname)
  ) return;

  const isPage =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    requestUrl.pathname.endsWith('/index.html');

  if (isPage) {
    // Для страниц сначала пробуем сеть, чтобы пользователь получал обновления.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;

        const appPage = await caches.match(
          new URL('index.html', scopeUrl).href
        );
        if (appPage) return appPage;

        return Response.error();
      }
    })());

    return;
  }

  // Кешируем только статические ресурсы приложения.
  // API-запросы и прочие динамические GET-запросы не сохраняем.
  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);

    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  })());
});
