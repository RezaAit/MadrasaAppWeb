const CACHE = 'huda-guardian-v23';
const STATIC = [
  '/guardian/',
  '/guardian/index.html',
  '/guardian/css/style.css',
  '/guardian/js/dashboard.js',
  '/guardian/js/api.js',
  '/guardian/js/auth.js',
  '/guardian/js/fees.js',
  '/guardian/js/notice.js',
  '/guardian/js/attendance.js',
  '/guardian/js/homework.js',
  '/guardian/js/leave.js',
  '/shared/css/common.css',
  '/shared/js/api-config.js',
  '/shared/js/ripple.js',
  '/shared/js/tab-indicator.js',
  '/images/logo.png',
  '/images/headerlogo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
    // skipWaiting intentionally omitted â€” avoids page reload when camera returns focus
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
    // clients.claim() intentionally omitted â€” prevents SW from forcing page reload on camera return
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













