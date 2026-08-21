/* 极简离线缓存：仅在 http/https 下由 main.js 注册 */
var CACHE = "dino-survival-v1";
var FILES = [
  "./", "./index.html", "./styles.css", "./icon.svg", "./manifest.webmanifest",
  "./src/util.js", "./src/audio.js", "./src/species.js", "./src/magic.js", "./src/world.js",
  "./src/creature.js", "./src/render.js", "./src/input.js", "./src/game.js", "./src/main.js"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return hit; });
    })
  );
});
