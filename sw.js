// ------- sw.js (v3) : cache robuste pour mode icône/hors-ligne -------
const CACHE_NAME = "atb-rules-v17";

// Liste des fichiers à pré-cacher
const PRECACHE = [
  "./", "./index.html", 
  "./styles.css", 
  "./app.js",  
  "./manifest.webmanifest",
  "./icons/icon-192.png", 
  "./icons/icon-512.png",
  "./img/bandeau.png",
  "./img/proba.png",
  "./img/adaptee.png",
  "./img/duree.png",
  "./img/rein.png",
  "./img/modalites.png",
  "./img/pneumonie.png",
  "./img/urinaire.png",
  "./img/abdo.png",
  "./img/neuro.png", 
  "./img/dermohypodermite.png",
  "./img/ecmo.png",
  "./img/mediastinite.png",
  "./img/antibioprophylaxie.png",
  "./img/antibioprophylaxies.png",
  "./img/fabrice.png",
  "./img/SARM.png",
  "./img/ampC.png",
  "./img/BLSE.png",
  "./img/pyo.png",
  "./img/acineto.png",
  "./img/steno.png",
  "./img/carba.png",
  "./img/erv.png",
  "./img/dialyse.png",
  "./img/modalite.png",
  // Retrait de pdf.js CDN car CORS/Policy
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Normalise les URLs (enlève l'origine) pour matcher le cache relatif
function toRelative(url) {
  const u = new URL(url, self.location.href);
  // Déduplique "/" et "./"
  let p = u.pathname;
  if (!p.endsWith("/") && u.search === "" && u.hash === "" && p.indexOf(".") === -1) {
    // Ex : "/atb/" -> on laissera passer la stratégie navigate ci-dessous
  }
  if (p.startsWith(self.registration.scope)) {
    p = p.slice(self.registration.scope.length);
  }
  if (p.startsWith("/")) p = "." + p; // "/index.html" => "./index.html"
  if (p === "" || p === ".") p = "./";
  return p;
}

self.addEventListener("fetch", (event) => {
  // On ne gère que GET
  if (event.request.method !== "GET") return;

  const reqUrl = new URL(event.request.url);

  // 1) Navigation (tap sur l'icône, liens internes) -> app shell
// => toujours servir l’app shell (index.html), même hors-ligne complet
if (event.request.mode === "navigate") {
  event.respondWith(
    caches.match("./index.html").then(cached => cached || fetch("./index.html"))
  );
  return;
}

  // Sécurité supplémentaire : si une navigation cible un .json, renvoyer l'app shell
if (event.request.destination === "document" && event.request.url.endsWith(".json")) {
  event.respondWith(caches.match("./index.html"));
  return;
}

  // 2) Cache-first pour nos fichiers de l'app
const rel = toRelative(event.request.url);
const important = PRECACHE.includes(rel);

event.respondWith(
  (async () => {
    // 1) essaie la clé normalisée (./img/...)
    let cached = await caches.match(rel);
    if (cached) return cached;

    // 2) sinon essaie avec la requête brute
    cached = await caches.match(event.request);
    if (cached) return cached;

    // 3) réseau + mise en cache si même origine
    try {
      const res = await fetch(event.request);
      try {
        const url = new URL(event.request.url);
        if (url.origin === self.location.origin) {
          const copy = res.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, copy);
        }
      } catch {}
      return res;
    } catch {
      // 4) fallback offline pour documents
      if (event.request.destination === "document") {
        return caches.match("./index.html");
      }
    }
  })()
);
});
