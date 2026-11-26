// Service worker tối giản cho PWA: giữ "vỏ" app để mở nhanh và mở được khi mất mạng thoáng qua.
// KHÔNG chạm vào yêu cầu tới Firebase (khác nguồn) — dữ liệu luôn lấy trực tiếp từ máy chủ, không lưu ngoại tuyến.
const CACHE = 'khoa-shell-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google Fonts… đi thẳng ra mạng

  // Trang HTML: ưu tiên mạng (luôn nhận bản mới), rơi về bản đã lưu khi mất mạng.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./', res.clone());
        return res;
      } catch {
        return (await caches.match('./')) ?? Response.error();
      }
    })());
    return;
  }

  // Tệp tĩnh có băm tên (assets/*): dùng bản đã lưu nếu có, nếu chưa thì tải rồi lưu.
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
