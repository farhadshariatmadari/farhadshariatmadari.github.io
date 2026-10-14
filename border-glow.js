/**
 * Border glow — the edge of a card nearest the pointer lights up.
 *
 * A vanilla port of React Bits' <BorderGlow> (reactbits.dev/components/
 * border-glow), in its light-surface settings, recoloured to the site's
 * palette. While the pointer is over a card, a mesh-gradient border and a
 * soft blue glow fade in on the side it is closest to, and follow it around.
 * At the card's centre nothing shows. It strengthens toward the edge.
 *
 * Usage — one attribute on the card, nothing else:
 *
 *   <figure data-border-glow style="border: 1px solid …; border-radius: 12px; background: #fff;">
 *
 * Standalone rather than page logic, like prism-grid.js. Unlike the React
 * original, it adds **no element** to the card. The original appends an
 * `.edge-light` span, which here would become the card's last child. Work's
 * flagship card is an `.r-strip`, and responsive.css hangs its dividers off
 * `> *:last-child`, so the image cell would grow a stray border when it stacks.
 * So the two layers live in the card's own pseudo-elements, and the script
 * only writes two custom properties:
 *
 *   ::before  the gradient border, masked to a cone pointing at the cursor
 *   ::after   the glow, inset and outset box-shadows under the same cone
 *
 * The original's third layer, a faint colour fill just inside the edge (0.22
 * on light surfaces), needs a third box, so it is left out.
 *
 * Both layers sit at z-index -1 inside the card's own stacking context
 * (`isolation: isolate`): above its background, below its content, so text is
 * never tinted. They overlay the card's 1px border exactly (`inset: -1px`), so
 * the colour replaces the grey edge rather than doubling it. Every card it is
 * used on has a 1px border and a #fff background (`--bg-card` if not).
 *
 * The glow reaches 50px outside the card, so a glowing card can't clip its
 * own overflow: overflow is set visible here. Anything inside that relied on
 * the card's clip for its rounded corners needs its own radius (Work's
 * flagship image does).
 *
 * Mouse and trackpad only (`hover: hover`): a tap leaves :hover stuck on, and
 * there is no edge to approach with a finger.
 */
(function () {
  if (window.__borderGlow) return;
  window.__borderGlow = true;

  // React Bits' light-surface demo values, with its purple swapped for the
  // site's signal blue (#2f5cf0 is hsl(226 86% 56%)) and the mesh drawn from
  // the prism grid's own colours: signal blue, violet, pink.
  var GLOW = '226deg 86% 56%';
  var INTENSITY = 1.25;
  var COLORS = ['#2f5cf0', '#7a5cf0', '#e0397f'];
  var EDGE_SENSITIVITY = 30;   // % of the way to the edge before the glow starts
  var CONE_SPREAD = 25;        // width of the lit arc, in % of the turn
  var GLOW_RADIUS = 40;        // px the mask reaches beyond the card

  function glowShadows() {
    var a = [100, 60, 50, 40, 30, 20, 10].map(function (o) {
      return 'hsl(' + GLOW + ' / ' + Math.min(o * INTENSITY, 100) + '%)';
    });
    return [
      'inset 0 0 0 1px ' + a[0], 'inset 0 0 1px 0 ' + a[1], 'inset 0 0 3px 0 ' + a[2],
      'inset 0 0 6px 0 ' + a[3], 'inset 0 0 15px 0 ' + a[4], 'inset 0 0 25px 2px ' + a[5],
      'inset 0 0 50px 2px ' + a[6],
      '0 0 1px 0 ' + a[1], '0 0 3px 0 ' + a[2], '0 0 6px 0 ' + a[3],
      '0 0 15px 0 ' + a[4], '0 0 25px 2px ' + a[5], '0 0 50px 2px ' + a[6]
    ].join(',');
  }

  function meshBorder() {
    var at = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
    var pick = [0, 1, 2, 0, 1, 2, 1];
    return at.map(function (p, i) {
      return 'radial-gradient(at ' + p + ', ' + COLORS[pick[i]] + ' 0px, transparent 50%) border-box';
    }).concat('linear-gradient(' + COLORS[0] + ' 0 100%) border-box').join(',');
  }

  function cone(a, b, c, d) {
    return 'conic-gradient(from var(--cursor-angle) at center, black ' + a + '%, transparent ' +
      b + '%, transparent ' + c + '%, black ' + d + '%)';
  }

  var S = '[data-border-glow]';
  var color = EDGE_SENSITIVITY + 20;
  var borderMask = cone(CONE_SPREAD, CONE_SPREAD + 15, 100 - CONE_SPREAD - 15, 100 - CONE_SPREAD);
  var glowMask = cone(2.5, 10, 90, 97.5);
  var reach = 'calc(100% + ' + GLOW_RADIUS * 2 + 'px) calc(100% + ' + GLOW_RADIUS * 2 + 'px)';

  var css =
    '@media (hover: hover) {' +
      S + '{--edge-proximity:0;--cursor-angle:45deg;position:relative;isolation:isolate;overflow:visible!important;}' +
      S + '::before,' + S + '::after{content:"";position:absolute;inset:-1px;border-radius:inherit;' +
        'pointer-events:none;z-index:-1;transition:opacity .25s ease-out;}' +
      S + ':not(:hover)::before,' + S + ':not(:hover)::after{opacity:0;transition:opacity .75s ease-in-out;}' +
      // the gradient border: card colour over the padding box, mesh on the 1px ring
      S + '::before{border:1px solid transparent;' +
        'background:linear-gradient(var(--bg-card,#fff) 0 100%) padding-box,' + meshBorder() + ';' +
        'opacity:calc((var(--edge-proximity) - ' + color + ') / ' + (100 - color) + ');' +
        '-webkit-mask-image:' + borderMask + ';mask-image:' + borderMask + ';}' +
      // the glow: the mask is drawn larger than the card and not clipped to it,
      // so the outset shadows survive it. Same cone, centred on the card.
      S + '::after{box-shadow:' + glowShadows() + ';' +
        'opacity:calc((var(--edge-proximity) - ' + EDGE_SENSITIVITY + ') / ' + (100 - EDGE_SENSITIVITY) + ');' +
        '-webkit-mask-image:' + glowMask + ';mask-image:' + glowMask + ';' +
        '-webkit-mask-size:' + reach + ';mask-size:' + reach + ';' +
        '-webkit-mask-position:center;mask-position:center;' +
        '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;' +
        '-webkit-mask-clip:no-clip;mask-clip:no-clip;}' +
    '}';

  var s = document.createElement('style');
  s.id = 'bg-css';
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  // Straight from the original: proximity is how far toward the nearest edge
  // the pointer is, 0 at the centre and 100 on the border, measured along the
  // ray from the centre so a wide card and a tall one behave alike. The angle
  // aims the cone at the pointer, with 0deg at the top.
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var card = e.target.closest && e.target.closest(S);
    if (!card) return;
    var r = card.getBoundingClientRect();
    var cx = r.width / 2, cy = r.height / 2;
    var dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    var kx = dx ? cx / Math.abs(dx) : Infinity, ky = dy ? cy / Math.abs(dy) : Infinity;
    var edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    var angle = dx || dy ? Math.atan2(dy, dx) * 180 / Math.PI + 90 : 0;
    if (angle < 0) angle += 360;
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
    card.style.setProperty('--cursor-angle', angle.toFixed(3) + 'deg');
  }, { passive: true });
})();
