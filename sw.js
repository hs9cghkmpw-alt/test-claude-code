// オフラインで動かすためのキャッシュ戦略。
// 問題データ(data.js)が頻繁に更新されるアプリなので、
// 「まずネットワークから最新を取りに行き、オフライン時だけキャッシュを使う」方式にしている。
// ファイル構成を変えた(ファイルを増減させた)ときはCACHE_NAMEのバージョンを上げること。
var CACHE_NAME = "study-app-cache-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// ネットワーク優先(常に最新のdata.js/app.jsを取りに行く)、
// オフラインなどでネットワークが使えない時だけキャッシュにフォールバックする。
// これにより、後から問題を追加してGitHubにpushしても、
// 電波が入る場所で開けば自動的に最新の問題が反映される。
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});
