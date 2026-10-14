/**
 * Smooth scroll — Lenis on every page, plus a few hooks for using it in markup.
 *
 * Lenis (darkroom.engineering, lenis.dev) eases wheel and trackpad scrolling
 * on top of the browser's own scroll. It never fakes the position: scrollY
 * stays real, so `position: sticky`, IntersectionObserver (pointer-highlight.js)
 * and back-button scroll restoration all keep working untouched.
 *
 * One line per page, inside <helmet>:
 *
 *   <script src="./smooth-scroll.js"></script>
 *
 * This file loads Lenis itself instead of taking a second <script> tag: x-dc
 * re-creates helmet scripts with createElement, an injected script is async,
 * and two tags would run in whichever order the network returned them.
 *
 * What it gives page markup:
 *
 *   <a href="#process">                        in-page links glide, landing under the sticky header
 *   <button data-scroll-to="top">              any element: "#id", a selector, "top", "bottom", or px
 *           data-scroll-offset="-24"           optional, px
 *           data-scroll-duration="1.6"         optional, seconds
 *   <img data-speed="0.15">                    parallax, see parallax() below
 *   <div data-lenis-prevent>                   native scroll inside it (rarely needed, see `allowNestedScroll`)
 *
 * And for scripts: `window.smoothScroll.to(target, options)`, which works
 * whether or not Lenis has loaded, and `window.lenis` once it has.
 *
 * Touch is left native (`syncTouch` off). iOS momentum is already smooth, and
 * imitating it in JS is what makes smooth-scroll sites feel wrong on a phone.
 * Under prefers-reduced-motion Lenis stops easing the wheel and makes every
 * programmatic scroll instant (`respectReducedMotion`), and parallax is off.
 * If unpkg is unreachable the page simply scrolls natively.
 */
(function () {
  if (window.smoothScroll) return;

  var SRC = 'https://unpkg.com/lenis@1.3.26/dist/lenis.min.js';
  var SRI = 'sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw';
  var GLIDE = 1.2;   // seconds, for clicks; the wheel uses Lenis's lerp
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var lenis = null;

  // lenis/dist/lenis.css, inlined so it costs no extra request.
  var css =
    'html.lenis,html.lenis body{height:auto;}' +
    '.lenis:not(.lenis-autoToggle).lenis-stopped{overflow:clip;}' +
    '.lenis [data-lenis-prevent],.lenis [data-lenis-prevent-wheel],.lenis [data-lenis-prevent-touch],' +
    '.lenis [data-lenis-prevent-vertical],.lenis [data-lenis-prevent-horizontal]{overscroll-behavior:contain;}' +
    '.lenis.lenis-smooth iframe{pointer-events:none;}';

  function injectCss() {
    if (document.getElementById('ss-css')) return;
    var s = document.createElement('style');
    s.id = 'ss-css';
    s.textContent = css;
    (document.head || root).appendChild(s);
  }

  // x-dc mounts the page into #dc-root after the load event, and with Lenis in
  // the HTTP cache this file can start before there is a header or a #hash
  // target to measure. Anything that needs page markup waits for it, up to
  // ~10s of frames.
  function waitFor(test, fn, tries) {
    tries = tries || 0;
    if (test()) return fn();
    if (tries < 600) requestAnimationFrame(function () { waitFor(test, fn, tries + 1); });
  }

  // Until x-dc has rendered, the page's raw markup sits in the document under
  // `display: none`: same header, same ids. Every lookup takes the first
  // element that has a box, so it can't measure, or land on, the hidden copy.
  function live(list) {
    for (var i = 0; i < list.length; i++) if (list[i].getClientRects().length) return list[i];
    return null;
  }

  function header() { return live(document.querySelectorAll('header')); }

  // The sticky header's height becomes the root's scroll-padding-top. Lenis's
  // scrollTo reads it, so an anchor lands just under the header instead of
  // behind it, and the browser reads it too: tabbing to a link near the top
  // edge no longer parks the focus ring under the header. The nav sheds parts
  // at 860/720/560, so it is re-measured on resize and before every scroll.
  function syncHeader() {
    var h = header();
    var sticky = h && /sticky|fixed/.test(getComputedStyle(h).position);
    root.style.scrollPaddingTop = sticky ? h.offsetHeight + 'px' : '';
  }

  function resolve(target) {
    if (typeof target !== 'string') return target;
    if (/^-?\d+(\.\d+)?$/.test(target)) return +target;
    if (target === '#' || target === '#top') return 'top';
    if (target === 'top' || target === 'bottom') return target;
    try {
      if (target.charAt(0) === '#') target = '#' + CSS.escape(decodeURIComponent(target.slice(1)));
      return live(document.querySelectorAll(target));
    } catch (e) { return null; }
  }

  function to(target, opts) {
    opts = opts || {};
    var t = resolve(target);
    if (t == null) return;
    syncHeader();
    if (lenis) {
      lenis.scrollTo(t, {
        offset: opts.offset || 0,
        duration: opts.duration != null ? opts.duration : GLIDE,
        immediate: !!opts.immediate,
        onComplete: opts.onComplete
      });
      return;
    }
    // Lenis didn't load. Same targets, browser scrolling.
    var y = t === 'top' ? 0
      : t === 'bottom' ? root.scrollHeight
      : typeof t === 'number' ? t
      : t.getBoundingClientRect().top + window.scrollY -
        (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0);
    window.scrollTo({ top: y + (opts.offset || 0), behavior: reduced || opts.immediate ? 'auto' : 'smooth' });
  }

  function onClick(e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target.closest && e.target.closest('[data-scroll-to], a[href^="#"]');
    if (!el) return;
    var target = el.getAttribute('data-scroll-to') || el.getAttribute('href');
    if (resolve(target) == null) return;
    e.preventDefault();
    to(target, {
      offset: parseFloat(el.getAttribute('data-scroll-offset')) || 0,
      duration: el.hasAttribute('data-scroll-duration') ? parseFloat(el.getAttribute('data-scroll-duration')) : undefined
    });
    if (el.tagName === 'A' && target.length > 1) history.pushState(null, '', target);
  }

  // Parallax: `data-speed` is how much of the scroll an element holds back.
  // 0.1–0.3 sinks it behind the page, a negative value lifts it in front.
  // Uses the individual `translate` property, so it neither fights a
  // `transform` the element already has nor gets reset by React, which only
  // writes the style keys a template names.
  //
  // Where it sits as designed (`data-speed-rest`):
  //   (default)  when its centre crosses the middle of the viewport. It moves
  //              both ways from there, so the offset on screen stays small.
  //   "entry"    the moment it comes into view, or at page load if it's
  //              already in view, then it only drifts one way. For anything
  //              flush with a clipping edge: a phone standing on a frame's
  //              bottom, a sketch on a hero's floor. Under the default it
  //              would rise while below centre and open a gap under itself.
  //              Also for hero visuals, so a page loads exactly as designed.
  //
  // For an image moving inside a frame, make the image taller than the frame
  // (say height: 120%) and give the frame overflow: hidden, or its edge shows.
  //
  // Queried every frame rather than cached, because x-dc renders late and
  // <sc-if> can add elements at any time; all reads happen before any write.
  //
  // Only where Lenis is the one easing the scroll: a mouse or trackpad, on a
  // layout wide enough to have columns. Touch scrolling runs on the
  // compositor and a JS-written translate trails it by a frame, which reads
  // as jitter; and under 861px everything is one column, so a drifting
  // element has nothing beside it to drift against, only its own neighbours
  // to run into.
  var PARALLAX = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)');

  function parallax() {
    var els = document.querySelectorAll('[data-speed]');
    if (!els.length) return;
    if (!PARALLAX.matches) {
      for (var j = 0; j < els.length; j++) {
        if (!els[j]._ssY) continue;
        els[j]._ssY = 0;
        els[j].style.translate = '';
      }
      return;
    }
    var vh = window.innerHeight, mid = vh / 2, sy = window.scrollY, ys = [];
    for (var i = 0; i < els.length; i++) {
      // Never on an element motion.js also animates. GSAP folds an existing
      // `translate` into its own transform when it sets a tween up and
      // writes `translate: none`, so the offset counts twice for the whole
      // reveal, then motion.js's restore snaps it back: a 24-34px jump on
      // Medio's hero. Put data-speed on a wrapper around the data-gsap
      // element instead. A parent's translate and a child's transform
      // compose without either one touching the other.
      if (els[i].hasAttribute('data-gsap')) {
        if (!els[i]._ssWarned) {
          els[i]._ssWarned = true;
          console.warn('smooth-scroll.js: data-speed ignored on an element that also has data-gsap; wrap one in the other', els[i]);
        }
        ys.push(null);
        continue;
      }
      var r = els[i].getBoundingClientRect();
      // A page switches one element off at its own breakpoint with
      // `translate: none !important`, which beats the inline value written
      // below. The rect then holds no offset, so there is nothing to take
      // back out of it. Without this check the subtraction would chase an
      // offset that was never applied.
      var held = getComputedStyle(els[i]).translate === 'none' ? 0 : (els[i]._ssY || 0);
      var top = r.top - held, h = r.height, d;
      // d = how far the page has scrolled past the element's resting point.
      // Both are clamped so an element far off screen isn't thrown a page
      // away, which would also stretch the document's scrollable height.
      if (els[i].getAttribute('data-speed-rest') === 'entry') {
        d = Math.max(0, Math.min(vh + h, sy - Math.max(0, top + sy - vh)));
      } else {
        d = Math.max(-vh, Math.min(vh, mid - top - h / 2));
      }
      ys.push(Math.round(d * (parseFloat(els[i].getAttribute('data-speed')) || 0) * 100) / 100);
    }
    for (i = 0; i < els.length; i++) {
      if (ys[i] === null || els[i]._ssY === ys[i]) continue;
      els[i]._ssY = ys[i];
      els[i].style.translate = ys[i] ? '0 ' + ys[i] + 'px' : '';
    }
  }

  // The browser looks for a #hash target before x-dc has rendered it, finds
  // nothing, and stays at the top, so a link like `Work#medio` would never
  // land. Land it ourselves once the target exists and the webfonts have
  // settled the layout, but never over a back/forward scroll restore.
  function landOnHash() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!location.hash || location.hash === '#' || (nav && nav.type === 'back_forward')) return;
    waitFor(function () { return resolve(location.hash); }, function () {
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        if (lenis) lenis.resize();
        to(location.hash, { immediate: true });
      });
    });
  }

  function start() {
    waitFor(header, syncHeader);
    if (window.Lenis) {
      lenis = window.lenis = new window.Lenis({
        autoRaf: true,
        // Behinto and Medio show tall screenshots in 560px frames that scroll
        // on their own, and Contact has a textarea. Without this the wheel
        // over them would move the page instead. Lenis caches each element's
        // overflow check for 2s, so the cost is small.
        allowNestedScroll: true
      });
      if (!reduced) {
        lenis.on('scroll', parallax);
        parallax();
      }
    }
    landOnHash();
  }

  window.smoothScroll = { to: to };
  injectCss();
  document.addEventListener('click', onClick);
  window.addEventListener('resize', function () {
    syncHeader();
    if (lenis && !reduced) parallax();
  });

  if (window.Lenis) { start(); return; }
  var s = document.createElement('script');
  s.src = SRC;
  s.integrity = SRI;
  s.crossOrigin = 'anonymous';
  s.onload = s.onerror = start;
  (document.head || root).appendChild(s);
})();
