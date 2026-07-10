const CACHE = 'huda-teacher-v16';
const STATIC = [
  '/teacher/',
  '/teacher/index.html',
  '/teacher/css/style.css',
  '/teacher/js/dashboard.js',
  '/teacher/js/api.js',
  '/teacher/js/auth.js',
  '/teacher/js/attendance.js',
  '/teacher/js/homework.js',
  '/teacher/js/homework-create.js',
  '/teacher/js/leave.js',
  '/teacher/js/notice.js',
  '/teacher/js/marks-entry.js',
  '/teacher/js/fees.js',
  '/teacher/js/profile.js',
  '/shared/css/common.css',
  '/shared/js/api-config.js',
  '/shared/js/ripple.js',
  '/shared/js/tab-indicator.js',
  '/images/logo.png',
  '/images/headerlogo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls â€” network first, no cache
  if (url.hostname === 'sbookapi.madrasatulhuda.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('{"HasError":true,"message":"à¦…à¦«à¦²à¦¾à¦‡à¦¨"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Static assets â€” cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
