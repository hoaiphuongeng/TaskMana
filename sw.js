const CACHE_NAME = 'taskmana-ios-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => console.warn('SW cache err:', err));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Nhận thông báo đẩy FCM khi app chạy nền hoặc khóa màn hình
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { title: 'Taskmana', body: event.data ? event.data.text() : 'Bạn có công việc mới.' } };
  }

  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || data.title || '📋 Bạn có công việc mới được giao';
  const options = {
    body: notif.body || data.body || 'Mở Taskmana để xem chi tiết.',
    icon: notif.icon || data.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.taskId || ('bg-task-' + Date.now()),
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './index.html?tab=tasks',
      taskId: data.taskId || ''
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Mở ứng dụng và chuyển tới đúng công việc khi bấm vào thông báo
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || './index.html?tab=tasks';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_ASSIGNED_TASK', taskId: notifData.taskId || '' });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
