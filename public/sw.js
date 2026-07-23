// Minimal pass-through service worker. It exists only to satisfy PWA
// installability (Chrome requires a registered worker with a fetch handler
// before it will offer "Install"). It caches nothing and never calls
// respondWith, so every request goes straight to the network as usual — no
// risk of serving stale content.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
