const CACHE = 'huda-teacher-v24';
const IMAGES = ['/images/logo.png', '/images/headerlogo.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(IMAGES)).then(() => self.skipWaiting())
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

  // API — network only, no cache
  if (url.hostname === 'sbookapi.madrasatulhuda.com') {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{“HasError”:true,”message”:”অফলাইন”}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // JS/CSS — network first, cache fallback (ensures new code always loads)
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Images — cache first
  if (url.pathname.match(/\.(png|jpg|svg|ico|webp)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // HTML — network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
