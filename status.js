/* status.js — the site's failure states. Loaded by all 14 pages (static
   <head>, before support.js) and by the three status pages. See CLAUDE.md,
   "Failure pages".

   1. Registers sw.js, which serves offline.html / 500.html when a page
      can't be fetched. HTTPS only, so a localhost preview never gets a
      worker that outlives it.
   2. On x-dc pages, watches for the runtime never arriving. React and Babel
      come from unpkg; if they fail, the page is blank. A failed load shows
      500.html's content as an overlay (reason "runtime") at once; no render
      after 20s shows it as "slow", and it removes itself if the page renders
      after all. It is an overlay, never a body swap: x-dc still has to find
      its <x-dc> to mount into.
   3. On a status page (body.st[data-status]), runs that page's behaviour.

   Runs once even if loaded twice. No dependencies. */
(function () {
  'use strict';
  if (window.__fsStatus) return;
  window.__fsStatus = true;

  var PAGES = ['Work', 'About', 'How-I-Work', 'Contact', 'Trio', 'Behinto', 'Agrino',
    'Medio', 'Vendora', 'Sharif-AICT', 'DigiKala-Mehr', 'Zeero', 'Safes'];
  // words people type for a page that has another name. '' is home.
  var ALIAS = {
    home: '', index: '', projects: 'Work', portfolio: 'Work', cases: 'Work',
    'case-studies': 'Work', process: 'How-I-Work', howiwork: 'How-I-Work',
    hire: 'Contact', email: 'Contact', cv: 'About', resume: 'About',
    mehr: 'DigiKala-Mehr', digikala: 'DigiKala-Mehr', sharif: 'Sharif-AICT', aict: 'Sharif-AICT'
  };
  var CODE_NAMES = { 500: 'server error', 502: 'bad gateway', 503: 'unavailable', 504: 'timed out' };
  var SLOW_MS = 20000;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- 1. service worker ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
  if (document.readyState === 'complete') registerSW();
  else addEventListener('load', registerSW);

  /* ---------- 2. render watchdog ---------- */
  // Only React, ReactDOM and Babel are fatal. Lenis also comes from unpkg,
  // and without it the page just scrolls natively.
  var FATAL = /unpkg\.com\/(?:react|react-dom|@babel\/standalone)@/;
  var overlay = null;
  var settled = false;

  function isDcPage() { return !!(document.querySelector('x-dc') || document.getElementById('dc-root')); }
  function rendered() {
    var r = document.getElementById('dc-root');
    return !!(r && r.childElementCount && r.offsetHeight > 0);
  }

  // capture phase: a script's error event doesn't bubble
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && FATAL.test(t.src || '')) {
      ready(function () { if (!rendered()) showOverlay('runtime'); });
    }
  }, true);

  function watch() {
    if (!isDcPage()) return;
    var t0 = Date.now();
    (function tick() {
      if (rendered()) { settled = true; hideOverlay(); return; }
      if (!overlay && Date.now() - t0 > SLOW_MS) showOverlay('slow');
      setTimeout(tick, 1000);
    })();
  }

  function showOverlay(reason) {
    if (settled) return;
    if (overlay) {
      // "runtime" is the more exact diagnosis; never downgrade it to "slow"
      if (reason === 'runtime') { overlay.setAttribute('data-reason', reason); broken(overlay); }
      return;
    }
    if (!document.querySelector('link[href="/status.css"]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/status.css';
      document.head.appendChild(l);
    }
    overlay = document.createElement('div');
    overlay.className = 'st st-overlay';
    overlay.setAttribute('data-status', '500');
    overlay.setAttribute('data-reason', reason);
    // inline until status.css lands, so the blank page is covered at once
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;overflow:auto;background:#f6f7f9';
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';

    fetch('/500', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw r; return r.text(); })
      .then(function (html) {
        if (!overlay) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        overlay.innerHTML = doc.body.innerHTML; // our own page, same origin
        broken(overlay);
      })
      .catch(function () {
        if (!overlay) return;
        overlay.innerHTML = '<p style="font:16px/1.6 system-ui,sans-serif;padding:40px;max-width:48ch;margin:0">' +
          'This page couldn’t finish loading. <a href="" style="color:#2f5cf0">Try again</a>, or email ' +
          '<a href="mailto:farhadshariatmadari@gmail.com" style="color:#2f5cf0">farhadshariatmadari@gmail.com</a>.</p>';
      });
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.style.overflow = '';
  }

  /* ---------- 3. status pages ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-retry]');
    if (!b) return;
    if (b.getAttribute('data-retry') === 'home') location.href = '/';
    else location.reload();
  });

  // a status page opened at its own address has nothing to retry
  function goHome(b) {
    b.setAttribute('data-retry', 'home');
    b.firstChild.nodeValue = 'Go to the home page ';
    var arrow = b.querySelector('.st-arrow');
    if (arrow) arrow.textContent = '→';
  }

  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }

  function lev(a, b) {
    var row = [], i, j, prev, tmp;
    for (j = 0; j <= b.length; j++) row[j] = j;
    for (i = 1; i <= a.length; i++) {
      prev = row[0]; row[0] = i;
      for (j = 1; j <= b.length; j++) {
        tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  function norm(s) { return s.toLowerCase().replace(/\.html?$/, '').replace(/[\s_]+/g, '-'); }

  // One segment at a time, last first: in /case-studies/zero the page is
  // "zero", and the folder only a hint.
  function suggest(segs) {
    var tries = segs.slice().reverse().map(norm);
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i], best = null, bestD = Infinity;
      if (Object.prototype.hasOwnProperty.call(ALIAS, t)) return ALIAS[t];
      PAGES.forEach(function (p) {
        var q = p.toLowerCase(), d = lev(t, q);
        if (t.length >= 4 && (q.indexOf(t) === 0 || t.indexOf(q) === 0)) d = Math.min(d, 1);
        if (d < bestD) { bestD = d; best = p; }
      });
      if (bestD <= Math.max(2, Math.floor(best.length / 4))) return best;
    }
    return null;
  }

  function notFound(root) {
    var raw = location.pathname, path;
    try { path = decodeURIComponent(raw); } catch (err) { path = raw; }
    var segs = path.split('/').filter(Boolean);

    // A real page in the wrong case, or with a trailing slash or .html:
    // both hosts are case-sensitive, so /work is a 404. Go straight there.
    // Safe from loops: it only fires when the target differs from here.
    if (segs.length === 1) {
      var want = norm(segs[0]);
      var hit = want === 'index' ? '' : PAGES.filter(function (p) { return p.toLowerCase() === want; })[0];
      if (hit !== undefined && '/' + hit !== raw) {
        location.replace('/' + hit + location.search + location.hash);
        return;
      }
    }

    var shown = path.length > 34 ? '…' + path.slice(-33) : path;
    each(root, '[data-path]', function (el) { el.textContent = shown; });
    each(root, '[data-frame-label]', function (el) { el.textContent = 'Page ' + (shown.length > 28 ? '…' + shown.slice(-27) : shown); });
    each(root, '[data-strip-path]', function (el) { el.textContent = 'Page · ' + shown; });

    var best = segs.length ? suggest(segs) : null;
    if (best !== null && '/' + best !== raw) {
      var a = root.querySelector('[data-suggest]');
      if (a) { a.href = '/' + best; a.textContent = '/' + best; }
      var row = root.querySelector('[data-suggest-row]');
      if (row) row.classList.add('is-on');
    }
  }

  function offline(root) {
    var out = root.querySelector('[data-countdown]');
    var btn = root.querySelector('[data-retry]');

    // Visited directly at /offline: there's no page to come back to.
    if (/^\/offline(\.html)?$/.test(location.pathname)) {
      if (btn) goHome(btn);
      if (out) out.textContent = 'This is what the site shows when a page can’t load without a connection.';
      return;
    }

    var waits = [5, 10, 20, 30], n = 0, left = 0, timer = 0, busy = false;
    function schedule() {
      busy = false;
      left = waits[Math.min(n++, waits.length - 1)];
      tick();
    }
    function tick() {
      if (out) out.textContent = 'Checking again in ' + left + 's';
      if (left-- <= 0) { check(); return; }
      timer = setTimeout(tick, 1000);
    }
    function check() {
      if (busy) return;
      busy = true;
      clearTimeout(timer);
      if (out) out.textContent = 'Checking…';
      // not a navigation, so sw.js lets it through to the network
      fetch(location.href, { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { if (r.status < 500) location.reload(); else schedule(); }, schedule);
    }
    addEventListener('online', check);
    schedule();
  }

  function broken(root) {
    var reason = root.getAttribute('data-reason') || 'server';
    var code = root.getAttribute('data-code') || '500';
    var label = {
      server: code + ' · ' + (CODE_NAMES[code] || 'server error'),
      unreachable: 'no response',
      runtime: 'scripts didn’t load',
      slow: 'still loading'
    }[reason] || code + ' · server error';
    each(root, '[data-code-text]', function (el) { el.textContent = label; });

    // Visited directly at /500: reloading it would only show it again.
    var direct = !root.classList.contains('st-overlay') && /^\/500(\.html)?$/.test(location.pathname);
    if (direct) {
      each(root, '[data-retry]', goHome);
    }
  }

  ready(function () {
    var b = document.body;
    if (b.classList.contains('st')) {
      var kind = b.getAttribute('data-status');
      if (kind === '404') notFound(b);
      else if (kind === 'offline') offline(b);
      else if (kind === '500') broken(b);
    }
    watch();
  });
})();
