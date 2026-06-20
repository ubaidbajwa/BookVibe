/**
 * sw.js — Web Push service worker.
 *
 * Runs independently of any open tab, which is what lets a push notification
 * reach the user even when the site itself is closed. Kept deliberately minimal:
 * show the notification, and focus/open the right page on click.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'BookVibe', message: event.data.text() };
  }

  const title = payload.title || 'BookVibe';
  const options = {
    body: payload.message || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.id,
    data: { link: payload.link || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
