// Minimal service worker for PWA install capability
const CACHE_NAME = 'gyanoday-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Only intercept same-origin requests (don't cache Supabase API calls)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Simple network-first fallback strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Real Mobile Push Notification Event Handling
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'Gyanoday Niketan Alert', body: event.data.text() };
    }
  }

  const notification = payload.notification || payload;
  const title = notification.title || payload.title || 'Gyanoday Niketan Alert';
  const body = notification.body || payload.body || 'You have a new school alert.';
  const linkUrl = (payload.data && payload.data.linkUrl) || payload.linkUrl || '/';

  const options = {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: {
      linkUrl: linkUrl,
      ...payload.data
    },
    actions: [
      { action: 'open', title: 'View Details' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Tapping Notification Opens Deep-Linked Target Page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const linkUrl = event.notification.data?.linkUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(linkUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(linkUrl);
      }
    })
  );
});

