/**
 * Prism grid — the live hero background.
 *
 * A grid of 64px cells that flash a colour under the pointer, plus a slow
 * ambient twinkle. It replaces the static 64px CSS grid the heroes used to
 * paint with background-image; same geometry, same #eceef2 lines, so pages
 * look unchanged until you move the mouse.
 *
 * Usage — three divs at the top of a `position: relative; overflow: hidden`
 * hero section:
 *
 *   <div data-prism-grid class="pg-host"></div>
 *   <div class="pg-scrim"></div>
 *   <div class="pg-over"> …hero content… </div>
 *
 * This file is deliberately standalone rather than page logic: the heroes live
 * on five pages whose x-dc Component classes already own a GSAP card stack, a
 * form with setState, and an image fallback. Keeping the grid out of them
 * means one implementation and nothing to collide with.
 *
 * Cells are injected imperatively into an element React renders empty, which
 * React leaves alone. The scrim and overlay stay in page markup so React owns
 * every node it needs to reconcile.
 */
(function () {
  if (window.__prismGrid) return;
  window.__prismGrid = true;

  var CELL = 64;
  var COLORS = ['#2f5cf0', '#22a06b', '#e0912f', '#7a5cf0', '#e0397f'];
  var LINE = '#eceef2';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css =
    '.pg-host{position:absolute;inset:0;z-index:0;display:grid;}' +
    '.pg-cell{border-right:1px solid ' + LINE + ';border-bottom:1px solid ' + LINE + ';transition:background .9s ease;}' +
    '.pg-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;' +
      'background:linear-gradient(90deg,rgba(246,247,249,.86) 0%,rgba(246,247,249,.5) 55%,rgba(246,247,249,0) 100%);}' +
    '.pg-over{position:relative;z-index:2;}';

  function injectCss() {
    if (document.getElementById('pg-css')) return;
    var s = document.createElement('style');
    s.id = 'pg-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function flash(cell, alpha) {
    if (!cell) return;
    var col = COLORS[(Math.random() * COLORS.length) | 0];
    // paint instantly, then let the transition carry it back out
    cell.style.transition = 'none';
    cell.style.background = rgba(col, alpha);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        cell.style.transition = 'background 1s ease';
        cell.style.background = 'transparent';
      });
    });
  }

  function init(host) {
    if (host.__pg) return;
    host.__pg = true;

    var cols = 0, rows = 0, lastIdx = -1, iv = null;

    function build() {
      var w = host.clientWidth, h = host.clientHeight;
      // React may still be laying the section out
      if (!w || !h) { requestAnimationFrame(build); return; }

      var c = Math.ceil(w / CELL) + 1;
      var r = Math.ceil(h / CELL) + 1;
      if (c === cols && r === rows) return;   // resize that doesn't change the grid leaves cells alone
      cols = c; rows = r;

      host.style.gridTemplateColumns = 'repeat(' + cols + ', ' + CELL + 'px)';
      host.style.gridAutoRows = CELL + 'px';

      var html = '';
      for (var i = 0; i < cols * rows; i++) html += '<div class="pg-cell"></div>';
      host.innerHTML = html;
      lastIdx = -1;
    }

    /**
     * Hovered cell comes from pointer geometry rather than a mouseover on the
     * cell itself. The cells sit behind the hero content, so a mouseover
     * listener would need pointer-events:none on everything above them — which
     * costs text selection and click targets. Maths costs nothing.
     */
    function onMove(e) {
      if (!cols) return;
      var rect = host.getBoundingClientRect();
      var x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      var idx = ((y / CELL) | 0) * cols + ((x / CELL) | 0);
      if (idx === lastIdx) return;            // one flash per cell entered, not per mousemove
      lastIdx = idx;
      flash(host.children[idx], 0.55);
    }

    function ambient() {
      var n = host.children.length;
      if (n) flash(host.children[(Math.random() * n) | 0], 0.26);
    }

    build();

    // the section, so the pointer is tracked across the whole hero
    var surface = host.parentElement || host;
    surface.addEventListener('pointermove', onMove, { passive: true });
    surface.addEventListener('pointerleave', function () { lastIdx = -1; }, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(build).observe(host);
    } else {
      window.addEventListener('resize', function () {
        clearTimeout(host.__pgT);
        host.__pgT = setTimeout(build, 200);
      });
    }

    if (!reduced) iv = setInterval(ambient, 900);
    window.addEventListener('pagehide', function () { clearInterval(iv); });
  }

  function scan() {
    var list = document.querySelectorAll('[data-prism-grid]');
    for (var i = 0; i < list.length; i++) init(list[i]);
  }

  function start() {
    injectCss();
    scan();
    // pages render through React from unpkg, so the hero can land well after
    // DOMContentLoaded — watch for it instead of racing it
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
