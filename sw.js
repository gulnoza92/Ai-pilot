/**
 * AI Pilot — service worker of the mobile app
 * ------------------------------------------------------------
 * Keeps a copy of the app itself (page, icons, fonts) on the phone so it
 * opens at once, even while the server is still waking up. Tracker data is
 * never cached: every /api/ request goes straight to the server.
 *
 * Registered by app.html with the scope "/app", so the web monitor at "/"
 * is not affected.
 */

const CACHE = "aipilot-app-v1";
const SHELL = ["app", "app.webmanifest", "icon-192.png", "font-latin.woff2", "font-cyrillic.woff2"];

// Our server marks its files with this header (see server.js). A hosting
// provider's "service is starting" page does not have it and is never cached.
const isOurs = (res) => res && res.ok && res.headers.get("x-ai-pilot") === "1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            fetch(new Request(url, { cache: "reload" }))
              .then((res) => (isOurs(res) ? cache.put(url, res) : undefined))
              .catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("aipilot-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page itself: fresh copy from the network when the server answers in
// time, otherwise the copy kept on the phone.
async function pageFromNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("app"));
  try {
    const fresh = await fetchWithTimeout(request, cached ? 4000 : 30000);
    if (isOurs(fresh)) {
      cache.put("app", fresh.clone());
      return fresh;
    }
    return cached || fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// Icons, fonts, manifest: answer from the phone, refresh in the background.
async function assetFromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request)
    .then((res) => {
      if (isOurs(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return; // live data only
  if (request.mode === "navigate") {
    event.respondWith(pageFromNetworkFirst(request));
    return;
  }
  event.respondWith(assetFromCacheFirst(request));
});
