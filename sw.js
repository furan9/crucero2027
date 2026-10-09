const CACHE = 'crucero-v15';
const MAPCACHE = 'crucero-maps-v1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'data/datos.enc', 'data/lugares.json', 'data/map-layers.json',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'vendor/pmtiles.js',
  'fonts/NotoSansRegular/0-255.pbf', 'fonts/NotoSansRegular/256-511.pbf', 'fonts/NotoSansRegular/8192-8447.pbf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== MAPCACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Cache primero; si hay red, se actualiza en segundo plano.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  if (new URL(e.request.url).pathname.endsWith('.pmtiles')) return e.respondWith(mapa(e.request));
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

// Los mapas se piden por rangos (HTTP Range): se sirven desde la caché cortando el archivo.
async function mapa(req) {
  const c = await caches.open(MAPCACHE);
  const hit = await c.match(req.url);
  if (!hit) return fetch(req);
  const range = req.headers.get('range');
  const blob = await hit.blob();
  if (!range) return new Response(blob, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = +m[1];
  const end = m[2] ? Math.min(+m[2], blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Content-Length': String(end - start + 1) },
  });
}
