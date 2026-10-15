/**
 * Halo fields — a gradient rim and frosted fill on the contact form's
 * controls, plus a composable select to replace the native dropdown.
 *
 * A vanilla port of cult-ui's <HaloInput> / <HaloTextarea> and <HaloSelect>
 * (cult-ui.com/docs/components/halo-input, …/halo-select), recoloured from
 * their Vercel rainbow to the prism grid's own colours. Blurred gradient bars
 * drift along the bottom of each field, clipped to its shell. They show
 * through the 1px gap around the field as a rim and through its translucent
 * fill as a haze.
 *
 * Input and textarea — markup only, no script needed for the look:
 *
 *   <div class="halo">
 *     <span class="halo-glow" aria-hidden="true"><i></i><i></i></span>
 *     <input class="field" …>
 *   </div>
 *
 * Select — the native <select> stays, so React's onChange and the form's
 * FormData keep working untouched. Next to it goes an element React renders
 * empty, and the script builds the trigger and listbox inside it (same trick
 * as the prism grid). Once that exists, the native select is hidden by CSS.
 * If this file never runs, the native select is still there and still styled.
 *
 *   <div class="halo halo-sel">
 *     <span class="halo-glow" aria-hidden="true"><i></i><i></i><i></i></span>
 *     <select id="ct" class="field" …>…</select>
 *     <div data-halo-select></div>
 *   </div>
 *
 * A choice is written back with `select.value = …` and a bubbling `change`
 * event, which is what React listens to for a select. The <label for> still
 * points at the native select; it forwards focus to the trigger.
 *
 * Left out of the original: Base UI's align-item-with-trigger positioning
 * (the list drops below, or above when there's no room), the loading spinner
 * (nothing here loads), and its dark theme (the site has none).
 */
(function () {
  if (window.__haloField) return;
  window.__haloField = true;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  // cult-ui's three bars, re-hued: pink → violet → light blue → signal blue,
  // the warm one from the prism grid's pink and amber, and a cool blue one.
  var PRIMARY = 'linear-gradient(90deg,#e0397f,#7a5cf0,#4f8ff7,#2f5cf0)';
  var SECONDARY = 'linear-gradient(90deg,#e0397f,#e0912f,#e0397f)';
  var TERTIARY = 'linear-gradient(90deg,#2f5cf0,#4f8ff7,#7a5cf0)';
  var WASH_LOW = 'radial-gradient(90% 70% at 50% 100%,rgba(224,57,127,.28),rgba(122,92,240,.12) 48%,transparent 62%)';
  var WASH_HIGH = 'radial-gradient(70% 55% at 30% 0%,rgba(79,143,247,.22),rgba(47,92,240,.08) 45%,transparent 58%)';
  // the original's border, color-mix(var(--border) 72%, lavender), on the site's field grey
  var EDGE = 'color-mix(in oklch,#d7dbe1 72%,oklch(.88 .06 300))';
  var LIFT = '0 1px 2px rgba(0,0,0,.03),0 6px 18px rgba(0,0,0,.04)';
  var ACTIVE = 'inset 0 1px 0 rgba(255,255,255,.14),0 1px 2px rgba(0,0,0,.09),0 4px 14px rgba(0,0,0,.11)';
  var FROST = 'linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.7))';
  var BLUR = '-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5);';

  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  var css = [
    '.halo{position:relative;isolation:isolate;display:block;border-radius:12px;padding:1px;}',
    '.halo-sel{z-index:2;}',   // its list has to open over the fields below it
    '.halo-glow{position:absolute;inset:0;z-index:0;overflow:hidden;border-radius:11px;pointer-events:none;}',

    // the two soft washes: input and textarea only (the select is cult-ui's non-translucent default)
    '.halo-glow::before,.halo-glow::after{content:"";position:absolute;inset:0;}',
    '.halo-glow::before{background:' + WASH_LOW + ';filter:blur(40px);opacity:.5;}',
    '.halo-glow::after{background:' + WASH_HIGH + ';filter:blur(24px);opacity:.35;}',
    '.halo-sel>.halo-glow::before,.halo-sel>.halo-glow::after{content:none;}',

    // Each bar rides a full-width track, so translateX(%) is a share of the
    // field's width, the same as the original's animated `left`, but composited.
    '.halo-glow i{position:absolute;left:0;right:0;bottom:-16px;height:56px;opacity:.72;will-change:transform;' +
      'animation:hf-a 6s ease-in-out var(--hf-d,0s) infinite;transition:opacity .25s ease-out;}',
    '.halo-glow i::before{content:"";position:absolute;top:0;bottom:0;left:0;width:176px;background:' + PRIMARY + ';filter:blur(24px);}',
    '.halo-glow i:nth-child(2){bottom:-12px;height:44px;animation-name:hf-b;animation-duration:5s;}',
    '.halo-glow i:nth-child(2)::before{width:144px;background:' + SECONDARY + ';filter:blur(16px);}',
    '.halo-glow i:nth-child(3){bottom:-8px;height:40px;animation-name:hf-c;animation-duration:4s;}',
    '.halo-glow i:nth-child(3)::before{width:96px;background:' + TERTIARY + ';filter:blur(16px);}',
    '.halo-sel .halo-glow i{opacity:.58;}',
    '.halo-sel .halo-glow i:first-child{height:64px;}',
    '.halo-sel .halo-glow i:first-child::before{width:192px;}',
    '.halo-sel .halo-glow i:nth-child(2){height:48px;}',
    '.halo-sel .halo-glow i:nth-child(2)::before{width:128px;}',
    '.halo-sel:focus-within .halo-glow i,.halo-sel:has([aria-expanded="true"]) .halo-glow i{opacity:.82;}',
    '@keyframes hf-a{0%,100%{transform:translateX(-5%)}50%{transform:translateX(75%)}}',
    '@keyframes hf-b{0%,100%{transform:translateX(65%)}50%{transform:translateX(10%)}}',
    '@keyframes hf-c{0%,100%{transform:translateX(25%)}50%{transform:translateX(55%)}}',

    // the frosted surface: the field itself, inset 1px inside the shell
    '.halo>.field{position:relative;z-index:1;display:block;border:1px solid ' + EDGE + ';border-radius:11px;' +
      'background:' + FROST + ';' + BLUR +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.55),' + LIFT + ';transition:border-color .2s ease-out,box-shadow .2s ease-out;}',
    '.halo>.field:focus{background:' + FROST + ';border-color:rgba(47,92,240,.8);' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.55),' + LIFT + ',0 0 0 2px rgba(47,92,240,.3);}',
    // :user-invalid only after the visitor has touched the field or tried to send
    '.halo>.field:user-invalid{border-color:rgba(180,35,24,.9);}',
    '.halo>.field:user-invalid:focus{border-color:#b42318;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),' + LIFT + ',0 0 0 2px rgba(180,35,24,.25);}',

    // the select: native control hidden once the trigger exists
    '.halo-sel:has(.hs-trigger)>select{position:absolute;inset:1px;width:auto;opacity:0;pointer-events:none;z-index:-1;}',
    '[data-halo-select]{position:relative;z-index:1;}',
    '.hs-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;margin:0;padding:7px 7px 7px 15px;' +
      'font:inherit;font-size:15px;color:#14171c;text-align:left;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;' +
      'border:1px solid ' + EDGE + ';border-radius:11px;' +
      'background:linear-gradient(color-mix(in oklch,#fff 95%,oklch(.97 .02 315)),color-mix(in oklch,#fff 93%,oklch(.96 .025 280)));' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.55),' + LIFT + ';transition:border-color .2s ease-out,box-shadow .2s ease-out;}',
    '@media (hover:hover){' +
      '.hs-trigger:hover{border-color:rgba(47,92,240,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 1px 3px rgba(0,0,0,.05),0 8px 22px rgba(0,0,0,.06);}' +
      '.hs-trigger:hover .hs-thumb{box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 1px 2px rgba(0,0,0,.07),0 2px 10px rgba(0,0,0,.05),0 0 0 2px rgba(47,92,240,.2);}' +
    '}',
    '.hs-trigger:focus,.hs-trigger[aria-expanded="true"]{border-color:rgba(47,92,240,.7);box-shadow:' + ACTIVE + ';}',
    '.hs-trigger:focus-visible{border-color:rgba(47,92,240,.8);box-shadow:' + ACTIVE + ',0 0 0 2px rgba(47,92,240,.3);}',
    '.hs-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.6;}',
    '.hs-ch{display:inline-block;white-space:pre;animation:hs-ch .16s ease-out both;}',

    // the raised thumb, with the chevron and the selection check crossfading in it
    '.hs-thumb{position:relative;flex:none;width:32px;height:32px;border-radius:6px;background:#fff;color:#5a6270;' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 1px 2px rgba(0,0,0,.07),0 2px 10px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.08);transition:box-shadow .2s ease-out;}',
    '.hs-chev,.hs-check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'transition:opacity .2s ease-out,transform .2s ease-out,filter .2s ease-out;}',
    '.hs-check{color:#22a06b;opacity:0;transform:scale(.25);filter:blur(4px);}',
    '.hs-trigger[data-mode="check"] .hs-chev{opacity:0;transform:scale(.25);filter:blur(4px);}',
    '.hs-trigger[data-mode="check"] .hs-check{opacity:1;transform:none;filter:none;}',
    '.hs-chev svg{transition:transform .2s ease-out;}',
    '.hs-trigger[aria-expanded="true"] .hs-chev svg{transform:rotate(180deg);}',

    // the listbox
    '.hs-list{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;margin:0;padding:4px;list-style:none;' +
      'max-height:288px;overflow-y:auto;outline:none;border:1px solid ' + EDGE + ';border-radius:12px;background:rgba(255,255,255,.95);' + BLUR +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 1px 2px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.08);' +
      '--hs-from:-8px;transform-origin:50% 0;opacity:0;visibility:hidden;transform:scale(.95);' +
      'transition:opacity .15s ease-out,transform .15s ease-out,visibility 0s linear .15s;}',
    '.hs-list[data-side="top"]{top:auto;bottom:calc(100% + 6px);--hs-from:8px;transform-origin:50% 100%;}',
    '.hs-list.is-open{opacity:1;visibility:visible;transform:none;transition-delay:0s;animation:hs-pop .15s ease-out;}',
    '.hs-opt{display:flex;align-items:center;min-height:44px;padding:10px;border-radius:8px;color:#14171c;font-size:15px;' +
      'cursor:pointer;user-select:none;-webkit-user-select:none;transition:background-color .15s ease-out;}',
    '.hs-opt.is-active{background:#f1f3f7;}',
    '.hs-opt[aria-disabled="true"]{opacity:.5;pointer-events:none;}',
    '.hs-opt-in{display:flex;align-items:center;gap:8px;width:100%;min-width:0;}',
    '.hs-list.is-open .hs-opt-in{animation:hs-in .22s cubic-bezier(.2,0,0,1) both;animation-delay:calc(var(--i,0) * 55ms);}',
    '.hs-opt-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.hs-opt svg{flex:none;opacity:0;}',
    '.hs-opt[aria-selected="true"] svg{opacity:.9;}',
    '@keyframes hs-pop{from{opacity:0;transform:translateY(var(--hs-from)) scale(.95)}}',
    '@keyframes hs-in{from{opacity:0;filter:blur(4px);transform:translateY(4px)}}',
    '@keyframes hs-ch{from{opacity:0}}',

    // reduced motion: the bars hold still, the washes dim as in the original,
    // and nothing pops, staggers, rotates or flashes
    '@media (prefers-reduced-motion:reduce){' +
      '.halo-glow i{animation:none;}' +
      '.halo-glow::before{opacity:.38;}.halo-glow::after{opacity:.27;}' +
      '.hs-list,.hs-list.is-open{transition:none;animation:none;}' +
      '.hs-list.is-open .hs-opt-in,.hs-ch{animation:none;}' +
      '.hs-trigger[aria-expanded="true"] .hs-chev svg{transform:none;}' +
    '}'
  ].join('\n');

  function injectCss() {
    var s = document.createElement('style');
    s.id = 'halo-field-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  var uid = 0;

  function mount(host) {
    var select = host.parentNode && host.parentNode.querySelector('select');
    if (!select) return;
    host.__halo = true;

    var id = 'hs' + (++uid);
    var label = select.labels && select.labels[0];
    var opts = [];
    var isOpen = false, active = -1;
    var buf = '', bufTimer, flashTimer, staggerTimer;

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'hs-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-list');
    if (label && label.id) trigger.setAttribute('aria-labelledby', label.id);
    trigger.innerHTML = '<span class="hs-value"></span>' +
      '<span class="hs-thumb" aria-hidden="true"><span class="hs-chev">' + CHEVRON + '</span>' +
      '<span class="hs-check">' + CHECK + '</span></span>';
    var value = trigger.firstChild;

    var list = document.createElement('ul');
    list.className = 'hs-list';
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    if (label && label.id) list.setAttribute('aria-labelledby', label.id);

    host.appendChild(trigger);
    host.appendChild(list);

    // The native select stays for the form and React, out of the tab order
    // and the accessibility tree. A click on its <label> lands here.
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.addEventListener('focus', function () { trigger.focus({ preventScroll: true }); });

    function current() {
      var o = select.options[select.selectedIndex];
      return o ? o.text : '';
    }

    function sync() {
      clearTimeout(staggerTimer);
      value.textContent = current();
      trigger.disabled = select.disabled;
    }

    function build() {
      opts = [];
      list.textContent = '';
      for (var i = 0; i < select.options.length; i++) {
        var o = select.options[i];
        var li = document.createElement('li');
        li.className = 'hs-opt';
        li.id = id + '-o' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === select.selectedIndex));
        if (o.disabled) li.setAttribute('aria-disabled', 'true');
        li.style.setProperty('--i', String(Math.min(i, 9)));
        li.innerHTML = '<span class="hs-opt-in"><span class="hs-opt-t"></span>' + CHECK + '</span>';
        li.querySelector('.hs-opt-t').textContent = o.text;
        li.__i = i;
        list.appendChild(li);
        opts.push({ el: li, text: o.text, disabled: o.disabled });
      }
    }

    function setActive(i) {
      if (i < 0 || i >= opts.length) return;
      if (opts[active]) opts[active].el.classList.remove('is-active');
      active = i;
      var el = opts[i].el;
      el.classList.add('is-active');
      trigger.setAttribute('aria-activedescendant', el.id);
      // keep it in view by hand: scrollIntoView could move the page under Lenis
      if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
      }
    }

    function step(from, dir) {
      for (var i = from + dir; i >= 0 && i < opts.length; i += dir) if (!opts[i].disabled) return i;
      return from;
    }

    function open() {
      if (isOpen || trigger.disabled) return;
      build();
      sync();
      // drop below unless there's no room there and more above
      list.removeAttribute('data-side');
      var r = host.getBoundingClientRect();
      var need = list.offsetHeight + 12;
      var below = window.innerHeight - r.bottom;
      if (below < need && r.top > below) list.setAttribute('data-side', 'top');
      isOpen = true;
      active = -1;
      setActive(select.selectedIndex >= 0 ? select.selectedIndex : step(-1, 1));
      list.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside, true);
      // Safari doesn't focus a button on click, and the keys need it
      trigger.focus({ preventScroll: true });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      list.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', outside, true);
    }

    function outside(e) {
      if (!host.contains(e.target)) close();
    }

    function choose(i) {
      if (!opts[i] || opts[i].disabled) return;
      var changed = i !== select.selectedIndex;
      close();
      if (!changed) return;
      select.value = select.options[i].value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      // read back rather than assume: a controlled select may have been put back
      sync();
      if (REDUCED.matches) return;
      stagger(value.textContent);
      clearTimeout(flashTimer);
      trigger.setAttribute('data-mode', 'check');
      flashTimer = setTimeout(function () { trigger.removeAttribute('data-mode'); }, 560);
    }

    // The new label fades in a glyph at a time, then goes back to plain text.
    function stagger(text) {
      value.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var s = document.createElement('span');
        s.className = 'hs-ch';
        s.textContent = text[i];
        s.style.animationDelay = i * 18 + 'ms';
        value.appendChild(s);
      }
      staggerTimer = setTimeout(function () { value.textContent = text; }, (text.length - 1) * 18 + 160 + 80);
    }

    function typeahead(ch) {
      clearTimeout(bufTimer);
      bufTimer = setTimeout(function () { buf = ''; }, 500);
      buf += ch.toLowerCase();
      var start = buf.length === 1 ? active + 1 : active;
      for (var k = 0; k < opts.length; k++) {
        var i = (start + k) % opts.length;
        if (!opts[i].disabled && opts[i].text.toLowerCase().indexOf(buf) === 0) return setActive(i);
      }
    }

    trigger.addEventListener('click', function () {
      if (isOpen) close(); else open();
    });

    trigger.addEventListener('keydown', function (e) {
      var k = e.key;
      var printable = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!isOpen) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); }
        else if (k === 'Home' || k === 'End') { e.preventDefault(); open(); setActive(k === 'Home' ? step(-1, 1) : step(opts.length, -1)); }
        else if (printable) { e.preventDefault(); open(); typeahead(k); }
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(step(active, 1)); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(step(active, -1)); }
      else if (k === 'Home' || k === 'PageUp') { e.preventDefault(); setActive(step(-1, 1)); }
      else if (k === 'End' || k === 'PageDown') { e.preventDefault(); setActive(step(opts.length, -1)); }
      else if (k === ' ' && buf) { e.preventDefault(); typeahead(' '); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); close(); }
      else if (k === 'Tab') choose(active);
      else if (printable) { e.preventDefault(); typeahead(k); }
    });
    // Space activates a button on keyup; the keydown above already handled it
    trigger.addEventListener('keyup', function (e) { if (e.key === ' ') e.preventDefault(); });
    trigger.addEventListener('blur', function (e) {
      if (isOpen && e.relatedTarget && !host.contains(e.relatedTarget)) close();
    });

    // keep focus on the trigger while the pointer is in the list
    list.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    list.addEventListener('pointermove', function (e) {
      var li = e.target.closest && e.target.closest('.hs-opt');
      if (li && li.__i !== active && !opts[li.__i].disabled) setActive(li.__i);
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('.hs-opt');
      if (li) choose(li.__i);
    });

    var form = select.form;
    if (form) form.addEventListener('reset', function () { setTimeout(sync, 0); });

    sync();
  }

  function scan() {
    // Never the copy still inside <x-dc>: the runtime reads its template from
    // that element's innerHTML, so anything written there joins the React tree.
    var hosts = document.querySelectorAll('[data-halo-select]');
    for (var i = 0; i < hosts.length; i++) {
      if (!hosts[i].__halo && !hosts[i].closest('x-dc')) mount(hosts[i]);
    }
    // Stagger each field's bars so a column of fields doesn't drift as one wave.
    var glows = document.querySelectorAll('.halo-glow');
    for (var j = 0, n = 0; j < glows.length; j++) {
      if (glows[j].closest('x-dc')) continue;
      if (!glows[j].__halo) {
        glows[j].__halo = true;
        glows[j].style.setProperty('--hf-d', -(n * 1.7) + 's');
      }
      n++;
    }
  }

  function start() {
    injectCss();
    scan();
    // the form renders through React from unpkg, and remounts after "Write another"
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
