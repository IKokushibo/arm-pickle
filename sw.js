const CACHE = "arm-court-v46";
const PRECACHE = [
  "/",
  "/index.html",
  "/book.html",
  "/confirm.html",
  "/pay.html",
  "/login.html",
  "/admin.html",
  "/manifest.webmanifest",
  "/js/pwa.js",
  "/assets/logo.png",
  "/assets/hero-banner.png",
  "/assets/courts/match.jpg",
  "/assets/courts/training.jpg",
  "/assets/courts/group.jpg",
  "/assets/courts/doubles.jpg",
  "/assets/courts/social.jpg",
  "/assets/courts/night.jpg",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isOpaqueAsset(url) {
  return /\.(?:css|js)(?:$|\?)/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer fresh CSS/JS so layout fixes show up after hard refresh.
  if (isOpaqueAsset(url) || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            const key = request.mode === "navigate" ? url.pathname : request;
            caches.open(CACHE).then((cache) => cache.put(key, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request.mode === "navigate" ? url.pathname : request).then(
            (cached) => cached || (request.mode === "navigate" ? caches.match("/index.html") : undefined)
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
