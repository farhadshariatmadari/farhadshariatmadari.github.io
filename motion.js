/**
 * Motion — declarative GSAP presets, driven by a data attribute.
 *
 *   <h2 data-gsap="fade-up">…</h2>
 *
 * The element animates once, when it scrolls into view. Options, all optional:
 *
 *   data-gsap-delay="200"      ms before it starts (default 0)
 *   data-gsap-duration="900"   ms (default depends on the preset)
 *   data-gsap-stagger="80"     animate the element's children one after another,
 *                              this many ms apart, instead of the element itself
 *   data-gsap-start="top 70%"  ScrollTrigger start (default "top 88%")
 *
 * Presets:
 *
 *   fade · fade-up · fade-down · from-left · from-right · scale-in · blur-in
 *   clip-up      wipes in from the bottom edge (clip-path)
 *   split-lines  lines rise out of a mask       ┐ SplitText — static text
 *   split-words  words fade up one by one       │ only, see the note below
 *   split-chars  characters fade up one by one  ┘
 *   count        counts a number up from 0, keeping what's around it: "8%",
 *                "1,200+", "$3.5M". The element must hold plain text only.
 *
 * Parallax isn't here on purpose: smooth-scroll.js already gives every page
 * `data-speed`, and one site should have one way to do it.
 *
 * Needs, in this order, inside <helmet>:
 *
 *   <script src="./vendor/gsap/gsap.min.js"></script>
 *   <script src="./vendor/gsap/ScrollTrigger.min.js"></script>
 *   <script src="./vendor/gsap/SplitText.min.js"></script>   (split-* only)
 *   <script src="./motion.js"></script>
 *
 * Standalone rather than page logic, like prism-grid.js: it watches the DOM for
 * [data-gsap] because pages render through React well after this file runs.
 *
 * Every one-shot preset puts the element's own inline style back exactly as
 * React wrote it once the animation ends. The export keeps layout and opacity
 * in inline styles, and leaving GSAP's transform behind would become a baseline
 * that later GSAP work parses and can't clear (see the skewY landmine in
 * index.html's card stack).
 *
 * split-* replaces the element's children while it runs and restores them as
 * HTML afterwards, so React's own text nodes are gone. Harmless on static
 * copy; never put it on text that page logic changes through setState.
 */
(function () {
  if (window.__motion) return;
  window.__motion = true;

  // Hold on to the copies loaded right now. x-dc runs every <helmet> script
  // twice — once as the page parses, again when it moves <helmet> into <head>
  // — so window.gsap is replaced by a second, separate instance a moment
  // later. Tweens and triggers made here live on the first one, and calling
  // the global ScrollTrigger afterwards would refresh a copy that owns none.
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var Split = window.SplitText;
  if (!gsap || !ST) {
    console.warn('motion.js: load vendor/gsap/gsap.min.js and ScrollTrigger.min.js first');
    return;
  }
  gsap.registerPlugin(ST);
  if (Split) gsap.registerPlugin(Split);
  // the instance that owns every motion.js tween, for debugging from the console
  window.__motion = { gsap: gsap, ScrollTrigger: ST };

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'power3.out';

  // what each preset animates *from*; it animates to whatever the page set
  var FROM = {
    'fade':       { opacity: 0 },
    'fade-up':    { opacity: 0, y: 28 },
    'fade-down':  { opacity: 0, y: -28 },
    'from-left':  { opacity: 0, x: -40 },
    'from-right': { opacity: 0, x: 40 },
    'scale-in':   { opacity: 0, scale: 0.94 },
    'blur-in':    { opacity: 0, y: 12, filter: 'blur(10px)' },
    'clip-up':    { clipPath: 'inset(100% 0% 0% 0%)' }
  };
  var TO = { 'clip-up': { clipPath: 'inset(0% 0% 0% 0%)' } };
  var DURATION = { 'clip-up': 1.1, 'blur-in': 1.0 };

  var KEEP = ['opacity', 'transform', 'translate', 'rotate', 'scale', 'filter', 'clip-path', 'visibility', 'will-change'];

  function num(el, name, fallback) {
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? fallback : v;
  }

  // snapshot / restore the inline declarations GSAP is about to overwrite
  function snapshot(els) {
    return els.map(function (el) {
      var s = {};
      KEEP.forEach(function (p) { s[p] = el.style.getPropertyValue(p); });
      return s;
    });
  }
  function restore(els, snaps) {
    els.forEach(function (el, i) {
      KEEP.forEach(function (p) {
        if (snaps[i][p]) el.style.setProperty(p, snaps[i][p]);
        else el.style.removeProperty(p);
      });
    });
  }

  function trigger(el, extra) {
    var st = {
      trigger: el,
      start: el.getAttribute('data-gsap-start') || function () {
        // "top 88%", capped just inside the scrollable range: something at
        // the very bottom of the page would otherwise need a scroll position
        // that doesn't exist, and would stay hidden for good. Not clamp():
        // that also lifts the start of anything already in view to exactly
        // 0, which at scrollY 0 doesn't count as entered — so the whole
        // first screen sat hidden until the visitor scrolled.
        var at = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.88;
        return Math.min(at, ST.maxScroll(window) - 1);
      },
      once: true
    };
    for (var k in extra) st[k] = extra[k];
    return st;
  }

  function basic(el, name) {
    var stagger = el.hasAttribute('data-gsap-stagger');
    var targets = stagger ? Array.prototype.slice.call(el.children) : [el];
    if (!targets.length) return;
    var snaps = snapshot(targets);
    var preset = FROM[name];
    // Every value is relative to where the element already rests. The export
    // sometimes offsets things inline (Behinto's outer hero phones sat on
    // translateY(14px)); animating y to an absolute 0 dropped that offset for
    // the whole reveal, and restore() then snapped it back at the end. So
    // read each target's resting opacity / x / y / scale first and move
    // relative to it. The snapshot still puts the exact inline style back.
    var rest = targets.map(function (t) {
      return {
        opacity: getComputedStyle(t).opacity,
        x: gsap.getProperty(t, 'x'),
        y: gsap.getProperty(t, 'y'),
        scale: gsap.getProperty(t, 'scale')
      };
    });
    function at(key, fn) { return function (i) { return fn(rest[i][key]); }; }
    var from = {}, to = Object.assign({}, TO[name]);
    if ('opacity' in preset) {
      from.opacity = 0;
      to.opacity = at('opacity', function (v) { return v; });
    }
    ['x', 'y'].forEach(function (k) {
      if (!(k in preset)) return;
      from[k] = at(k, function (v) { return v + preset[k]; });
      to[k] = at(k, function (v) { return v; });
    });
    if ('scale' in preset) {
      from.scale = at('scale', function (v) { return v * preset.scale; });
      to.scale = at('scale', function (v) { return v; });
    }
    if ('filter' in preset) { from.filter = preset.filter; to.filter = 'blur(0px)'; }
    if ('clipPath' in preset) from.clipPath = preset.clipPath;
    gsap.fromTo(targets, from, Object.assign(to, {
      duration: num(el, 'data-gsap-duration', (DURATION[name] || 0.8) * 1000) / 1000,
      delay: num(el, 'data-gsap-delay', 0) / 1000,
      stagger: stagger ? num(el, 'data-gsap-stagger', 80) / 1000 : 0,
      ease: name === 'clip-up' ? 'power4.inOut' : EASE,
      scrollTrigger: trigger(el),
      onComplete: function () { restore(targets, snaps); }
    }));
  }

  function split(el, name) {
    if (!Split) {
      console.warn('motion.js: ' + name + ' needs vendor/gsap/SplitText.min.js');
      return;
    }
    var snaps = snapshot([el]);
    // hidden until it plays; the split happens at play time so it measures
    // lines in the real font at the real width
    gsap.set(el, { visibility: 'hidden' });
    ST.create(trigger(el, {
      onEnter: function () {
        document.fonts.ready.then(function () {
          var type = name === 'split-lines' ? 'lines' : name === 'split-words' ? 'words' : 'words,chars';
          var s = Split.create(el, {
            type: type,
            mask: name === 'split-lines' ? 'lines' : undefined
          });
          var parts = name === 'split-lines' ? s.lines : name === 'split-words' ? s.words : s.chars;
          gsap.set(el, { visibility: 'visible' });
          gsap.from(parts, {
            yPercent: name === 'split-lines' ? 100 : 40,
            opacity: name === 'split-lines' ? 1 : 0,
            duration: num(el, 'data-gsap-duration', name === 'split-chars' ? 600 : 900) / 1000,
            delay: num(el, 'data-gsap-delay', 0) / 1000,
            stagger: num(el, 'data-gsap-stagger', name === 'split-chars' ? 18 : name === 'split-words' ? 45 : 110) / 1000,
            ease: EASE,
            onComplete: function () { s.revert(); restore([el], snaps); }
          });
        });
      }
    }));
  }

  function count(el) {
    var node = el.firstChild;
    // write into React's own text node rather than textContent, which would
    // swap it for a new one React no longer knows about
    if (el.childNodes.length !== 1 || node.nodeType !== 3) {
      console.warn('motion.js: count needs an element holding plain text only', el);
      return;
    }
    var text = node.nodeValue;
    var m = text.match(/-?[\d,]*\.?\d+/);
    if (!m) return;
    var raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
    var decimals = (raw.split('.')[1] || '').length;
    var commas = raw.indexOf(',') !== -1;
    function render(v) {
      var s = v.toFixed(decimals);
      if (commas) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      node.nodeValue = text.slice(0, m.index) + s + text.slice(m.index + raw.length);
    }
    var o = { v: 0 };
    render(0);
    gsap.to(o, {
      v: target,
      duration: num(el, 'data-gsap-duration', 1400) / 1000,
      delay: num(el, 'data-gsap-delay', 0) / 1000,
      ease: 'power2.out',
      scrollTrigger: trigger(el),
      onUpdate: function () { render(o.v); },
      onComplete: function () { node.nodeValue = text; }
    });
  }

  var pending = false;
  function init(el) {
    // the raw <x-dc> template is parsed into the DOM too, under
    // display:none, until React replaces it — only the rendered copy counts
    if (el.__gsap || el.closest('x-dc')) return;
    el.__gsap = true;
    // reduced motion: everything is simply already in place
    if (reduced) return;
    var name = el.getAttribute('data-gsap');
    if (FROM[name]) basic(el, name);
    else if (name.indexOf('split-') === 0) split(el, name);
    else if (name === 'count') count(el);
    else { console.warn('motion.js: unknown preset "' + name + '"', el); return; }
    // positions were measured mid-render; settle them once the page is still
    if (!pending) {
      pending = true;
      setTimeout(function () { pending = false; ST.refresh(); }, 120);
    }
  }

  function scan() {
    var list = document.querySelectorAll('[data-gsap]');
    for (var i = 0; i < list.length; i++) init(list[i]);
  }

  function start() {
    scan();
    // pages render through React from unpkg, so targets land well after
    // DOMContentLoaded — watch for them instead of racing it
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    document.fonts.ready.then(function () { ST.refresh(); });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
