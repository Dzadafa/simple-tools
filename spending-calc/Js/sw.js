const CACHE_NAME = 'spending-calc-v1';
const urlsToCache = [
	'./main.js',
	'./feature.js',
	'../index.html',
	'../styles.css',
	'../icon.jpg'
];

self.addEventListener('install', event => {
	 event.waitUntil(
		 caches.open(CACHE_NAME)
		 .then(cache => cache.addAll(urlsToCache))
	 );
});

self.addEventListener('fetch', event => {
	 event.respondWith(
	      caches.match(event.request)
	     .then(response => {
		        return response || fetch(event.request);
	      })
	 );
});
