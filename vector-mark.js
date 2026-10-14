/**
 * Vector mark — the home-page hero panel: the F mark open in a design file.
 *
 * The logo is drawn live from its own construction — two round-capped 27-unit
 * strokes and a masked wedge, the same geometry as assets/logo-mark.svg — with
 * its anchor points, selection box and size pill on top, the way a design tool
 * shows a selected vector. Every point can be dragged: the strokes follow,
 * smart guides fire when a point lines up with another, the frame size and the
 * inspector update, and on release the mark springs back into shape. Dragging
 * the strokes moves the whole mark; dragging empty canvas draws a marquee.
 *
 * When nobody is using it, a multiplayer cursor labelled "Farhad" does. On
 * first view it draws the mark with the pen tool; after that it picks a point
 * up every few seconds and moves it. A visitor's pointer takes over the moment
 * it enters the canvas, and the cursor steps out of the way until they leave.
 *
 * Usage, inside a frame that sets the size and paints the canvas:
 *
 *   <div class="vm-frame">
 *     <img class="vm-still" src="assets/logo-mark.svg" alt="">
 *     <div data-vector-mark class="vm-host"></div>
 *   </div>
 *
 * Standalone rather than page logic, for the same reason as prism-grid.js:
 * index.html's Component owns the GSAP card stack, and a render loop that went
 * through setState would re-render over it. Everything is injected into
 * .vm-host, which React renders empty and so never reconciles. The host
 * inherits the frame's background and covers the still, which only shows if
 * this script never runs.
 */
(function () {
  if (window.__vectorMark) return;
  window.__vectorMark = true;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var BLUE = '#2f5cf0', GUIDE = '#e0397f';

  // logo-mark.svg's construction, in its own 61×84 user space
  var HALF = 13.5;                                  // half the 27-unit stroke
  var REST = { a: [13.5, 70.5], b: [13.5, 13.5], c: [47.5, 13.5] };
  var STEM = 57;                                    // foot → corner, at rest
  var T0 = (70.5 - 46) / STEM;                      // where the middle arm leaves the stem
  var ARM = [20.5, 0];                              // middle arm, root → tip
  var IDS = ['a', 'b', 'c', 'd', 'e'];
  var SEGS = [['a', 'b'], ['b', 'c'], ['d', 'e']];
  var NAME = { a: 'stem foot', b: 'corner', c: 'arm tip', d: 'bar root', e: 'bar tip' };

  // Springs, as [stiffness, damping]. Let go, a point overshoots and wobbles
  // home; held, it tracks the pointer closely but irons out the jitter.
  // Reduced motion gets a critically damped return: it still goes home, it
  // just doesn't bounce.
  var LOOSE = reduced ? [300, 35] : [230, 11];
  var TIGHT = [1500, 70];
  var INSP = 36;                                    // inspector strip, px

  // What the "Farhad" cursor does between visits, in logo units. `line` drags
  // a point until it lines up with another one, so a smart guide fires.
  var EDITS = [
    { id: 'c', d: [12, -9] },
    { id: 'e', line: 'c' },
    { id: 'a', d: [-10, 7] },
    { id: 'd', d: [0, -15] },
    { id: 'b', d: [-9, -8] },
    { id: 'g', d: [9, 5] }
  ];

  var css =
    '.vm-host{position:absolute;inset:0;background:inherit;-webkit-user-select:none;user-select:none;}' +
    // pan-y keeps the page scrollable through the canvas on touch screens; a
    // touch that starts on a point cancels the scroll itself (see touchstart)
    '.vm-board{position:absolute;left:0;top:0;right:0;bottom:' + INSP + 'px;touch-action:pan-y;-webkit-tap-highlight-color:transparent;}' +
    '.vm-board svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    '.vm-board text{font-family:"JetBrains Mono",monospace;}' +
    '.vm-board .vm-tag text{font-family:"IBM Plex Sans",sans-serif;font-weight:500;}' +
    '.vm-insp{position:absolute;left:0;right:0;bottom:0;height:' + INSP + 'px;display:flex;align-items:center;gap:16px;' +
      'padding:0 16px;border-top:1px solid #eef0f3;background:#fff;font:10.5px/1 "JetBrains Mono",monospace;' +
      'letter-spacing:.02em;color:#97a0ad;white-space:nowrap;overflow:hidden;}' +
    '.vm-insp .vm-n{color:#14171c;min-width:10ch;}' +
    '.vm-insp b{font-weight:400;color:#3a414d;}' +
    '.vm-insp .vm-wh{margin-left:auto;}';

  var SVG =
    '<svg xmlns="' + NS + '" aria-hidden="true"><defs>' +
      '<linearGradient id="vm-g1" x1="61" y1="0" x2="4" y2="84" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#4F68F3"/><stop offset=".42" stop-color="#4740DE"/><stop offset="1" stop-color="#BCA8F6"/></linearGradient>' +
      '<linearGradient id="vm-g2" x1="10" y1="33" x2="48" y2="60" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#C6B6F9"/><stop offset="1" stop-color="#9B85F2"/></linearGradient>' +
      '<linearGradient id="vm-g3" x1="14" y1="33" x2="40" y2="60" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#2B2472"/><stop offset="1" stop-color="#171337"/></linearGradient>' +
      // userSpaceOnUse for the reason logo-mark.svg gives, and a region far
      // larger than 61×84, because the points can be dragged well outside it
      '<mask id="vm-m" maskUnits="userSpaceOnUse" x="-400" y="-400" width="900" height="900">' +
        '<rect x="-400" y="-400" width="900" height="900" fill="#000"/>' +
        '<path class="vm-mm" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"/></mask>' +
    '</defs>' +
    '<g class="vm-mark" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="vm-main" stroke="url(#vm-g1)"/>' +
      '<path class="vm-bar" stroke="url(#vm-g2)"/>' +
      '<g mask="url(#vm-m)"><path class="vm-cross" stroke="url(#vm-g3)"/></g>' +
    '</g>' +
    '<g fill="none">' +
      '<path class="vm-sku" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="vm-sk" stroke="' + BLUE + '" stroke-width="1.25" stroke-linecap="round"/>' +
      '<path class="vm-rub" stroke="' + BLUE + '" stroke-width="1.25" stroke-dasharray="3 3"/>' +
      '<path class="vm-trail" stroke="' + BLUE + '" stroke-opacity=".5" stroke-dasharray="2 3"/>' +
      '<path class="vm-guide" stroke="' + GUIDE + '"/>' +
      '<rect class="vm-box" stroke="' + BLUE + '"/>' +
      '<path class="vm-hdl" fill="#fff" stroke="' + BLUE + '"/>' +
    '</g>' +
    '<circle class="vm-home" r="3.5" fill="#fff" fill-opacity=".8" stroke="' + BLUE + '" stroke-opacity=".6" stroke-dasharray="2 2"/>' +
    '<g class="vm-dim"><rect rx="3" height="17" fill="' + BLUE + '"/>' +
      '<text y="12" font-size="10" fill="#fff" text-anchor="middle"></text></g>' +
    '<circle class="vm-halo" r="11" fill="' + BLUE + '"/>' +
    '<g class="vm-pts" stroke="' + BLUE + '" stroke-width="1.25"></g>' +
    '<rect class="vm-marq" fill="' + BLUE + '" fill-opacity=".06" stroke="' + BLUE + '"/>' +
    '<text class="vm-hint" font-size="10" fill="#97a0ad">drag any point</text>' +
    '<g class="vm-ghost"><g class="vm-gc">' +
      '<path class="vm-arrow" d="M.5 .5V15.2L4.3 11.6 6.9 17.6 9.5 16.5 7 10.6H12.2Z" fill="' + BLUE + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<g class="vm-pen" fill="' + BLUE + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round">' +
        '<path d="M.5 .5 12 4.6 15.4 15.4 4.6 12Z"/><path d="M12.6 17.4 17.4 12.6 20.4 15.6 15.6 20.4Z"/>' +
        '<path d="M.5 .5 7 7" fill="none"/><circle cx="8.3" cy="8.3" r="1.5" fill="#fff" stroke="none"/></g>' +
    '</g><g class="vm-tag" transform="translate(13 18)"><rect rx="4" height="18" width="52" fill="' + BLUE + '"/>' +
      '<text x="7.5" y="12.6" font-size="10.5" fill="#fff">Farhad</text></g></g>' +
    '</svg>';

  function injectCss() {
    if (document.getElementById('vm-css')) return;
    var s = document.createElement('style');
    s.id = 'vm-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function inOut(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function outCubic(p) { return 1 - Math.pow(1 - p, 3); }
  // overshoots ~13% around a third of the way in, then settles: a stroke
  // inflating like something with mass rather than a slider being dragged
  function jelly(p) { return p >= 1 ? 1 : 1 - Math.exp(-6.5 * p) * Math.cos(10 * p); }
  function approach(v, t, rate, dt) {
    var n = t + (v - t) * Math.exp(-rate * dt);
    return Math.abs(n - t) < .002 ? t : n;
  }
  function f1(v) { return (Math.round(v * 10) / 10).toString(); }
  function xy(p) { return f1(p[0]) + ' ' + f1(p[1]); }
  function n1(v) { var r = Math.round(v * 10) / 10; return r % 1 ? r.toFixed(1) : String(r); }
  function seg(p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
    var t = L ? clamp(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L, 0, 1) : 0;
    return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
  }
  // only write attributes that changed — most frames move one or two things
  function at(el, name, v) {
    var c = el.__vc || (el.__vc = {});
    if (c[name] !== v) { c[name] = v; el.setAttribute(name, v); }
  }
  function txt(el, html) { if (el.__vh !== html) { el.__vh = html; el.innerHTML = html; } }

  function init(host) {
    if (host.__vm) return;
    host.__vm = true;

    host.innerHTML = '<div class="vm-board">' + SVG + '</div>' +
      '<div class="vm-insp"><span class="vm-n"></span><span class="vm-xy"></span><span class="vm-wh"></span></div>';
    var board = host.firstChild, svg = board.firstChild, insp = host.lastChild;
    function q(c) { return svg.querySelector('.' + c); }
    var E = {
      mark: q('vm-mark'), main: q('vm-main'), mm: q('vm-mm'), bar: q('vm-bar'), cross: q('vm-cross'),
      sku: q('vm-sku'), sk: q('vm-sk'), rub: q('vm-rub'), trail: q('vm-trail'), home: q('vm-home'),
      guide: q('vm-guide'), box: q('vm-box'), hdl: q('vm-hdl'), dim: q('vm-dim'), halo: q('vm-halo'),
      marq: q('vm-marq'), hint: q('vm-hint'), ghost: q('vm-ghost'), gc: q('vm-gc'),
      arrow: q('vm-arrow'), pen: q('vm-pen'), tag: q('vm-tag')
    };
    var dimR = E.dim.firstChild, dimT = E.dim.lastChild;
    var IN = { n: insp.children[0], xy: insp.children[1], wh: insp.children[2] };
    var PT = {};
    IDS.forEach(function (id) {
      PT[id] = document.createElementNS(NS, 'circle');
      q('vm-pts').appendChild(PT[id]);
    });

    // ------------------------------------------------------------- state ---
    function spring() { return { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, k: LOOSE[0], c: LOOSE[1] }; }
    // a, b, c: displacement from rest. d: distance slid along the stem. e:
    // displacement from the end of the arm, which rides on d. g: the whole mark.
    var sp = { a: spring(), b: spring(), c: spring(), d: spring(), e: spring(), g: spring() };
    var pop = {}, popV = {}, popT = {}, hov = {}, placed = {}, picked = {};
    IDS.forEach(function (id) { pop[id] = popV[id] = popT[id] = hov[id] = 0; });
    var kMain = 0, kBar = 0, sel = 0, count = 0, hint = 0;
    var ghost = { x: 0, y: 0, vis: 0, visT: 0, press: 0, pressT: 0 };
    var tool = 'pen', rubber = null, haloId = null;
    var drag = null, hover = null, guides = [], marq = null;
    var started = false, introRunning = false, userIn = false, touched = false, visible = true;
    var steps = [], anims = [], raf = 0, timer = 0, resumeT = 0, last = 0, ei = 0;
    var W = 0, H = 0, S = 1, OX = 0, OY = 0;

    // ---------------------------------------------------------- geometry ---
    function geom() {
      var g = sp.g;
      var A = [REST.a[0] + sp.a.x + g.x, REST.a[1] + sp.a.y + g.y];
      var B = [REST.b[0] + sp.b.x + g.x, REST.b[1] + sp.b.y + g.y];
      var C = [REST.c[0] + sp.c.x + g.x, REST.c[1] + sp.c.y + g.y];
      // the middle arm is pinned to the stem, so tilting the stem carries it
      var t = T0 + sp.d.x / STEM;
      var D = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      return { a: A, b: B, c: C, d: D, e: [D[0] + ARM[0] + sp.e.x, D[1] + ARM[1] + sp.e.y] };
    }
    // where a point would sit if it were let go right now
    function home(id, G) {
      if (id === 'e') return [G.d[0] + ARM[0], G.d[1] + ARM[1]];
      if (id === 'd') return [G.a[0] + (G.b[0] - G.a[0]) * T0, G.a[1] + (G.b[1] - G.a[1]) * T0];
      return [REST[id][0] + sp.g.x, REST[id][1] + sp.g.y];
    }
    // the stroked outline's box: round caps and joins make it exact
    function bounds(G) {
      var hm = HALF * kMain, hb = HALF * kBar;
      return [
        Math.min(Math.min(G.a[0], G.b[0], G.c[0]) - hm, Math.min(G.d[0], G.e[0]) - hb),
        Math.min(Math.min(G.a[1], G.b[1], G.c[1]) - hm, Math.min(G.d[1], G.e[1]) - hb),
        Math.max(Math.max(G.a[0], G.b[0], G.c[0]) + hm, Math.max(G.d[0], G.e[0]) + hb),
        Math.max(Math.max(G.a[1], G.b[1], G.c[1]) + hm, Math.max(G.d[1], G.e[1]) + hb)
      ];
    }
    function px(u) { return [OX + u[0] * S, OY + u[1] * S]; }
    function un(p) { return [(p[0] - OX) / S, (p[1] - OY) / S]; }

    function layout() {
      var w = board.clientWidth, h = board.clientHeight;
      if (!w || !h) return false;
      if (w === W && h === H) return true;
      W = w; H = h;
      S = Math.min(h * .54 / 84, w * .52 / 61);
      OX = w / 2 - 30.5 * S;
      OY = h * .47 - 42 * S;          // a touch high: the size pill hangs below
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      E.mark.setAttribute('transform', 'translate(' + OX.toFixed(2) + ' ' + OY.toFixed(2) + ') scale(' + S.toFixed(4) + ')');
      at(E.hint, 'x', 14);
      at(E.hint, 'y', h - 14);
      return true;
    }

    // a spot on the empty canvas right of the stem, clear of the bar
    function park() {
      var hi = un([W - 76, H - 30]);
      return [Math.min(68 + Math.random() * 8, hi[0]), Math.min(56 + Math.random() * 12, hi[1])];
    }

    // -------------------------------------------------------------- drag ---
    function hitTest(p, touch) {
      var G = geom(), best = null, bd = touch ? 24 : 14;
      IDS.forEach(function (id) {
        if (!placed[id]) return;
        var c = px(G[id]), d = Math.hypot(p[0] - c[0], p[1] - c[1]);
        if (d < bd) { bd = d; best = id; }
      });
      if (best || kMain < .5) return best;
      var u = un(p);
      if (seg(u, G.a, G.b) < HALF || seg(u, G.b, G.c) < HALF || seg(u, G.d, G.e) < HALF) return 'g';
      return null;
    }

    function startDrag(id, by, u) {
      var G = geom();
      drag = {
        id: id, by: by, u0: u, g0: [sp.g.x, sp.g.y],
        // grab offset, so a point doesn't jump to the centre of the pointer
        off: id === 'g' || id === 'd' ? [0, 0] : [G[id][0] - u[0], G[id][1] - u[1]]
      };
      sp[id].k = TIGHT[0];
      sp[id].c = TIGHT[1];
      ['a', 'b', 'c', 'e'].forEach(function (k) { if (k !== id) { sp[k].tx = 0; sp[k].ty = 0; } });
      dragTo(u[0], u[1]);
      wake();
    }

    function dragTo(ux, uy) {
      var id = drag.id, s = sp[id], G = geom();
      guides = [];

      if (id === 'g') {
        // the whole mark: keep its box on the canvas
        var b = bounds(G), lo = un([10, 10]), hi = un([W - 10, H - 10]);
        var dx = drag.g0[0] + ux - drag.u0[0] - sp.g.x, dy = drag.g0[1] + uy - drag.u0[1] - sp.g.y;
        s.tx = sp.g.x + clamp(dx, lo[0] - b[0], hi[0] - b[2]);
        s.ty = sp.g.y + clamp(dy, lo[1] - b[1], hi[1] - b[3]);
        return;
      }

      if (id === 'd') {
        // the middle arm slides along the stem, never off it
        var vx = G.b[0] - G.a[0], vy = G.b[1] - G.a[1], L2 = vx * vx + vy * vy || 1;
        var t = clamp(((ux - G.a[0]) * vx + (uy - G.a[1]) * vy) / L2, .14, .86);
        if (Math.abs(t - T0) * Math.sqrt(L2) < 6 / S) t = T0;     // and clicks back into place
        s.tx = (t - T0) * STEM;
        return;
      }

      var tol = 6 / S, lo2 = un([8, 8]), hi2 = un([W - 8, H - 8]);
      var P = [clamp(ux + drag.off[0], lo2[0], hi2[0]), clamp(uy + drag.off[1], lo2[1], hi2[1])];
      // a and b carry d and e with them, so lining up with those would chase itself
      var cands = IDS.filter(function (k) {
        return k !== id && !((id === 'a' || id === 'b') && (k === 'd' || k === 'e'));
      });
      var hm = home(id, G);
      if (Math.hypot(P[0] - hm[0], P[1] - hm[1]) < tol * 1.5) P = hm;
      else {
        var bx = tol, by = tol, qx = null, qy = null;
        cands.forEach(function (k) {
          var Q = G[k], ex = Math.abs(P[0] - Q[0]), ey = Math.abs(P[1] - Q[1]);
          if (ex < bx) { bx = ex; qx = Q; }
          if (ey < by) { by = ey; qy = Q; }
        });
        if (qx) P[0] = qx[0];
        if (qy) P[1] = qy[1];
      }
      // smart guides for whatever it now lines up with, home included
      var gx = null, gy = null;
      cands.forEach(function (k) {
        var Q = G[k];
        if (Math.abs(P[0] - Q[0]) < .01 && (!gx || Math.abs(Q[1] - P[1]) < Math.abs(gx[1] - P[1]))) gx = Q;
        if (Math.abs(P[1] - Q[1]) < .01 && (!gy || Math.abs(Q[0] - P[0]) < Math.abs(gy[0] - P[0]))) gy = Q;
      });
      if (gx) guides.push(['x', gx, P]);
      if (gy) guides.push(['y', gy, P]);

      if (id === 'e') { s.tx = P[0] - G.d[0] - ARM[0]; s.ty = P[1] - G.d[1] - ARM[1]; }
      else { s.tx = P[0] - REST[id][0] - sp.g.x; s.ty = P[1] - REST[id][1] - sp.g.y; }
    }

    function endDrag() {
      if (!drag) return;
      var s = sp[drag.id];
      s.k = LOOSE[0];
      s.c = LOOSE[1];
      s.tx = 0;
      s.ty = 0;                      // home, carrying whatever speed it was let go at
      guides = [];
      drag = null;
      wake();
    }

    // a resting mouse pulls the nearest point a little towards it
    function hoverAt(p) {
      var h = hitTest(p, false);
      hover = h;
      board.style.cursor = h ? 'grab' : '';
      if (!reduced) {
        var u = un(p), G = geom();
        ['a', 'b', 'c', 'e'].forEach(function (k) {
          var s = sp[k];
          if (k !== h) { s.tx = 0; s.ty = 0; return; }
          var hm = home(k, G), mx = (u[0] - hm[0]) * .14, my = (u[1] - hm[1]) * .14, m = Math.hypot(mx, my);
          if (m > 3) { mx *= 3 / m; my *= 3 / m; }
          s.tx = mx;
          s.ty = my;
        });
      }
      wake();
    }

    function pickMarq() {
      var x0 = Math.min(marq.x0, marq.x1), x1 = Math.max(marq.x0, marq.x1);
      var y0 = Math.min(marq.y0, marq.y1), y1 = Math.max(marq.y0, marq.y1), G = geom();
      picked = {};
      IDS.forEach(function (id) {
        var c = px(G[id]);
        if (c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1) picked[id] = true;
      });
    }

    // ------------------------------------------------------------ script ---
    // The cursor's choreography: a queue of steps on absolute time, so a long
    // wait can sleep on a timer instead of spinning frames.
    function call(fn) { return { dur: 0, begin: fn }; }
    function wait(ms) { return { dur: ms, idle: true }; }
    function move(to, ms, dragging) {
      var f, t, bend;
      return {
        dur: ms,
        begin: function () {
          f = [ghost.x, ghost.y];
          t = to();
          // a slight arc, alternating sides — a hand, not a tween. Dead
          // straight while dragging, where the precision is the point.
          bend = dragging ? 0 : (Math.random() < .5 ? -.16 : .16);
        },
        update: function (p) {
          var e = inOut(p), i = 1 - e;
          var mx = (f[0] + t[0]) / 2 - (t[1] - f[1]) * bend, my = (f[1] + t[1]) / 2 + (t[0] - f[0]) * bend;
          ghost.x = i * i * f[0] + 2 * i * e * mx + e * e * t[0];
          ghost.y = i * i * f[1] + 2 * i * e * my + e * e * t[1];
          if (drag && drag.by === 'ghost') dragTo(ghost.x, ghost.y);
        }
      };
    }
    function anim(fn, ms, delay) { anims.push({ t0: performance.now() + (delay || 0), dur: ms, fn: fn }); }
    function to(id) { return function () { return geom()[id].slice(); }; }
    function place(id) { return call(function () { placed[id] = true; popT[id] = 1; }); }
    function rub(id) { return call(function () { rubber = id; }); }

    function tickSteps(now) {
      for (var guard = 0; steps.length && guard < 64; guard++) {
        var s = steps[0];
        if (s.t0 == null) {
          s.t0 = now;
          if (s.begin) s.begin();
          if (steps[0] !== s) continue;           // begin() replaced the queue
        }
        var p = s.dur ? Math.min(1, (now - s.t0) / s.dur) : 1;
        if (s.update) s.update(p);
        if (p < 1) break;
        steps.shift();
      }
    }

    // First view: the pen tool places each point, rubber-banding to the next,
    // then the strokes inflate around the skeleton and the selection lands.
    function intro() {
      if (userIn) { finishIntro(); wake(); return; }
      introRunning = true;
      steps = [
        call(function () { tool = 'pen'; ghost.x = REST.a[0] - 18; ghost.y = REST.a[1] + 13; ghost.visT = 1; }),
        wait(240),
        move(to('a'), 340), place('a'), wait(90), rub('a'),
        move(to('b'), 460), place('b'), rub('b'), wait(60),
        move(to('c'), 360), place('c'), rub(null), wait(170),
        move(to('d'), 380), place('d'), wait(60), rub('d'),
        move(to('e'), 300), place('e'), rub(null), wait(120),
        call(function () {
          anim(function (p) { kMain = jelly(p); }, 820);
          anim(function (p) { kBar = jelly(p); }, 720, 130);
          anim(function (p) { sel = inOut(p); }, 360, 560);
          anim(function (p) { count = outCubic(p); }, 620, 560);
        }),
        wait(420),
        call(function () { tool = 'arrow'; }),
        move(park, 900),
        call(function () { introRunning = false; }),
        wait(2600),
        call(next)
      ];
      wake();
    }

    function finishIntro() {
      introRunning = false;
      anims = [];
      steps = [];
      rubber = null;
      tool = 'arrow';
      IDS.forEach(function (id) { placed[id] = true; popT[id] = 1; });
      kMain = kBar = sel = count = 1;
    }

    // one visit: walk to a point, pick it up, move it, hold, let go, walk off
    function next() {
      if (userIn || reduced) return;
      var ed = EDITS[ei++ % EDITS.length];
      steps.push(
        move(function () {
          var G = geom();
          // the whole mark is grabbed by the stem, between the corner and the bar
          return ed.id === 'g' ? [G.b[0], (G.b[1] + G.d[1]) / 2] : G[ed.id].slice();
        }, 760),
        call(function () { ghost.pressT = 1; startDrag(ed.id, 'ghost', [ghost.x, ghost.y]); }),
        wait(150),
        move(function () {
          var G = geom(), d = ed.line ? [G[ed.line][0] - G[ed.id][0], 0] : ed.d;
          return [ghost.x + d[0], ghost.y + d[1]];
        }, 760, true),
        wait(460),
        call(function () { endDrag(); ghost.pressT = 0; }),
        wait(300),
        move(park, 1000),
        wait(2600 + Math.random() * 1800),
        call(next)
      );
    }

    // a visitor's pointer has come in: the cursor gets out of the way
    function takeOver() {
      clearTimeout(resumeT);
      if (userIn) return;
      userIn = true;
      if (introRunning) finishIntro();
      if (drag && drag.by === 'ghost') endDrag();
      steps = [];
      ghost.visT = 0;
      ghost.pressT = 0;
      wake();
    }
    function userLeft() {
      if (!userIn) return;
      userIn = false;
      clearTimeout(resumeT);
      if (!reduced) resumeT = setTimeout(resume, 3200);
    }
    // start (or restart) the visits from a clean slate — after the visitor
    // leaves, or after the canvas has been off screen and the queue's clock
    // has run on without it
    function resume() {
      if (userIn || reduced || !started) return;
      if (drag) { if (drag.by === 'user') return; endDrag(); }
      if (introRunning) finishIntro();
      steps = [];
      ghost.pressT = 0;
      tool = 'arrow';
      if (ghost.vis < .05) { var p = park(); ghost.x = p[0]; ghost.y = p[1]; }
      ghost.visT = 1;
      steps.push(wait(900), call(next));
      wake();
    }

    function begin(delay) {
      if (started) return;
      started = true;
      if (reduced) {
        finishIntro();
        IDS.forEach(function (id) { pop[id] = 1; });
        wake();
        return;
      }
      setTimeout(intro, delay);
    }

    // ------------------------------------------------------------- frame ---
    function wake() {
      clearTimeout(timer);
      if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }

    function stepSpring(s, h) {
      s.vx += (-s.k * (s.x - s.tx) - s.c * s.vx) * h;
      s.vy += (-s.k * (s.y - s.ty) - s.c * s.vy) * h;
      s.x += s.vx * h;
      s.y += s.vy * h;
    }

    function frame(now) {
      raf = 0;
      if (!layout()) { raf = requestAnimationFrame(frame); return; }
      var dt = Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now;

      tickSteps(now);
      for (var i = 0; i < anims.length; i++) {
        var a = anims[i], p = (now - a.t0) / a.dur;
        if (p < 0) continue;
        a.fn(Math.min(1, p));
        if (p >= 1) anims.splice(i--, 1);
      }

      // fixed substeps keep the stiff springs stable at any frame rate
      var n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, moving = false, k, j;
      for (k in sp) {
        var s = sp[k];
        for (j = 0; j < n; j++) stepSpring(s, h);
        if (Math.abs(s.x - s.tx) < .003 && Math.abs(s.y - s.ty) < .003 && Math.abs(s.vx) < .01 && Math.abs(s.vy) < .01) {
          s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0;
        } else moving = true;
      }
      IDS.forEach(function (id) {
        for (var m = 0; m < n; m++) {
          popV[id] += (-520 * (pop[id] - popT[id]) - 20 * popV[id]) * h;
          pop[id] += popV[id] * h;
        }
        if (Math.abs(pop[id] - popT[id]) < .001 && Math.abs(popV[id]) < .01) { pop[id] = popT[id]; popV[id] = 0; }
        else moving = true;
        var ht = (drag && drag.id === id) || hover === id ? 1 : 0;
        hov[id] = approach(hov[id], ht, 16, dt);
        if (hov[id] !== ht) moving = true;
      });

      var ht2 = !touched && started && !introRunning && count >= 1 ? 1 : 0;
      ghost.vis = approach(ghost.vis, ghost.visT, 9, dt);
      ghost.press = approach(ghost.press, ghost.pressT, 22, dt);
      hint = approach(hint, ht2, 4, dt);
      if (ghost.vis !== ghost.visT || ghost.press !== ghost.pressT || hint !== ht2) moving = true;
      if (marq && !marq.live) {
        marq.a = approach(marq.a, 0, 7, dt);
        if (!marq.a) { marq = null; picked = {}; }
      }

      render();

      if (moving || drag || marq || anims.length || (steps.length && !steps[0].idle)) {
        raf = requestAnimationFrame(frame);
      } else if (steps.length) {
        // nothing on screen is moving: sleep until the current wait is up
        var st = steps[0];
        timer = setTimeout(wake, Math.max(0, st.t0 + st.dur - performance.now()));
      }
    }

    // ------------------------------------------------------------ render ---
    function render() {
      var G = geom();
      var d1 = 'M' + xy(G.a) + 'L' + xy(G.b) + 'L' + xy(G.c), d2 = 'M' + xy(G.d) + 'L' + xy(G.e);
      var wm = (27 * kMain).toFixed(2), wb = (27 * kBar).toFixed(2);
      at(E.main, 'd', d1); at(E.mm, 'd', d1); at(E.bar, 'd', d2); at(E.cross, 'd', d2);
      at(E.main, 'stroke-width', wm); at(E.mm, 'stroke-width', wm);
      at(E.bar, 'stroke-width', wb); at(E.cross, 'stroke-width', wb);

      var P = {};
      IDS.forEach(function (id) { P[id] = px(G[id]); });

      // the path's skeleton, as far as it has been drawn
      var sk = '';
      SEGS.forEach(function (sg) {
        if (placed[sg[0]] && placed[sg[1]]) sk += 'M' + xy(P[sg[0]]) + 'L' + xy(P[sg[1]]);
      });
      at(E.sk, 'd', sk);
      at(E.sku, 'd', sk);
      var gp = px([ghost.x, ghost.y]);
      at(E.rub, 'd', rubber ? 'M' + xy(P[rubber]) + 'L' + xy(gp) : '');

      // where the dragged point came from, and the smart guides it has found
      var tr = '', hm = null, gd = '';
      if (drag && drag.id !== 'g') {
        hm = px(home(drag.id, G));
        if (Math.hypot(hm[0] - P[drag.id][0], hm[1] - P[drag.id][1]) > 4) tr = 'M' + xy(hm) + 'L' + xy(P[drag.id]);
        else hm = null;
        var cur = P[drag.id];
        guides.forEach(function (g) {
          var Q = px(g[1]);
          if (g[0] === 'x') {
            var x = Math.round(Q[0]) + .5;
            gd += 'M' + x + ' ' + f1(Math.min(Q[1], cur[1]) - 10) + 'V' + f1(Math.max(Q[1], cur[1]) + 10);
          } else {
            var y = Math.round(Q[1]) + .5;
            gd += 'M' + f1(Math.min(Q[0], cur[0]) - 10) + ' ' + y + 'H' + f1(Math.max(Q[0], cur[0]) + 10);
          }
        });
      }
      at(E.trail, 'd', tr);
      at(E.guide, 'd', gd);
      at(E.home, 'opacity', hm ? '1' : '0');
      if (hm) { at(E.home, 'cx', f1(hm[0])); at(E.home, 'cy', f1(hm[1])); }

      // selection box, corner handles and the size pill
      var bb = bounds(G);
      var x0 = Math.round(OX + bb[0] * S) + .5, y0 = Math.round(OY + bb[1] * S) + .5;
      var x1 = Math.round(OX + bb[2] * S) + .5, y1 = Math.round(OY + bb[3] * S) + .5;
      var so = sel.toFixed(3);
      at(E.box, 'x', x0); at(E.box, 'y', y0); at(E.box, 'width', x1 - x0); at(E.box, 'height', y1 - y0);
      at(E.box, 'opacity', so);
      var hd = '';
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(function (c) {
        hd += 'M' + (c[0] - 3.5) + ' ' + (c[1] - 3.5) + 'h7v7h-7Z';
      });
      at(E.hdl, 'd', hd);
      at(E.hdl, 'opacity', so);
      var wv = Math.round((bb[2] - bb[0]) * count), hv = Math.round((bb[3] - bb[1]) * count);
      var label = wv + ' × ' + hv, lw = label.length * 6.02 + 12;
      if (dimT.textContent !== label) dimT.textContent = label;
      at(dimR, 'x', f1(-lw / 2)); at(dimR, 'width', f1(lw));
      at(E.dim, 'transform', 'translate(' + f1((x0 + x1) / 2) + ' ' + f1(y1 + 8) + ')');
      at(E.dim, 'opacity', so);

      IDS.forEach(function (id) {
        var c = PT[id], on = (drag && drag.id === id) || picked[id];
        at(c, 'cx', f1(P[id][0]));
        at(c, 'cy', f1(P[id][1]));
        at(c, 'r', Math.max(0, (2.9 + 1.5 * hov[id]) * pop[id]).toFixed(2));
        at(c, 'fill', on ? BLUE : '#fff');
      });
      var focus = drag ? drag.id : hover;
      if (focus && focus !== 'g') haloId = focus;
      if (haloId) {
        at(E.halo, 'cx', f1(P[haloId][0]));
        at(E.halo, 'cy', f1(P[haloId][1]));
        at(E.halo, 'fill-opacity', (.13 * hov[haloId]).toFixed(3));
      } else at(E.halo, 'fill-opacity', '0');

      if (marq) {
        at(E.marq, 'x', Math.round(Math.min(marq.x0, marq.x1)) + .5);
        at(E.marq, 'y', Math.round(Math.min(marq.y0, marq.y1)) + .5);
        at(E.marq, 'width', Math.round(Math.abs(marq.x1 - marq.x0)));
        at(E.marq, 'height', Math.round(Math.abs(marq.y1 - marq.y0)));
        at(E.marq, 'opacity', marq.a.toFixed(3));
      } else at(E.marq, 'opacity', '0');
      at(E.hint, 'opacity', (.9 * hint).toFixed(3));

      at(E.ghost, 'transform', 'translate(' + f1(gp[0]) + ' ' + f1(gp[1]) + ')');
      at(E.ghost, 'opacity', ghost.vis.toFixed(3));
      at(E.ghost, 'visibility', ghost.vis ? 'visible' : 'hidden');
      at(E.gc, 'transform', 'scale(' + (1 - .14 * ghost.press).toFixed(3) + ')');
      at(E.arrow, 'opacity', tool === 'arrow' ? '1' : '0');
      at(E.pen, 'opacity', tool === 'pen' ? '1' : '0');

      // the inspector: the point in hand, or the whole mark's frame
      var name = 'F mark', X = bb[0], Y = bb[1];
      if (focus && focus !== 'g') { name = NAME[focus]; X = G[focus][0]; Y = G[focus][1]; }
      txt(IN.n, name);
      txt(IN.xy, 'X <b>' + n1(X) + '</b>&nbsp;&nbsp;Y <b>' + n1(Y) + '</b>');
      txt(IN.wh, 'W <b>' + wv + '</b>&nbsp;&nbsp;H <b>' + hv + '</b>');
    }

    // ------------------------------------------------------------ events ---
    function local(e) {
      var r = board.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    board.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') takeOver();
    });
    board.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var p = local(e), h = hitTest(p, e.pointerType !== 'mouse');
      if (!h && e.pointerType !== 'mouse') return;      // a touch on bare canvas is a scroll
      e.preventDefault();
      try { board.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
      takeOver();
      if (h) {
        touched = true;
        startDrag(h, 'user', un(p));
        board.style.cursor = 'grabbing';
      } else {
        marq = { x0: p[0], y0: p[1], x1: p[0], y1: p[1], a: 1, live: true };
        picked = {};
        wake();
      }
    });
    board.addEventListener('pointermove', function (e) {
      var p = local(e);
      if (drag && drag.by === 'user') { var u = un(p); dragTo(u[0], u[1]); wake(); }
      else if (marq && marq.live) { marq.x1 = p[0]; marq.y1 = p[1]; pickMarq(); wake(); }
      else if (e.pointerType === 'mouse') hoverAt(p);
    });
    function up(e) {
      if (drag && drag.by === 'user') {
        // no hover until the pointer next moves: the point is under it right
        // now, but it is about to spring away, and a hover pull left behind
        // would hold it short of home
        endDrag();
        hover = null;
        board.style.cursor = '';
      }
      if (marq && marq.live) { marq.live = false; wake(); }
      if (e.pointerType !== 'mouse') userLeft();
    }
    board.addEventListener('pointerup', up);
    board.addEventListener('pointercancel', up);
    board.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse' || (drag && drag.by === 'user')) return;
      hover = null;
      board.style.cursor = '';
      ['a', 'b', 'c', 'e'].forEach(function (k) { sp[k].tx = 0; sp[k].ty = 0; });
      wake();
      userLeft();
    });
    // touch-action is pan-y so the page still scrolls through the canvas; a
    // touch that lands on a point has to cancel that scroll before it starts
    board.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      var r = board.getBoundingClientRect();
      if (hitTest([t.clientX - r.left, t.clientY - r.top], true)) e.preventDefault();
    }, { passive: false });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        var tt = E.tag.lastChild;
        try { E.tag.firstChild.setAttribute('width', (tt.getComputedTextLength() + 15).toFixed(1)); } catch (_) { /* keeps 52 */ }
      });
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { W = 0; wake(); }).observe(board);

    // play the first draw when the canvas is actually seen — on a phone it
    // sits below the fold — and stop drawing while it is scrolled away
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (en) {
        var was = visible;
        visible = en[0].isIntersecting;
        if (!visible) return;
        if (!started) begin(was ? 450 : 150);
        else if (!was && !introRunning) resume();
        wake();
      }).observe(host);
    } else begin(450);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && started) { if (!introRunning) resume(); wake(); }
    });

    layout();
    render();
  }

  function scan() {
    var list = document.querySelectorAll('[data-vector-mark]');
    for (var i = 0; i < list.length; i++) {
      // Never the copy still inside <x-dc>: the runtime reads its template
      // from that element's innerHTML, so anything injected there becomes part
      // of the React tree, and the next render tries to remove nodes this
      // script has already replaced. Wait for the rendered one under #dc-root.
      if (list[i].closest('x-dc')) continue;
      init(list[i]);
    }
  }

  function start() {
    injectCss();
    scan();
    // the hero renders through React from unpkg, well after DOMContentLoaded
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
