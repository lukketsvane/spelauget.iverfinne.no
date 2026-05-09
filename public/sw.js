// Stale-while-revalidate service worker. The shell + heavy assets are
// pre-cached on install so the game can launch fully offline once visited
// at least once. Bump CACHE_VERSION when the asset list changes.
const CACHE_VERSION = 'spelauget-v5';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/menu/menu_screen.png',
  '/menu/bt_new_game.png',
  '/menu/bt_continue.png',
  '/menu/bt_settings.png',
  '/models/sligo_01.glb',
  '/models/stjernekarakter.glb',
  '/models/boblehovud.glb',
  '/models/stone_hut.glb',
  '/models/rock_stack.stl',
  '/plante_01.png',
  '/plante_02.png',
  '/plante_03.png',
  '/plante_04.png',
  '/plante._01.png',
  '/ny_bakke_01.png',
  '/ny_bakke_02.png',
  '/ny_bakke_03.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for HTML/Next.js routes so updates land on next reload.
  // Cache-first for static assets — they're hashed or stable filenames.
  const url = new URL(req.url);
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.glb') ||
    url.pathname === '/manifest.json';

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        });
      }),
    );
    return;
  }

  // Network-first w/ cache fallback for everything else.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r ?? Response.error())),
  );
});
