/**
 * Pixel card — a field of twinkling pixels that blooms out of the pointer.
 *
 * A vanilla port of React Bits' <PixelCard> (reactbits.dev/components/
 * pixel-card), dark theme, recoloured to the site's blue. On hover the pixels
 * ripple outward from the pointer and light a soft glow, and the ones near
 * the cursor swell after it on a spring. A press sends a pulse ring across
 * the field. On leave they drain back toward the edges. The first time the
 * card scrolls into view the reveal plays once on its own. Keyboard focus
 * inside the card counts as hover.
 *
 * Usage — on an element React renders empty, inside a `position: relative;
 * overflow: hidden` card. The card itself (the host's parent) is what you
 * hover:
 *
 *   <div style="position: relative; overflow: hidden; …">
 *     <div data-pixel-card style="position: absolute; inset: 0; …"></div>
 *     <div style="position: relative;"> …content… </div>
 *   </div>
 *
 * The canvas goes into the host, which React renders with no children and so
 * never reconciles. Same trick as prism-grid.js. Content after the host is
 * positioned, so it paints above the pixels. On the home CTA the host is the
 * existing 48px grid layer, so the pixels sit over the grid lines and under
 * the copy.
 *
 * Left out of the original: its variants, shapes, `trigger` modes and props
 * (the values below are the ones chosen), and the card chrome (surface,
 * edge highlight, tabIndex), since the CTA brings its own and its links are
 * already focusable.
 *
 * Under reduced motion nothing twinkles, flashes or pulses, there is no
 * intro, and hovering shows the field at once. The loop stops whenever the
 * field is settled or off screen.
 */
(function () {
  if (window.__pixelCard) return;
  window.__pixelCard = true;

  // The original's dark "blue" variant, re-hued from sky to signal blue.
  var COLORS = ['#dbe4ff', '#8fa8ff', '#2f5cf0'];
  var GLOW = [47, 92, 240];
  var GAP = 8;               // 48px grid ÷ 6
  var SPEED = 25;            // twinkle rate
  var PIXEL = 2;             // max pixel size, px
  var REVEAL = 600;          // ms for the ripple to cross the card
  var SPOTLIGHT = 0.5;
  var GLOW_STRENGTH = 0.5;
  var APPEAR = 0.26, EXIT = 0.22;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function smoothstep(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function easeOutBack(t) { var c = 1.9, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }

  function mount(host) {
    if (host._pixelCard) return;
    var card = host.parentElement;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    host._pixelCard = true;

    var st = {
      raf: 0, last: 0, time: 0, dt: 1 / 60, visible: false,
      width: 0, height: 0, ratio: 1, key: '', count: 0,
      x: null, y: null, tint: null, size: null, phase: null, rate: null, jitter: null, presence: new Float32Array(0), delay: null,
      active: false, changedAt: 0, originX: 0, originY: 0, maxDistance: 1,
      pointerX: 0, pointerY: 0, spotX: 0, spotY: 0, spotVX: 0, spotVY: 0, spotPower: 0,
      hovering: false, focused: false, pulses: [], releaseAt: -1, introAt: -1, introDone: false
    };

    function build() {
      var r = card.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var key = w + '|' + h + '|' + ratio;
      if (key === st.key) return;
      st.key = key; st.width = w; st.height = h; st.ratio = ratio;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      var cols = Math.floor((w - 1) / GAP) + 1, rows = Math.floor((h - 1) / GAP) + 1;
      var ox = (w - (cols - 1) * GAP) / 2, oy = (h - (rows - 1) * GAP) / 2;
      var n = cols * rows, prev = st.presence;
      st.count = n;
      st.x = new Float32Array(n); st.y = new Float32Array(n); st.tint = new Uint8Array(n);
      st.size = new Float32Array(n); st.phase = new Float32Array(n); st.rate = new Float32Array(n);
      st.jitter = new Float32Array(n); st.presence = new Float32Array(n); st.delay = new Float32Array(n);
      var i = 0;
      for (var c = 0; c < cols; c++) for (var rw = 0; rw < rows; rw++) {
        st.x[i] = ox + c * GAP; st.y[i] = oy + rw * GAP;
        st.tint[i] = Math.floor(Math.random() * COLORS.length);
        st.size[i] = PIXEL * (0.25 + Math.random() * 0.75);
        st.phase[i] = Math.random() * Math.PI * 2;
        st.rate[i] = 0.55 + Math.random() * 0.9;
        st.jitter[i] = Math.random();
        if (prev.length) st.presence[i] = prev[Math.min(i, prev.length - 1)];
        i++;
      }
      schedule();
    }

    // each pixel's delay: outward from the origin when revealing, inward when hiding
    function schedule() {
      var span = REVEAL / 1000, far = 1, i;
      for (i = 0; i < st.count; i++) far = Math.max(far, Math.hypot(st.x[i] - st.originX, st.y[i] - st.originY));
      st.maxDistance = far;
      for (i = 0; i < st.count; i++) {
        var d = Math.hypot(st.x[i] - st.originX, st.y[i] - st.originY) / far;
        st.delay[i] = st.active ? d * span * 0.82 + st.jitter[i] * span * 0.18
                                : (1 - d) * span * 0.45 + st.jitter[i] * span * 0.1;
      }
    }

    function setActive(on, x, y) {
      if (st.active === on) return;
      st.active = on;
      st.changedAt = st.time;
      if (on) {
        st.originX = x !== undefined ? x : st.width / 2;
        st.originY = y !== undefined ? y : st.height / 2;
      }
      schedule();
      wake();
    }

    function draw() {
      var w = st.width, h = st.height, i;
      ctx.setTransform(st.ratio, 0, 0, st.ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var sum = 0, elapsed = st.time - st.changedAt, up = st.dt / APPEAR, down = st.dt / EXIT;
      for (i = 0; i < st.count; i++) {
        var cur = st.presence[i], ready = elapsed >= st.delay[i] || reduced;
        var target = st.active ? (ready ? 1 : 0) : (ready ? 0 : cur);
        if (reduced) st.presence[i] = target;
        else if (target > cur) st.presence[i] = Math.min(1, cur + up);
        else if (target < cur) st.presence[i] = Math.max(0, cur - down);
        sum += st.presence[i];
      }
      var avg = st.count ? sum / st.count : 0;

      if (avg > 0.001) {
        var cx = st.spotPower > 0.01 ? st.spotX : st.originX, cy = st.spotPower > 0.01 ? st.spotY : st.originY;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
        var s = GLOW_STRENGTH * 0.32 * Math.min(1, avg * 1.4), rgb = GLOW.join(',');
        g.addColorStop(0, 'rgba(' + rgb + ',' + s + ')');
        g.addColorStop(0.45, 'rgba(' + rgb + ',' + s * 0.35 + ')');
        g.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      var spotR = Math.min(w, h) * 0.38 + 30, spot = SPOTLIGHT * st.spotPower;
      var twinkle = !reduced, freq = (SPEED / 35) * 1.35, pulses = st.pulses;
      for (var col = 0; col < COLORS.length; col++) {
        ctx.fillStyle = COLORS[col];
        for (i = 0; i < st.count; i++) {
          if (st.tint[i] !== col) continue;
          var p = st.presence[i];
          if (p <= 0.002) continue;
          var x = st.x[i], y = st.y[i], size = st.size[i], alpha = 0.5 + p * 0.38;
          if (twinkle) {
            var wave = Math.sin(st.phase[i] + st.time * freq * st.rate[i]);
            size *= 0.62 + 0.38 * wave;
            alpha += 0.12 * wave + (st.jitter[i] > 0.92 ? 0.35 * Math.max(0, wave) : 0);
          }
          size *= easeOutBack(p);
          var flash = p < 1 && st.active && !reduced ? Math.sin(p * Math.PI) : 0;
          size *= 1 + flash * 0.9;
          alpha += flash * 0.6;
          if (spot > 0.001) {
            var near = smoothstep(spotR, 0, Math.hypot(x - st.spotX, y - st.spotY));
            size *= 1 + spot * near * near * 2.4;
            alpha += spot * near * 0.45;
          }
          alpha = Math.min(1, alpha);
          if (alpha <= 0.004) continue;
          for (var k = 0; k < pulses.length; k++) {
            var band = (Math.hypot(x - pulses[k].x, y - pulses[k].y) - pulses[k].radius) / 26;
            var pw = Math.exp(-band * band) * pulses[k].power;
            size *= 1 + pw * 1.4;
            alpha = Math.min(1, alpha + pw * 0.5);
          }
          if (size <= 0.05) continue;
          ctx.globalAlpha = alpha;
          ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
        }
      }
      ctx.globalAlpha = 1;
      return sum;
    }

    function frame(now) {
      st.raf = 0;
      var dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60;
      st.last = now; st.dt = dt; st.time += dt;
      build();
      if (st.introAt >= 0 && st.time >= st.introAt) {
        st.introAt = -1;
        if (!st.active) { setActive(true); st.releaseAt = st.time + REVEAL / 1000 + 0.7; }
      }
      if (st.releaseAt >= 0 && st.time >= st.releaseAt && !st.hovering && !st.focused) {
        st.releaseAt = -1;
        setActive(false);
      }
      // the swelling spot trails the pointer on a slightly underdamped spring
      var want = st.hovering && !reduced ? 1 : 0;
      st.spotPower += (want - st.spotPower) * (1 - Math.exp(-(want ? 6 : 3) * dt));
      var k = 120, damp = 2 * Math.sqrt(k) * 0.9;
      st.spotVX += (k * (st.pointerX - st.spotX) - damp * st.spotVX) * dt;
      st.spotVY += (k * (st.pointerY - st.spotY) - damp * st.spotVY) * dt;
      st.spotX += st.spotVX * dt;
      st.spotY += st.spotVY * dt;
      var ps = st.maxDistance / Math.max(0.35, (REVEAL / 1000) * 0.9);
      st.pulses = st.pulses.filter(function (q) {
        q.radius += ps * dt;
        q.power = Math.max(0, 1 - q.radius / (st.maxDistance + 40));
        return q.power > 0;
      });
      var presence = draw();
      var busy = st.active || st.introAt >= 0 || presence > 0 || st.pulses.length ||
        st.spotPower > 0.002 || Math.abs(st.spotVX) + Math.abs(st.spotVY) > 0.5;
      if (busy && st.visible) st.raf = requestAnimationFrame(frame);
      else st.last = 0;
    }

    function wake() { if (!st.raf && st.visible) st.raf = requestAnimationFrame(frame); }

    function local(e) { var r = card.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    card.addEventListener('pointerenter', function (e) {
      var p = local(e);
      st.hovering = e.pointerType !== 'touch';
      st.pointerX = p[0]; st.pointerY = p[1];
      if (st.spotPower < 0.01) { st.spotX = p[0]; st.spotY = p[1]; st.spotVX = st.spotVY = 0; }
      st.releaseAt = -1; st.introAt = -1;
      setActive(true, p[0], p[1]);
      wake();
    });
    card.addEventListener('pointermove', function (e) {
      var p = local(e);
      st.pointerX = p[0]; st.pointerY = p[1];
      wake();
    });
    card.addEventListener('pointerleave', function (e) {
      st.hovering = false;
      if (e.pointerType === 'touch') st.releaseAt = st.time + 1.2;
      else if (!st.focused) setActive(false);
      wake();
    });
    card.addEventListener('pointerdown', function (e) {
      var p = local(e);
      if (!st.active) setActive(true, p[0], p[1]);
      if (!reduced) st.pulses.push({ x: p[0], y: p[1], radius: 0, power: 1 });
      wake();
    });
    // keyboard focus only: a mouse click on the mail button focuses it too,
    // and that would hold the field on after the pointer has gone
    card.addEventListener('focusin', function (e) {
      try { if (!e.target.matches(':focus-visible')) return; } catch (err) { /* old browser */ }
      st.focused = true;
      setActive(true);
    });
    card.addEventListener('focusout', function (e) {
      if (card.contains(e.relatedTarget)) return;
      st.focused = false;
      if (!st.hovering) setActive(false);
    });

    new ResizeObserver(function () { build(); wake(); }).observe(card);
    new IntersectionObserver(function (entries) {
      st.visible = entries.some(function (en) { return en.isIntersecting; });
      if (st.visible && !st.introDone && !reduced) {
        st.introDone = true;
        build();
        st.introAt = st.time;
      }
      if (st.visible) wake();
    }).observe(card);

    build();
    st.pointerX = st.spotX = st.originX = st.width / 2;
    st.pointerY = st.spotY = st.originY = st.height / 2;
  }

  // x-dc renders after this file runs, and the raw template is in the DOM
  // under display:none until then: only mount hosts that have a box.
  function scan() {
    var hosts = document.querySelectorAll('[data-pixel-card]'), pending = false;
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i]._pixelCard) continue;
      if (hosts[i].getClientRects().length) mount(hosts[i]);
      else pending = true;
    }
    return pending || !hosts.length;
  }
  (function poll(n) {
    if (scan() && n < 600) requestAnimationFrame(function () { poll(n + 1); });
  })(0);
})();
