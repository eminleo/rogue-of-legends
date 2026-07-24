const CACHE_NAME = 'rogue-of-legends-v1.0.2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Noto+Sans+TC:wght@400;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Caching app assets...');
      await Promise.allSettled(
        PRECACHE_ASSETS.map(url => 
          fetch(url, { mode: 'cors' })
            .then(response => {
              if (response.ok || response.type === 'opaque') {
                return cache.put(url, response);
              }
            })
            .catch(err => console.warn('[SW] Precache failed for:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting outdated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 僅處理 GET 請求與 http/https 協定
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 背景異步更新快取 (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // 當快取無資料時（如字型、圖示 .woff2 檔），進行網路請求並自動備份至快取
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 離線且無快取時的 HTML 降級備案
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
