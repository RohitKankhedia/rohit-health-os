const CACHE_NAME = 'health-os-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

const DATA_URLS = [
  'https://raw.githubusercontent.com/RohitKankhedia/rohit-health-os/main/data/schedule/current.json',
  'https://raw.githubusercontent.com/RohitKankhedia/rohit-health-os/main/data/analytics/latest.json',
  'https://raw.githubusercontent.com/RohitKankhedia/rohitkankhediya.web/main/data/public_metrics.json',
  'https://raw.githubusercontent.com/RohitKankhedia/rohit-health-os/main/data/health/profile.json',
  'https://raw.githubusercontent.com/RohitKankhedia/rohit-health-os/main/data/library/exercises.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle data URLs with network-first strategy
  if (DATA_URLS.some(u => event.request.url.startsWith(u))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets - cache first
  if (event.request.method === 'GET') {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return empty JSON for data endpoints when offline
    if (request.url.includes('.json')) {
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for workout logs (when online)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts());
  }
});

async function syncWorkouts() {
  // This would sync any pending workout logs from IndexedDB
  // Implementation depends on how you store pending writes
  console.log('Background sync triggered');
}