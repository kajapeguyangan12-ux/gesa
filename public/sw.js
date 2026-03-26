self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isTileRequest = url.hostname.endsWith("tile.openstreetmap.org");

  if (!isTileRequest || request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open("gesa-basemap-v1").then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(request));
    })
  );
});
