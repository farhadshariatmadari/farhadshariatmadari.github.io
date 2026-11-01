/* sw.js — serves the site's failure pages, and nothing else.

   It never caches the site itself: an x-dc page loaded from cache would
   still need React from unpkg, so offline it would only be a blank page.
   It does three things:

   - A page that loads normally passes straight through (navigation preload,
     so the worker costs no startup time).
   - A page the server answers with 5xx is replaced by 500.html, with that
     status code.
   - A page that can't be fetched at all gets offline.html if the visitor's
     internet is down, or 500.html ("unreachable") if the internet works and
     only this host doesn't answer. It tells the two apart by probing two
     unrelated hosts.

   The status pages and what they need are precached at install. Bump
   VERSION after changing any of them, or visitors keep the old copies. */
var VERSION = 'fs-status-1';
var SHELL = ['/offline', '/500', '/status.css', '/status.js', '/assets/logo-mark.svg', '/assets/favicon.svg'];
var PROBES = ['https://www.gstatic.com/generate_204', 'https://cloudflare.com/cdn-cgi/trace'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(Promise.all([
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }),
    self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null
  ]).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(navigate(e));
    return;
  }
  // the status pages and what they load: network first, the precached
  // copy offline (status.js fetches /500 for its overlay)
  if (SHELL.indexOf(url.pathname) !== -1) {
    e.respondWith(fetch(req).catch(function () {
      return caches.match(url.pathname).then(function (hit) { return hit || Response.error(); });
    }));
  }
});

async function navigate(e) {
  try {
    var res = (await e.preloadResponse) || (await fetch(e.request));
    if (res.status >= 500) return page('/500', 'server', res.status);
    return res;
  } catch (err) {
    if (navigator.onLine !== false && await reachable()) return page('/500', 'unreachable');
    return page('/offline');
  }
}

function reachable() {
  var tries = PROBES.map(function (u) { return fetch(u, { mode: 'no-cors', cache: 'no-store' }); });
  var timeout = new Promise(function (_, reject) { setTimeout(reject, 4000); });
  return Promise.race([Promise.any(tries), timeout]).then(function () { return true; }, function () { return false; });
}

async function page(path, reason, code) {
  var hit = await caches.match(path);
  var headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  if (!hit) {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
      '<title>Farhad Shariatmadari</title><p style="font:16px/1.6 system-ui,sans-serif;padding:40px">' +
      (path === '/offline' ? 'You’re offline. Reload this page when you’re back.' : 'Something went wrong. Try again in a minute.') +
      '</p>', { status: 503, headers: headers });
  }
  var html = await hit.text();
  if (reason) {
    html = html.replace(/(<body\b[^>]*?) data-reason=""/, '$1 data-reason="' + reason + '"' + (code ? ' data-code="' + code + '"' : ''));
  }
  // a fresh Response: the cached one may carry a redirect flag, which a
  // navigation refuses
  return new Response(html, { status: code || 503, headers: headers });
}
