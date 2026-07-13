importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAfYTPaEN8rT9juS_z_fpoxrNYQFicp5JY",
  authDomain: "madrasaapp-ait.firebaseapp.com",
  projectId: "madrasaapp-ait",
  storageBucket: "madrasaapp-ait.firebasestorage.app",
  messagingSenderId: "139052575052",
  appId: "1:139052575052:web:a9c980d102d53cf2fb87e9"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title || 'মাদ্রাসা', {
    body: body || '',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    data,
    tag: data.type || 'general',
    renotify: true,
  });
});

// Notification click → open/focus app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data ?? {};
  let url = data.url || '/';
  if (!data.url) {
    if (data.type === 'homework_published' || data.type === 'homework_reviewed') url = '/guardian/';
    else if (data.type === 'homework_submitted') url = '/teacher/';
    else if (data.type === 'notice_published') url = '/guardian/';
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
