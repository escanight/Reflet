// Service worker de Reflet : RÉSEAU D'ABORD pour toujours servir la dernière
// version, cache seulement en secours hors ligne. Ne touche qu'aux fichiers de
// l'application (même origine) ; aucune photo ni mesure ne transite par le réseau.
const VERSION = "__BUILD_VERSION__";
const CACHE = `reflet-${VERSION}`;
const SHELL = __SHELL_FILES__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("reflet-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Le modèle (3 Mo) ne change qu'avec son empreinte : cache d'abord.
  const heavy = url.pathname.includes("/vendor/mediapipe/");
  if (heavy) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === "basic") caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
  );
});
