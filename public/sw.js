/* CorteCerto service worker — cache only public shell assets. Never cache APIs or auth data. */
const VERSION = "cc-v1";
const SHELL = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isSensitive(url) {
  const path = url.pathname;
  if (path.startsWith("/api/")) return true;
  if (path.startsWith("/dashboard")) return true;
  if (path.startsWith("/agenda")) return true;
  if (path.startsWith("/clientes")) return true;
  if (path.startsWith("/comandas")) return true;
  if (path.startsWith("/caixa")) return true;
  if (path.startsWith("/financeiro")) return true;
  if (path.startsWith("/estoque")) return true;
  if (path.startsWith("/comissoes")) return true;
  if (path.startsWith("/faturamento")) return true;
  if (path.startsWith("/whatsapp")) return true;
  if (path.startsWith("/clube")) return true;
  if (path.startsWith("/equipe")) return true;
  if (path.startsWith("/servicos")) return true;
  if (path.startsWith("/lista-espera")) return true;
  if (path.startsWith("/relatorios")) return true;
  if (path.startsWith("/admin")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isSensitive(url)) {
    // Always network for app data and APIs — never serve stale private content
    if (url.pathname.startsWith("/api/")) {
      return; // default browser fetch
    }
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline").then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Navigations: network-first, offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match("/offline"))
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
