// Service worker mínimo. Vive en la raíz (no en pwa/) porque su alcance es su propia carpeta
// y tiene que controlar index.html; GitHub Pages no deja ampliarlo con cabeceras.
const CACHE = "esc-v1";
const CORE = ["./", "./index.html", "./pwa/manifest.webmanifest", "./pwa/icon-192.png", "./pwa/icon-512.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // las llamadas a la API (POST) nunca pasan por la caché
  const url = new URL(req.url);

  // Archivos de la app: primero la red, para recibir siempre la última versión; la caché solo sin conexión.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Fuentes: primero la caché; no cambian.
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
