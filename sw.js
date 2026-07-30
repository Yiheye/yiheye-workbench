/* Service Worker for 一禾叶的工作台
 * 作用：拦截同站请求，对首页/逻辑文件采用「网络优先」策略，
 * 这样每次我往 GitHub 推送新版本后，手机/电脑下次打开就能自动拿到最新代码，
 * 不用再删图标重装 PWA。
 * 注意：第一次启用 SW 仍需重装一次 PWA（让新 HTML 注册 SW），
 * 之后就全自动了。
 */
const CACHE = 'yiheye-workbench-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './sw.js'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(APP_SHELL);
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // 跨站请求（Supabase/外部 API）直接走网络，不缓存
  if (url.origin !== location.origin) return;

  // 首页、脚本、清单：网络优先，保证每次都能拿到最新版本
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('index.html') ||
      url.pathname.endsWith('sw.js') ||
      url.pathname.endsWith('manifest.json')) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 其余同站静态资源：缓存优先，失败再走网络
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req);
    })
  );
});
