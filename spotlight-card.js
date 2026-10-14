/**
 * Spotlight card — a soft light inside the card that follows the pointer.
 *
 * A vanilla port of React Bits' <SpotlightCard> (reactbits.dev/components/
 * spotlight-card), light theme. The light eases after the pointer, fades in
 * once the pointer comes within 80px of the card and out once it leaves,
 * swells briefly while the card is pressed, and centres on a card that has
 * keyboard focus. Under reduced motion it jumps instead of easing.
 *
 * Usage — one attribute on the card:
 *
 *   <a data-spotlight data-border-glow href="Medio" style="… background: #fff;">
 *
 * Unlike the original, it adds **no element**. The original layers four spans
 * into the card (light, grain, border, rim), and border-glow.js explains why
 * the cards here can't take children: Work's flagship is an `.r-strip`, and
 * responsive.css styles its stacked dividers off `> *:last-child`. Its
 * pseudo-elements already belong to the border glow. So the light is painted
 * as the card's own `background-image`, through `--spot-fill`, which the
 * script rewrites each frame with the strength baked into the gradient's
 * alpha. `!important` is needed because every card sets `background` inline.
 *
 * border-glow.js's `::before` paints the card's interior opaque, so its ring
 * can sit on top. It repeats `var(--spot-fill)` in that fill, so the light
 * runs on under the glowing edge instead of being covered by it. The two
 * files are coupled there on purpose. Change the fill in one, check the other.
 *
 * Left out of the original: the film grain (`grain` defaults to 0 there) and
 * the 1px rim light along the border. The rim needs a box of its own, and
 * near an edge, where it would show, the border glow already lights the rim.
 *
 * One rAF loop drives every card, and it stops as soon as all of them have
 * settled. Nothing runs while the pointer is still or away.
 */
(function () {
  if (window.__spotlightCard) return;
  window.__spotlightCard = true;

  // The original's light theme scales intensity by 0.28. Its light is ink
  // (#18181b); here it is the site's signal blue, so it reads as the same
  // light as the border glow at the edge.
  var COLOR = [47, 92, 240];      // #2f5cf0
  var INTENSITY = 0.15 * 0.28 * 1.6;
  var SIZE = 240;                 // px radius of the light
  var SOFTNESS = 0.7;
  var PROXIMITY = 80;             // px outside the card it starts to show
  var SMOOTHING = 0.3;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = '[data-spotlight]';

  var css = S + '{--spot-fill:none;background-image:var(--spot-fill)!important;}';
  var st = document.createElement('style');
  st.id = 'sc-css';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // The original's falloff: a solid core that eases into a gaussian glow.
  // Kept as [alpha, position] pairs so the strength can be multiplied in.
  var STOPS = (function () {
    var core = Math.pow(1 - SOFTNESS, 1.5) * 0.85, list = [[1, 0]];
    for (var i = 0; i <= 14; i++) {
      var t = core + ((1 - core) * i) / 14;
      var g = (t - core) / (1 - core);
      var smooth = 1 - g * g * (3 - 2 * g);
      var glow = Math.exp(-4.6 * g * g) * (1 - Math.pow(g, 6));
      list.push([smooth + (glow - smooth) * SOFTNESS, t]);
    }
    return list;
  })();

  function gradient(x, y, size, strength) {
    var rgb = COLOR.join(',');
    return 'radial-gradient(circle ' + size.toFixed(1) + 'px at ' + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px,' +
      STOPS.map(function (s) {
        return 'rgba(' + rgb + ',' + (s[0] * strength).toFixed(4) + ') ' + (s[1] * 100).toFixed(2) + '%';
      }).join(',') + ')';
  }

  var pointer = { x: 0, y: 0, active: false };
  var focus = null, raf = 0, last = 0;

  function cards() { return document.querySelectorAll(S); }

  function tick(now) {
    raf = 0;
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    var busy = false, list = cards();
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var s = el._spot || (el._spot = { x: 0, y: 0, presence: 0, flare: 0, pressed: false, drawn: '' });
      var r = el.getBoundingClientRect();
      if (!r.width) continue;
      // coordinates inside the padding box, where background-position starts
      var ox = r.left + el.clientLeft, oy = r.top + el.clientTop;
      var tx = s.x, ty = s.y, target = 0;
      if (focus && el.contains(focus)) {
        var b = focus.getBoundingClientRect();
        tx = b.left + b.width / 2 - ox;
        ty = b.top + b.height / 2 - oy;
        target = 1;
      } else if (pointer.active) {
        tx = pointer.x - ox;
        ty = pointer.y - oy;
        var px = pointer.x - r.left, py = pointer.y - r.top;
        var gap = Math.hypot(Math.max(0, -px, px - r.width), Math.max(0, -py, py - r.height));
        target = gap === 0 ? 1 : Math.pow(Math.max(0, 1 - gap / PROXIMITY), 2);
      }
      if (s.presence < 0.02 && target > 0) { s.x = tx; s.y = ty; }   // appear where the pointer is, don't fly in
      var follow = reduced ? 1 : 1 - Math.exp(-dt / (0.015 + SMOOTHING * 0.22));
      s.x += (tx - s.x) * follow;
      s.y += (ty - s.y) * follow;
      var fade = reduced ? 1 : 1 - Math.exp(-dt / (target > s.presence ? 0.1 : 0.32));
      s.presence += (target - s.presence) * fade;
      if (Math.abs(target - s.presence) < 0.002) s.presence = target;
      var press = s.pressed && !reduced ? 1 : 0;
      s.flare += (press - s.flare) * (1 - Math.exp(-dt / (press ? 0.05 : 0.28)));
      if (Math.abs(press - s.flare) < 0.002) s.flare = press;

      var strength = Math.min(1, s.presence * INTENSITY * (1 + 0.7 * s.flare));
      var fill = strength > 0.0005 ? gradient(s.x, s.y, SIZE * (1 + 0.2 * s.flare), strength) : 'none';
      if (fill !== s.drawn) { s.drawn = fill; el.style.setProperty('--spot-fill', fill); }

      var moving = Math.abs(tx - s.x) > 0.1 || Math.abs(ty - s.y) > 0.1;
      if (moving || s.presence !== target || s.flare !== press) busy = true;
    }
    if (busy) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    wake();
  }, { passive: true });
  // pointer left the window altogether
  document.addEventListener('pointerout', function (e) {
    if (e.relatedTarget) return;
    pointer.active = false;
    wake();
  });
  document.addEventListener('pointerdown', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    var el = e.target.closest && e.target.closest(S);
    if (el && el._spot) el._spot.pressed = true;
    wake();
  });
  function release(e) {
    if (e.pointerType !== 'mouse') pointer.active = false;
    var list = cards();
    for (var i = 0; i < list.length; i++) if (list[i]._spot) list[i]._spot.pressed = false;
    wake();
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  // keyboard focus: only :focus-visible, so a mouse click doesn't pin the light
  document.addEventListener('focusin', function (e) {
    if (!(e.target instanceof Element) || !e.target.closest(S)) return;
    try { if (!e.target.matches(':focus-visible')) return; } catch (err) { /* old browser */ }
    focus = e.target;
    wake();
  });
  document.addEventListener('focusout', function () { focus = null; wake(); });
  // a card scrolling under a still pointer moves relative to it
  window.addEventListener('scroll', function () { if (pointer.active) wake(); }, { capture: true, passive: true });
})();
