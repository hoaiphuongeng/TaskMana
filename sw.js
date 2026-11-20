// Taskmana Service Worker - PWA Offline Cache & Firebase Cloud Messaging Background Push
const CACHE_NAME = 'taskmana-ios-cache-v1';
const URLS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(URLS_TO_CACHE).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone).catch(() => {});
                    });
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Lắng nghe Web Push / FCM khi ứng dụng đang đóng hoặc chạy nền trên điện thoại
self.addEventListener('push', (event) => {
    let payloadData = {};
    if (event.data) {
        try {
            payloadData = event.data.json();
        } catch (e) {
            try {
                payloadData = JSON.parse(event.data.text());
            } catch (err) {
                payloadData = { body: event.data.text() };
            }
        }
    }

    const notifPayload = payloadData.notification || payloadData;
    const customData = payloadData.data || {};

    const title = notifPayload.title || customData.title || 'Taskmana - Có công việc mới được giao';
    const options = {
        body: notifPayload.body || customData.body || 'Bạn vừa nhận được một công việc mới cần xử lý.',
        icon: notifPayload.icon || customData.icon || '/logo.png',
        badge: notifPayload.badge || '/logo.png',
        tag: customData.taskId || customData.tag || ('taskmana-task-' + Date.now()),
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
            url: customData.url || notifPayload.click_action || './index.html?tab=tasks',
            taskId: customData.taskId || '',
            areaCategory: customData.areaCategory || '',
            priority: customData.priority || 'Normal'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Khi người dùng chạm vào thông báo trên điện thoại -> mở/focus app và chuyển đến mục Công việc
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notifData = event.notification.data || {};
    const targetUrl = notifData.url || './index.html?tab=tasks';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.postMessage({
                        type: 'OPEN_ASSIGNED_TASK',
                        taskId: notifData.taskId || '',
                        url: targetUrl
                    });
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
            return null;
        })
    );
});
