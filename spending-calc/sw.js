const CACHE_NAME = 'spending-calc-v1';
const urlsToCache = [
  './Js/main.js',
  './Js/feature.js',
  './index.html',  
  './style.css',
  './icon.jpg',
  './manifest.json',
  './offline.html'  
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch((err) => {
        // console.error('Error caching resources:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // console.log('Service Worker Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            // console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;  // Serve cached resource
      }
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(event.request, networkResponse.clone());  // Cache new network response
          return networkResponse;
        });
      }).catch(() => caches.match('./offline.html')); 
    })
  );
});



