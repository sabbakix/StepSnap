// StepSnap Service Worker - PWA Offline Support
const CACHE_NAME = 'stepsnap-v2';

// Risorse essenziali da mettere in cache immediatamente.
// Gli asset con hash generati da Vite vengono cacheati a runtime dal fetch handler.
const PRECACHE_URLS = [
  './',
  './index.html',
  './icon-512.png',
  './manifest.json'
];

// INSTALL: Pre-cache delle risorse principali
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: Pulizia delle vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Strategia Network-First con fallback alla cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non-GET e richieste cross-origin
  if (event.request.method !== 'GET') return;

  // Per le risorse dell'app: Network first, poi cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se la risposta è valida, salva una copia nella cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se il network fallisce, usa la cache
        return caches.match(event.request);
      })
  );
});
