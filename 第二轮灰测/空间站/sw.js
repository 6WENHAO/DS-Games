/**
 * sw.js —— Voxel Space Station 的 Service Worker
 *
 * 运行在「经典 Worker」环境，无 import / export（不使用 ES Module 语法），
 * 全部通过 self.addEventListener 注册。
 *
 * 缓存策略一览：
 *   - 导航请求（navigate）        → network-first，失败回落缓存的 ./index.html
 *   - ./src/ 与 ./styles/ 资源    → stale-while-revalidate（先回缓存，后台刷新）
 *   - 其他同源资源               → cache-first + 后台填充
 *   - 跨源请求                    → 直接 return，不拦截
 */

// 版本化缓存名：升级缓存只需递增版本号（如 celestial-spire-v2）
const CACHE_NAME = 'celestial-spire-v1';

// 核心外壳：只预缓存少量入口，其余大量 ES Module 靠运行时缓存
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles/hud.css',
  './src/main.js',
];

/* install：预缓存核心外壳；单个失败不阻塞安装，完成后 skipWaiting() */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url))
      ))
      .then(() => self.skipWaiting())
  );
});

/* activate：删除旧版本缓存，并立即接管现有页面 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* fetch：只处理同源 GET，其余一律放行（return，不拦截） */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 非 GET 不拦截
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 跨源请求不拦截
  if (url.origin !== self.location.origin) return;

  // 导航请求：network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // ./src/ 与 ./styles/ 下的资源：stale-while-revalidate
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/styles/')) {
    const swr = staleWhileRevalidate(request);
    event.respondWith(swr.response);
    event.waitUntil(swr.update); // 让后台刷新在 SW 生命周期内完成
    return;
  }

  // 其他同源资源：cache-first + 后台填充
  event.respondWith(cacheFirst(request));
});

/* network-first：优先走网络，失败时回落缓存的 ./index.html */
function networkFirst(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    fetch(request)
      .then((response) => {
        // 成功的导航响应写入缓存，供下次离线使用
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() =>
        cache.match('./index.html').then((cached) => cached || Response.error())
      )
  );
}

/* stale-while-revalidate：先返回缓存（若命中），同时后台用网络结果刷新缓存 */
function staleWhileRevalidate(request) {
  const opened = caches.open(CACHE_NAME);
  const cached = opened.then((cache) => cache.match(request));

  const update = opened.then((cache) =>
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null)
  );

  return {
    // 缓存命中立即返回，否则等网络；网络也失败时给一个网络错误响应
    response: cached
      .then((hit) => hit || update)
      .then((result) => result || Response.error()),
    update,
  };
}

/* cache-first：先查缓存，未命中则取网络并填充缓存 */
function cacheFirst(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => Response.error());
    })
  );
}

/* message：支持 SKIP_WAITING 与 CLEAR_CACHE 两种控制消息 */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  // 页面要求新 SW 立即接管
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // 页面要求清空所有缓存，并回 postMessage 确认
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => {
          const reply = { type: 'CLEAR_CACHE', ok: true };
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage(reply);
          } else {
            // 没有单一来源时（极少见），广播给所有客户端
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => client.postMessage(reply));
            });
          }
        })
    );
  }
});
