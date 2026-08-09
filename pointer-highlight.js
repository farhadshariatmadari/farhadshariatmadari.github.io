/**
 * Pointer highlight — a hand-drawn-looking box that draws itself around one
 * important word in a heading, with a cursor arrow trailing off the corner.
 *
 * A vanilla port of Aceternity's <PointerHighlight>: the rectangle grows from
 * zero to the word's box while the pointer slides to the bottom-right corner,
 * both on the same 900ms ease-in-out, fired once when the word scrolls into
 * view.
 *
 * Usage — wrap the word and leave an empty effect element inside the wrapper:
 *
 *   <h1>… people can <span class="ph-keep"><span class="ph">actually use<span
 *       class="ph-fx" data-pointer-highlight data-ph-delay="900"></span></span>.</span></h1>
 *
 * `.ph` is inline-block so the box has a predictable, line-height-driven
 * height — which also opens a line-break opportunity on both sides of it, and
 * a trailing "." will happily orphan onto the next line. `.ph-keep` is the
 * no-break wrapper that holds the word and its punctuation together; it is
 * only needed where punctuation follows, not where the next character is a
 * space.
 *
 * `data-ph-delay` (ms) holds the draw back so it lands after a heading's own
 * entrance animation instead of racing it.
 *
 * Standalone rather than page logic, for the same reason prism-grid.js is: the
 * headings sit on pages whose x-dc Component classes already own a GSAP card
 * stack, a form with setState, and an image fallback. The box and pointer are
 * injected into `.ph-fx`, which React renders empty and therefore never
 * reconciles — the wrapper and the effect element stay in markup so React owns
 * every node it needs to touch.
 *
 * Deliberately sparing: five words across four pages. The effect stops reading
 * as emphasis the moment it appears twice in one eyeful. See CLAUDE.md for the
 * list, and for why Contact.html is not on it.
 */
(function () {
  if (window.__pointerHighlight) return;
  window.__pointerHighlight = true;

  var INK = '#14171c';        // box, same ink as the heading
  var SIGNAL = '#2f5cf0';     // pointer
  var PTR = 18;               // pointer size, px
  var DRAW = 900;             // ms for the box to draw itself
  var EASE = 'cubic-bezier(.42,0,.58,1)';   // framer-motion's easeInOut
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ARROW =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007' +
    'L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"/></svg>';

  var css =
    // nowrap keeps the word on one line, so the box is always a single rect
    '.ph{position:relative;display:inline-block;white-space:nowrap;}' +
    // ...and keeps trailing punctuation from orphaning past the inline-block
    '.ph-keep{white-space:nowrap;}' +
    // horizontal breathing room is kept small: a word at the start of a line
    // pushes the box past the page's left alignment edge, and that reads as a
    // misalignment long before it reads as padding
    '.ph-fx{position:absolute;inset:-.06em -.055em;z-index:0;display:block;pointer-events:none;}' +
    // ...and when the word does start a line there is no amount of padding that
    // hides it, so `.ph-flush` drops the left inset entirely: the box's left
    // edge sits on the text edge, flush with the h1, subhead and buttons below.
    // The right side keeps its breathing room — only the aligned edge is snapped.
    '.ph-flush>.ph-fx{left:0;}' +
    '.ph-box{position:absolute;left:0;top:0;width:0;height:0;border:1px solid ' + INK + ';' +
      'transition:width ' + DRAW + 'ms ' + EASE + ',height ' + DRAW + 'ms ' + EASE + ';}' +
    '.ph-ptr{position:absolute;left:0;top:0;width:' + PTR + 'px;height:' + PTR + 'px;opacity:0;' +
      'color:' + SIGNAL + ';transform:translate(0,0) rotate(-90deg);' +
      'transition:transform ' + DRAW + 'ms ' + EASE + ',opacity 140ms ease;}' +
    '.ph-ptr svg{display:block;width:100%;height:100%;fill:currentColor;}' +
    '@media (prefers-reduced-motion: reduce){.ph-box,.ph-ptr{transition:none;}}';

  function injectCss() {
    if (document.getElementById('ph-css')) return;
    var s = document.createElement('style');
    s.id = 'ph-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /** Size the box to the word and park the pointer past its bottom-right corner. */
  function draw(fx) {
    var w = fx.offsetWidth, h = fx.offsetHeight;
    if (!w || !h) return false;
    fx.__box.style.width = w + 'px';
    fx.__box.style.height = h + 'px';
    fx.__ptr.style.opacity = '1';
    fx.__ptr.style.transform = 'translate(' + (w + 3) + 'px,' + (h + 3) + 'px) rotate(-90deg)';
    return true;
  }

  function init(fx) {
    if (fx.__ph) return;
    fx.__ph = true;
    fx.setAttribute('aria-hidden', 'true');

    var box = document.createElement('span');
    box.className = 'ph-box';
    var ptr = document.createElement('span');
    ptr.className = 'ph-ptr';
    ptr.innerHTML = ARROW;
    fx.appendChild(box);
    fx.appendChild(ptr);
    fx.__box = box;
    fx.__ptr = ptr;

    var delay = parseInt(fx.getAttribute('data-ph-delay'), 10) || 0;
    var played = false;

    function start() {
      if (played) return;
      // web fonts land after first paint; measuring before Space Grotesk
      // arrives sizes the box to the fallback face
      var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
      fonts.then(function () {
        setTimeout(function () {
          if (played) return;
          played = draw(fx);
          if (!played) requestAnimationFrame(start);   // hero not laid out yet
        }, reduced ? 0 : delay);
      });
    }

    if (typeof IntersectionObserver === 'undefined') {
      start();
    } else {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { start(); io.disconnect(); }
        }
      }, { threshold: 0.6 });
      io.observe(fx);
    }

    // a reflow (resize, font swap, breakpoint) changes the word's box — snap
    // the drawn one to it rather than replaying the animation
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        if (!played) return;
        var t = box.style.transition, pt = ptr.style.transition;
        box.style.transition = ptr.style.transition = 'none';
        draw(fx);
        requestAnimationFrame(function () {
          box.style.transition = t;
          ptr.style.transition = pt;
        });
      }).observe(fx.parentElement || fx);
    }
  }

  function scan() {
    var list = document.querySelectorAll('[data-pointer-highlight]');
    for (var i = 0; i < list.length; i++) init(list[i]);
  }

  function start() {
    injectCss();
    scan();
    // pages render through React from unpkg, so headings land well after
    // DOMContentLoaded — watch for them instead of racing them
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
