// Service worker: permite instalar o app e usá-lo sem internet.
// Estratégia "rede primeiro": sempre tenta a versão mais nova e cai no cache se estiver offline.
const CACHE = "mbc-facens-v5";
const ARQUIVOS = [
  "./", "index.html", "styles.css", "data.js", "native.js", "app.js", "manifest.webmanifest",
  "assets/mapa-facens.webp", "assets/mapa-facens-vertical.jpg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
