/* =====================================================
   EDUPLAT — Service Worker
   Caché estático seguro (Stale-While-Revalidate) y fallback offline
   ===================================================== */

const CACHE_NAME = 'eduplat-assets-v2';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
    OFFLINE_URL,
    '/css/styles.css',
    '/css/aula.css',
    '/js/navbar-auth.js',
    '/js/aula.js',
    '/favicon.svg',
    '/favicon.ico'
];

// ── Instalación: precachea recursos esenciales y offline.html ──
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

// ── Activación: limpia cachés obsoletos ──
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: navegación offline y stale-while-revalidate seguro para assets ──
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo interceptar peticiones GET del mismo origen
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // NUNCA cachear rutas privadas, APIs ni autenticación
    if (
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/docente') ||
        url.pathname.startsWith('/panel') ||
        url.pathname.startsWith('/configuracion') ||
        url.pathname.startsWith('/api') ||
        url.pathname === '/logout'
    ) {
        return;
    }

    // 1. Navegación HTML: Network-first con fallback a offline.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_URL))
            )
        );
        return;
    }

    // 2. Archivos estáticos (/css/, /js/, /img/, /favicon): Stale-While-Revalidate
    const isStaticAsset =
        url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/img/') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.webmanifest');

    if (isStaticAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null);

                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});
