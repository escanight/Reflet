// Service worker de Reflet : met l'application en cache pour un usage hors ligne.
// Il ne voit passer que les fichiers de l'application (même origine) ;
// aucune photo, aucune mesure ne transite par le réseau.
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
  if (url.origin !== self.location.origin) return; // rien d'externe n'est intercepté ni mis en cache
  // Page : réseau d'abord (mises à jour), cache en secours (hors ligne).
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  // Fichiers de l'application : cache d'abord.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
