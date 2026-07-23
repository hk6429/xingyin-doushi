const CACHE = 'xyd-v202607230600';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './js/data.js', './js/store.js', './js/quiz.js', './js/report.js', './js/questionui.js',
  './js/dex.js', './js/battle.js', './js/backup.js', './js/app.js',
  './data/items.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// 先打網路拿最新版，網路失敗（離線）才退回快取，避免修好的 bug 因為「有快取
// 就永遠用快取」一直看不到最新版，逼學生每次都要手動清快取。
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)),
  );
});
