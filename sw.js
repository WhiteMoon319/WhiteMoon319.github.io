/**
 * YHG Service Worker v1
 * 缓存策略：运行时缓存静态资源 + 网络优先 API
 */
const CACHE_NAME = 'yhg-v1';

// 需要预缓存的资源
const PRECACHE_URLS = [
  '/',
  '/resource/css/style.min.css',
  '/resource/js/main.js',
  '/resource/js/auth.js',
  '/resource/img/logo.webp',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // API 请求：仅缓存公开 GET 接口，其余直接走网络不缓存
  if (path.startsWith('/api/')) {
    // 公开只读 API 白名单，可缓存以支持离线浏览
    const CACHEABLE_API = ['/api/home', '/api/matches', '/api/players', '/api/news'];
    const isCacheable = CACHEABLE_API.some(function(p) { return path === p || path.startsWith(p + '/') || path.startsWith(p + '?'); }) && request.method === 'GET';
    if (isCacheable) {
      event.respondWith(networkFirst(request));
    } else {
      // 认证/私密接口不缓存，避免泄露用户数据
      event.respondWith(fetch(request));
    }
    return;
  }

  // 静态资源：缓存优先
  if (/\.(css|js|webp|png|jpg|svg|woff2?)$/.test(path)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML 页面：网络优先（确保内容最新）
  if (path.endsWith('/') || path.endsWith('.html') || !path.includes('.')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他：网络优先
  event.respondWith(networkFirst(request));
});

// 缓存优先策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// 网络优先策略
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}
