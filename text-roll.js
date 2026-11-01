/**
 * Text roll — letters that roll out of their slot while a fresh copy rolls in
 * behind them, staggered left to right, with a little overshoot and tilt.
 *
 * A vanilla port of slot-text (textmotion.dev): its timings, its overshoot
 * easing and its "chromatic" mode, where the incoming letters arrive tinted
 * in a hue sweep and fade to the text's own colour. The sweep here is the
 * prism grid's blue → violet → pink rather than slot-text's full rainbow.
 *
 * Where it runs, all automatic (no markup needed):
 *
 *   - Buttons: any <a>/<button> that has a fill or a border, real padding,
 *     and nothing but short inline text inside. It rolls on mouse hover and
 *     on keyboard focus. Cards (block children) and the halo select's trigger
 *     are left out. `data-roll` forces an element in, `data-roll="off"` out.
 *   - Highlighted words (`.ph`): roll as the pointer highlight draws its box
 *     (pointer-highlight.js fires `ph:draw`), and again on hover.
 *   - A button whose label changes (Contact's "Send message →" ↔ "Sending…")
 *     rolls from the old label to the new one.
 *
 * React owns every text node on these pages, so they are never split or
 * moved. For the length of one roll, an aria-hidden layer is appended to the
 * element with one clipped cell per glyph, each placed exactly over the glyph
 * it stands in for (measured with a Range, so kerning, mixed font sizes and a
 * wrapped label all line up). The real text goes `-webkit-text-fill-color:
 * transparent` underneath, which hides glyphs only: borders, SVG icons and the
 * highlight's box keep their colour. When the roll ends the layer is removed
 * and the element is exactly as React left it.
 *
 * Text in Persian or Arabic script is skipped: its letters join, and rolling
 * them one by one would break the joins.
 */
(function () {
  if (window.__textRoll) return;
  window.__textRoll = true;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;   // nothing rolls; the text is simply there

  // slot-text's defaults
  var DURATION = 300;            // ms per letter
  var STAGGER = 45;              // ms between letters
  var EXIT_OFFSET = 50;          // the new letter starts this long after the old one leaves
  var BOUNCE = 0.6;              // how much timing and tilt vary per letter
  var TILT = 5;                  // max degrees of tilt at full bounce
  var COLOR_FADE = 280;          // ms for the tint to settle to the real colour
  var EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  // the prism grid's sweep: azure → violet → pink
  var HUE_FROM = 212, HUE_SPREAD = 118;
  var MAX_SPREAD = 600;          // ms from the first letter's start to the last's
  var MAX_CHARS = 48;
  var PHRASING = /^(SPAN|B|STRONG|EM|I|SMALL|CODE|KBD|MARK|BDI|SUB|SUP|WBR|BR|SC-IF)$/;
  var RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

  var css =
    // hides the real glyphs only; fills, borders and SVG keep their colour
    '.tr-on{-webkit-text-fill-color:transparent!important;}' +
    '.tr-pos{position:relative;}' +
    '.tr-layer{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;' +
      'pointer-events:none;user-select:none;-webkit-user-select:none;}' +
    // clipped top and bottom only, so an italic or a tilted letter can lean out sideways
    '.tr-slot{position:absolute;overflow-x:visible;overflow-y:clip;}' +
    '.tr-face{position:absolute;left:0;top:0;white-space:pre;letter-spacing:0;' +
      'text-transform:none;-webkit-text-fill-color:currentColor;' +
      'transform-origin:50% 50%;will-change:transform;}';

  function injectCss() {
    if (document.getElementById('tr-css')) return;
    var s = document.createElement('style');
    s.id = 'tr-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------------------------------------------------------------- text */

  var seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function graphemes(s) {
    if (seg) return Array.from(seg.segment(s), function (x) { return { s: x.segment, i: x.index }; });
    var out = [], i = 0;
    Array.from(s).forEach(function (c) { out.push({ s: c, i: i }); i += c.length; });
    return out;
  }

  /** The element's own text nodes, minus our layer and the highlight's box. */
  function textNodes(host) {
    var out = [];
    var w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (p && p.closest('.tr-layer, .ph-fx')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function labelText(host) {
    return textNodes(host).map(function (n) { return n.nodeValue; }).join('');
  }

  // slot-text's per-letter pseudo-random variation: stable for a given index
  function vary(i, channel) {
    var x = Math.sin(i * 12.9898 + channel * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }

  function parseRgb(c) {
    var m = c.match(/[\d.]+/g);
    return m ? m.map(Number) : [0, 0, 0, 1];
  }
  function isLight(c) {
    var v = parseRgb(c);
    return (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 > 0.55;
  }
  /** Tint for letter i of n: deep on dark text, pastel on light text, so it reads on either. */
  function tint(i, n, light) {
    var t = n <= 1 ? 0 : i / (n - 1);
    var h = (HUE_FROM + t * HUE_SPREAD) % 360;
    return light ? 'hsl(' + h + ' 95% 80%)' : 'hsl(' + h + ' 82% 52%)';
  }

  /* ---------------------------------------------------------------- roll */

  function abort(host) {
    var r = host.__tr;
    if (!r) return;
    host.__tr = null;
    r.anims.forEach(function (a) { a.cancel(); });
    clearTimeout(r.timer);
    if (r.layer.parentNode) r.layer.parentNode.removeChild(r.layer);
    host.classList.remove('tr-on');
    if (r.pos) host.classList.remove('tr-pos');
  }

  /**
   * Roll the host's current text. With `from`, each letter rolls out of the
   * old label's letter at the same position (skipping the ones that match);
   * without it, every letter rolls out and back in as itself.
   */
  function roll(host, from) {
    if (host.__tr) {
      if (from == null) return;   // a hover mid-roll: let it finish, no stacking
      abort(host);
    }
    var hr = host.getBoundingClientRect();
    if (!hr.width || !hr.height) return;

    var cs = getComputedStyle(host);
    var pos = cs.position === 'static';
    var ox = hr.left + host.clientLeft, oy = hr.top + host.clientTop;
    // letters are matched by position in the *visible* text: React's markup
    // whitespace around a label differs between its states ("Send message →"
    // and "Sending…" sit behind different amounts of it)
    var old = from != null ? graphemes(from.replace(/\s+/g, ' ').trim()).map(function (g) { return g.s; }) : null;

    // measure every visible glyph before anything changes
    var cells = [], gi = 0, space = true, range = document.createRange();
    textNodes(host).forEach(function (node) {
      var pcs = getComputedStyle(node.parentElement);
      graphemes(node.nodeValue).forEach(function (g) {
        if (!g.s.trim()) {
          if (!space) { gi++; space = true; }   // a run of whitespace counts once
          return;
        }
        space = false;
        var idx = gi++;
        range.setStart(node, g.i);
        range.setEnd(node, g.i + g.s.length);
        var r = range.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var ch = g.s;
        if (pcs.textTransform === 'uppercase') ch = ch.toUpperCase();
        else if (pcs.textTransform === 'lowercase') ch = ch.toLowerCase();
        var prev = old ? old[idx] : ch;
        cells.push({
          ch: ch, prev: prev && prev.trim() ? prev : '',
          x: r.left - ox, y: r.top - oy, w: r.width, h: r.height,
          // longhands: Chrome's `font` shorthand reads back empty when it can't express them all
          font: {
            fontFamily: pcs.fontFamily, fontSize: pcs.fontSize, fontWeight: pcs.fontWeight,
            fontStyle: pcs.fontStyle, fontStretch: pcs.fontStretch, fontVariant: pcs.fontVariant
          },
          color: pcs.color,
          features: pcs.fontFeatureSettings, kerning: pcs.fontKerning
        });
      });
    });
    if (!cells.length) return;

    var layer = document.createElement('span');
    layer.className = 'tr-layer';
    layer.setAttribute('aria-hidden', 'true');
    var anims = [], end = 0, n = cells.length, k = 0;
    // a long label (the email address) would take 2s+ at 45ms a letter:
    // squeeze the stagger so the whole wave starts within MAX_SPREAD
    var stagger = Math.min(STAGGER, MAX_SPREAD / Math.max(1, n - 1));

    function face(ch, c) {
      var f = document.createElement('span');
      f.className = 'tr-face';
      f.textContent = ch;
      for (var p in c.font) f.style[p] = c.font[p];
      f.style.lineHeight = c.h + 'px';   // content area = cell, so the baseline lands where the real one is
      f.style.color = c.color;
      f.style.fontFeatureSettings = c.features;
      f.style.fontKerning = c.kerning;
      return f;
    }

    cells.forEach(function (c) {
      var slot = document.createElement('span');
      slot.className = 'tr-slot';
      slot.style.cssText = 'left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px;';
      layer.appendChild(slot);

      var inFace = face(c.ch, c);
      if (old && c.prev === c.ch) { slot.appendChild(inFace); return; }   // unchanged: stays put

      var i = k++;
      var dur = Math.round(DURATION * (1 + BOUNCE * 0.45 * vary(i, 1)));
      var delay = Math.max(0, Math.round(i * stagger *(1 + BOUNCE * 0.25 * vary(i, 2))));
      var tilt = +(BOUNCE * TILT * vary(i, 3)).toFixed(2);
      var H = c.h;

      if (c.prev) {
        var outFace = face(c.prev, c);
        slot.appendChild(outFace);
        anims.push(outFace.animate([
          { transform: 'translateY(0) rotate(0deg)' },
          { transform: 'translateY(' + (-H) + 'px) rotate(' + (-tilt) + 'deg)' }
        ], { duration: dur, delay: delay, easing: EASE, fill: 'both' }));
      }
      slot.appendChild(inFace);
      var inDelay = delay + (c.prev ? EXIT_OFFSET : 0);
      anims.push(inFace.animate([
        { transform: 'translateY(' + H + 'px) rotate(' + tilt + 'deg)' },
        { transform: 'translateY(0) rotate(0deg)' }
      ], { duration: dur, delay: inDelay, easing: EASE, fill: 'both' }));
      // fill: both holds the tint through the delay and the roll, then fades it out
      var hue = tint(i, n, isLight(c.color));
      anims.push(inFace.animate([{ color: hue }, { color: c.color }],
        { duration: COLOR_FADE, delay: inDelay + dur, easing: 'linear', fill: 'both' }));
      end = Math.max(end, inDelay + dur + COLOR_FADE);
    });

    if (!k) return;   // nothing changed between the labels
    if (pos) host.classList.add('tr-pos');
    host.appendChild(layer);
    host.classList.add('tr-on');

    var state = { layer: layer, anims: anims, pos: pos, timer: 0 };
    host.__tr = state;
    state.timer = setTimeout(function () {
      if (host.__tr === state) abort(host);
    }, end + 40);
  }

  /* --------------------------------------------------------------- hosts */

  var hosts = new WeakMap();   // element → 'button' | 'word'
  var checked = new WeakSet();

  function hasPaint(cs) {
    var bg = parseRgb(cs.backgroundColor);
    if (cs.backgroundColor !== 'transparent' && (bg.length < 4 || bg[3] > 0)) return true;
    if (cs.backgroundImage !== 'none') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(function (s) {
      return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none';
    });
  }

  function isButton(el) {
    var flag = el.getAttribute('data-roll');
    if (flag === 'off') return false;
    if (el.classList.contains('hs-trigger')) return false;   // halo select: owns its own label
    var text = labelText(el).trim();
    if (!text || text.length > MAX_CHARS || RTL.test(text)) return false;
    if (flag != null) return true;
    var cs = getComputedStyle(el);
    if (!hasPaint(cs) || parseFloat(cs.paddingLeft) < 8) return false;
    // a row laid out in columns (the home project index) is a list item, not a button
    if (/grid|table/.test(cs.display)) return false;
    // a card holds blocks (title over description); a button holds phrasing
    // tags only. Checked by tag, not display: inside an inline-flex button
    // the arrow's <span> is a flex item, which the browser blockifies.
    var kids = el.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      if (!PHRASING.test(kids[i].tagName.toUpperCase())) return false;
    }
    return true;
  }

  function watchLabel(el) {
    el.__trText = labelText(el);
    new MutationObserver(function () {
      var now = labelText(el);
      if (now === el.__trText) return;   // our own layer coming and going
      var prev = el.__trText;
      el.__trText = now;
      if (el.isConnected) roll(el, prev);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  function scan() {
    var list = document.querySelectorAll('a, button, .ph');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (checked.has(el)) continue;
      // the raw x-dc template: hidden, and anything put there joins the React tree
      if (el.closest('x-dc')) continue;
      checked.add(el);
      if (el.classList.contains('ph')) {
        if (!RTL.test(labelText(el))) hosts.set(el, 'word');
      } else if (isButton(el)) {
        hosts.set(el, 'button');
        watchLabel(el);
      }
    }
  }

  function hostOf(node) {
    for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el; el = el.parentElement) {
      if (hosts.has(el)) return el;
    }
    return null;
  }

  var queued = false;
  function queueScan() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; scan(); });
    setTimeout(function () { if (queued) { queued = false; scan(); } }, 200);   // rAF is paused in a hidden tab
  }

  function start() {
    injectCss();
    scan();
    new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });

    // hover: mouse and pen only. A tap navigates anyway, and :hover sticks on touch.
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var h = hostOf(e.target);
      if (!h || (e.relatedTarget && h.contains(e.relatedTarget))) return;
      roll(h);
    });
    // keyboard focus counts as hover; a click's focus doesn't
    document.addEventListener('focusin', function (e) {
      var h = hostOf(e.target);
      if (h && h === e.target && h.matches(':focus-visible')) roll(h);
    });
    // the highlight's box starts drawing: the word rolls inside it
    document.addEventListener('ph:draw', function (e) {
      var w = e.target.parentElement;
      if (!w || !hosts.has(w)) { scan(); w = e.target.parentElement; }
      if (w && hosts.has(w)) setTimeout(function () { roll(w); }, 140);
    });
    // a resize leaves every measured cell in the wrong place: snap to the real text
    window.addEventListener('resize', function () {
      document.querySelectorAll('.tr-on').forEach(abort);
    });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
