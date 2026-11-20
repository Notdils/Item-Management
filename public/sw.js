// Service worker minimal: aplikasi bisa di-install, aset statis di-cache.
// Halaman dan data TIDAK di-cache (data anggota, selalu ambil terbaru dari server).
const CACHE = "bengkel-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Bengkel Anargya</title><body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#e3e4df;color:#1c1f1e;font-family:system-ui;padding:24px;text-align:center">
<div><h1 style="font-size:24px">Tidak ada koneksi</h1><p style="opacity:.7">Laporan butuh internet supaya tercatat. Coba lagi saat sinyal kembali.</p>
<button onclick="location.reload()" style="min-height:48px;padding:0 20px;border:0;border-radius:10px;background:#1c1f1e;color:#f6f6f2;font-weight:600">Coba lagi</button></div></body></html>`;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
    return;
  }
  // Aset build Next.js punya hash di nama file, aman di-cache selamanya
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
  }
});
