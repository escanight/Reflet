// Service worker de Reflet : RÉSEAU D'ABORD pour toujours servir la dernière
// version, cache seulement en secours hors ligne. Ne touche qu'aux fichiers de
// l'application (même origine) ; aucune photo ni mesure ne transite par le réseau.
const VERSION = "2c434b1d4dfd";
const CACHE = `reflet-${VERSION}`;
const SHELL = ["./","./index.html","./app-2c434b1d4dfd.css","./manifest.webmanifest","./js-2c434b1d4dfd/analysis/detector.js","./js-2c434b1d4dfd/analysis/geometry.js","./js-2c434b1d4dfd/analysis/history.js","./js-2c434b1d4dfd/analysis/metrics.js","./js-2c434b1d4dfd/analysis/observations.js","./js-2c434b1d4dfd/analysis/points.js","./js-2c434b1d4dfd/analysis/quality.js","./js-2c434b1d4dfd/analysis/summary.js","./js-2c434b1d4dfd/analysis/uncertainty.js","./js-2c434b1d4dfd/app/install.js","./js-2c434b1d4dfd/app/router.js","./js-2c434b1d4dfd/app/state.js","./js-2c434b1d4dfd/content/glossary.js","./js-2c434b1d4dfd/content/support.js","./js-2c434b1d4dfd/image/input.js","./js-2c434b1d4dfd/image/validate.js","./js-2c434b1d4dfd/main.js","./js-2c434b1d4dfd/recommendations/catalog.js","./js-2c434b1d4dfd/recommendations/engine.js","./js-2c434b1d4dfd/storage/crypto.js","./js-2c434b1d4dfd/storage/schema.js","./js-2c434b1d4dfd/storage/store.js","./js-2c434b1d4dfd/ui/camera.js","./js-2c434b1d4dfd/ui/components.js","./js-2c434b1d4dfd/ui/dom.js","./js-2c434b1d4dfd/ui/landmarker.js","./js-2c434b1d4dfd/ui/overlay.js","./js-2c434b1d4dfd/ui/views/analyse.js","./js-2c434b1d4dfd/ui/views/dashboard.js","./js-2c434b1d4dfd/ui/views/data.js","./js-2c434b1d4dfd/ui/views/glossary.js","./js-2c434b1d4dfd/ui/views/help.js","./js-2c434b1d4dfd/ui/views/onboarding.js","./js-2c434b1d4dfd/ui/views/profile.js","./js-2c434b1d4dfd/ui/views/program.js","./js-2c434b1d4dfd/ui/views/results.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png"];

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
