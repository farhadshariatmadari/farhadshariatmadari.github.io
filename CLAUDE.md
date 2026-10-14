# Farhad Shariatmadari — portfolio site

Live: **https://farhadshariatmadari.github.io** · Repo: `farhadshariatmadari/farhadshariatmadari.github.io`

Static site, no build step, no package.json. Deployed by GitHub Pages from `main`.

## Deploying

```bash
git add -A && git commit -m "message" && git push
```

Live in ~1 minute. That is the entire deploy process — no build, no CI.

## Local preview

```bash
npx serve -l 4321 .
```

`.claude/launch.json` defines this as the `portfolio` server for the preview tool.

## Internal links are extensionless — don't write `.html`

The files on disk are still `Work.html`, `About.html`, … but **every internal
link omits the extension**: `href="Work"`, `href="How-I-Work"`, and the home
link is `href="./"` so it lands on the bare domain rather than `/index.html`.
This also covers the 9 `data-href` attributes on the home page's cards, which
`onCardClick` feeds straight to `window.location.href`.

It works because GitHub Pages resolves `/Work` to `Work.html` on its own — no
Jekyll (there's a `.nojekyll`), no rewrite config, nothing to maintain. `npx
serve` does the same locally via its default `cleanUrls`, so preview matches
production.

- **Don't restructure into `Work/index.html` folders.** `/Work/` is a 404 today,
  and moving the files would change the URL depth and break every relative
  `assets/…` and `./support.js` path on the page. Flat files at the root are
  what makes the relative paths work.
- The old `Work.html` URLs still resolve — they're the real filenames — so any
  link shared before Aug 2026 keeps working. That leaves each page reachable at
  two URLs, which is why every `<helmet>` now carries a
  `<link rel="canonical">` pointing at the extensionless form.
- Adding a page means adding its canonical tag too, right after `<title>`.

## ⚠️ These pages are NOT plain HTML

They were imported from Claude Design and run on the **x-dc runtime** in
`support.js`, which renders them with React (loaded from unpkg at runtime).
`support.js` is generated — never edit it.

A page looks like:

```html
<body>
<x-dc>                              <!-- everything inside is a React template -->
  <helmet> … </helmet>              <!-- becomes <head>: title, meta, <style> -->
  <div ref="{{ someRef }}"> … </div><!-- ref/onClick bind to the logic class -->
  <a style-hover="color:#14171c;">  <!-- hover styles, not real CSS -->
</x-dc>
<script type="text/x-dc" data-dc-script>
class Component extends DCLogic {   // page logic
  renderVals() { return { someRef: this.someRef } }   // exposes bindings
}
</script>
</body>
```

Consequences to keep in mind:

- **Nothing renders without JavaScript.** If React fails to load, the page is blank.
- `<sc-if value="{{ cond }}">` handles conditionals (see `Contact.html`).
- Avoid `setState` in page logic that also drives GSAP — a re-render wipes
  transforms written directly to the DOM.
- Pages that carry logic: `index.html` (card stack), `Contact.html` (form +
  ripple canvas), `About.html` (image fallback). `How-I-Work.html` no longer has
  a logic class at all — a page with no `data-dc-script` block is fine.

## Responsive layout (`responsive.css` + `tools/responsive-classes.py`)

All 14 pages are responsive down to 320px. Because the export puts layout in
inline `style="…"` attributes — which no media query can reach and no selector
can outrank — this works in two halves:

- **Spacing is fluid, not stepped.** The script rewrites every large inline
  padding and gap into `clamp()`: `40px` becomes `clamp(22px, 3.2vw, 40px)`.
  The vw coefficient is `value / 12.5`, so the original value is restored at a
  1250px viewport, just past the 1240px page container — **desktop renders
  pixel-identical to before**. Below the thresholds (28px padding, 32px gap)
  values are left alone; that spacing is detail, and shrinking it only pushes
  text into borders.
- **Grids get a class, and `responsive.css` collapses them.** The class is
  derived from the grid's own declaration, so it describes what the thing is:

  | inline `grid-template-columns` | class | collapses to 1 col at |
  |---|---|---|
  | `200px 1fr` | `.r-side` | 860px |
  | `60px 1fr` | `.r-num` | never — narrows to `44px 1fr` at 560px |
  | anything with `gap: 0` | `.r-strip` + `.r-cN` | c2 860 · c3 720 · c4/c5 560 |
  | anything with a real gap | `.r-gN` | g2 720 · g3/g4 560 (via 2 cols at 860) |

Every `!important` in `responsive.css` is load-bearing — it is the only way to
beat an inline declaration. Don't tidy them away.

**Re-run the script after any Claude Design re-export.** It is idempotent, so
running it twice does nothing:

```bash
python3 tools/responsive-classes.py          # --check to preview
```

Four things that are easy to get wrong here:

- **A `.r-strip` cell is divided by `border-right` on every child but the last.**
  Once stacked, those verticals mean nothing and there is nothing between the
  rows, so each collapse tier re-hangs the dividers as `border-bottom`. That
  repair has to sit *in the same media query that collapses that tier* — which
  is why it looks duplicated. It isn't.
- **`overflow-wrap: break-word` does not prevent overflow on its own.** It
  breaks a word only once the box is already too narrow; it does **not** lower
  the element's min-content width, and `min-width: auto` floors every flex/grid
  item at min-content. `farhadshariatmadari@gmail.com` therefore held its
  column open at 346px inside a 276px screen. Only `overflow-wrap: anywhere`
  lowers min-content — it is set on `mailto:`/`tel:`/`http` links, and because
  the property inherits, stating it there fixes the whole ancestor chain.
- **`repeat(auto-fit, minmax(300px, 1fr))` is not actually fluid.** 300px is a
  hard floor, so under ~340px the last remaining column is wider than the
  screen. The script rewrites the floor to `min(300px, 100%)`.
- **`overflow-wrap: anywhere` is wrong inside a button.** It is right for a link
  in a column of text, but in the home page's dark CTA it broke the address
  mid-word — `farhadshariatmada / ri@gmail.com` — which reads as a rendering
  fault rather than a wrap. That button's label is therefore wrapped in
  `.r-mailbtn-t`, which sets `overflow-wrap: normal` and carries an explicit
  `<wbr>` before the `@`, so the one place it may break is the one a reader
  expects. Turning `anywhere` off restores a min-content width of the longest
  run (19 chars), which only fits at 320px once `.r-mailbtn` pulls its padding
  and font size in under 430px. Both halves are needed; neither works alone.
- **The nav sheds parts rather than wrapping**: `/ design` goes at 860, the name
  shrinks at 720, and below 560 only the logo mark is left. A wrapped nav makes
  the sticky header ~95px tall, which is 12% of a phone viewport, permanently.
  If you restore the name on phones, you are choosing that trade knowingly.

## The prism grid (`prism-grid.js`)

The live hero background on all five main pages (home, Work, About, How I work,
Contact): 64px cells that flash colour under the pointer plus a slow ambient
twinkle. It replaced the static 64px CSS grid those heroes used to paint with
`background-image` — same geometry and same `#eceef2` lines, so nothing moves.

It is a standalone script, not page logic, because the heroes sit on pages whose
Component classes already own a GSAP card stack, a form with `setState`, and an
image fallback. Markup per hero, inside a `position: relative; overflow: hidden`
section:

```html
<div data-prism-grid class="pg-host"></div>
<div class="pg-scrim"></div>
<div class="pg-over"> …hero content… </div>
```

Things worth knowing before changing it:

- Cells are injected imperatively into an element React renders empty, so React
  leaves them alone — verified surviving a `setState` re-render on `Contact.html`.
  The scrim and overlay stay in markup so React owns every node it reconciles.
- The hovered cell is derived from **pointer coordinates**, not `mouseover` on
  the cell. Cells sit behind the content, so hit-testing them would need
  `pointer-events: none` on everything above — which costs text selection and
  click targets.
- `About.html` deliberately has no `.pg-over` wrapper: `.about-hero-inner` would
  become the containing block for the absolutely-positioned sketch and shift it.
  Its text is already `z-index: 2`, the sketch `z-index: 1`.
- **Below 860px the scrim becomes a flat `rgba(246,247,249,.8)` veil.** The
  desktop scrim is a 90° gradient that clears to fully transparent on the right,
  which is safe only because the hero copy is a column on the left and never
  reaches that end. One column wide, the text runs the full width and its line
  ends land exactly where the veil has gone — so a flashing cell reads straight
  through the words. `.8` is the density the copy already sits on at desktop.
  That media query lives in the CSS string in `prism-grid.js`, not in
  `responsive.css`, so it is guaranteed to come after the base `.pg-scrim` rule
  in the same stylesheet rather than racing it in the cascade.
- The 9 case-study pages still use the old static grid background.

## The pointer highlight (`pointer-highlight.js`)

A vanilla port of Aceternity's `<PointerHighlight>`: a rectangle draws itself
around one word while a blue cursor arrow slides to its bottom-right corner —
900ms ease-in-out, fired once when the word scrolls into view. Standalone rather
than page logic, for the same reason the prism grid is.

**It is deliberately rationed. Five words on four pages:**

| Page | Word |
|---|---|
| `index.html` hero h1 | *avoid* |
| `index.html` projects h2 | *proof* |
| `Work.html` h1 | *shipped* |
| `About.html` h1 | *the engineer* |
| `How-I-Work.html` h1 | *no gaps* |

The device stops reading as emphasis the moment it appears twice in one eyeful.
Adding a sixth should mean retiring one.

`Contact.html` has none on purpose: its h1 already runs the character scramble,
which rewrites `el.textContent` — that would delete injected children — and two
effects in one headline is noise. The 9 case-study pages don't load the script.

Markup:

```html
… most designers <span class="ph-keep"><span class="ph ph-flush">avoid<span
   class="ph-fx" data-pointer-highlight data-ph-delay="1250"></span></span>.</span>
```

- The box and pointer are injected into `.ph-fx`, which React renders empty and
  therefore never reconciles. Same trick as the prism grid.
- **`.ph-keep` is not optional where punctuation follows.** `.ph` is
  `inline-block`, which opens a line-break opportunity on both sides of it, and
  a trailing `.` will orphan onto the next line by itself. Skip `.ph-keep` only
  when the next character is a space.
- **`.ph` is `white-space: nowrap`, so the phrase can never exceed the heading's
  `max-width: Nch`** or it overflows the column. That is why About says *the
  engineer* (12ch inside 17ch) and not *thinks like the engineer* (24ch).
- Horizontal padding is a deliberate `-.055em`, not the reference's larger
  value: a highlighted word at the start of a line pushes the box past the
  page's left alignment edge, and that reads as a misalignment.
- **When the word genuinely does start a line, add `.ph-flush`** — no padding
  value hides the overhang there, so `.ph-flush` drops the left inset to `0` and
  the box's left edge lands exactly on the text edge, flush with the h1, subhead
  and buttons below it. The right side keeps its `-.055em`; only the aligned
  edge is snapped. The home hero needs this because *avoid* is the whole of its
  last line — without it the box sat 3.8px left of every other element.
- `data-ph-delay` (ms) holds the draw back so it lands after a heading's own
  entrance animation. The home hero uses 1250ms because its h1 lines blur in on
  a `.42s` stagger.
- Under `prefers-reduced-motion` the box appears at full size with no animation.
  Nothing is hidden, only the motion is dropped.

## Smooth scroll (`smooth-scroll.js`)

[Lenis](https://lenis.dev) 1.3.26, on all 14 pages, as one line in each
`<helmet>`: `<script src="./smooth-scroll.js"></script>`. It eases wheel and
trackpad scrolling over the browser's real scroll, so `scrollY`, `position:
sticky`, IntersectionObserver and back-button restoration are all untouched.
Touch stays native (`syncTouch` off).

The file loads Lenis from unpkg itself (pinned, with SRI) instead of taking a
second `<script>` tag, because x-dc re-creates helmet scripts with
`createElement`, which makes them async, and two tags would run in network
order. If unpkg is down the page just scrolls natively. Upgrading means changing
`SRC` and `SRI` together:

```bash
curl -s https://unpkg.com/lenis@X.Y.Z/dist/lenis.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

What page markup can use, anywhere:

| Markup | Effect |
|---|---|
| `<a href="#id">` | glides there, landing just under the sticky header |
| `data-scroll-to="#id"` / `"top"` / `"bottom"` / px / selector | the same, on any element |
| `data-scroll-offset="-24"` · `data-scroll-duration="1.6"` | optional, with either of the above |
| `data-speed="0.15"` | parallax. 0.1–0.3 sinks it, negative lifts it |
| `data-speed-rest="entry"` | with `data-speed`: rests at entry, then drifts one way (below) |
| `data-lenis-prevent` | native scroll inside that element |

From scripts: `window.smoothScroll.to(target, opts)`, which works whether
or not Lenis loaded, and `window.lenis` once it has.

- **`allowNestedScroll: true` is load-bearing.** Behinto and Medio put tall
  screenshots in 560px `overflow-y: auto` frames, and Contact has a textarea.
  Without the option, the wheel over them scrolls the page and the frames
  become unscrollable with a mouse. At a frame's end the wheel passes back to
  the page.
- **The header height is written to `<html>`'s `scroll-padding-top`.** Lenis's
  `scrollTo` reads that, so anchors clear the header, and the browser's focus
  scrolling reads it too. It is re-measured on resize and before every scroll,
  because the nav changes height at its breakpoints.
- **Nothing that needs page markup runs until the markup exists.** x-dc mounts
  into `#dc-root` *after* the load event, and with Lenis cached, `start()` can
  run before there is a header. `waitFor()` polls on rAF. The same timing means
  the browser's own jump to a `#hash` on arrival finds nothing, so
  `landOnHash()` does it once the target exists and fonts are ready. It never
  overrides a back/forward restore.
- **Every lookup goes through `live()`.** Before x-dc renders, the raw markup
  sits in the document under `display: none`, with the same header and the
  same ids. `live()` takes the first match that has a box, so the hidden copy
  can't be measured (a 0px header) or landed on.
- Under `prefers-reduced-motion`, Lenis stops easing the wheel and makes
  `scrollTo` instant (`respectReducedMotion`), and parallax is off.
- lenis.dev's "templates" are Framer sites. They don't port to this runtime.
  Lenis itself is the only part that does.

### Parallax (`data-speed`)

**Every hero that has two or more layers to drift against each other.** That
means five places. Farhad asked for it everywhere (Oct 2026), and these are
everywhere it means something:

| Page | Element | Speed | Rest | Off at |
|---|---|---|---|---|
| `index.html` | hero "farhad.fig" window (`.hero-shot`) | `0.08` | entry | ≤1024 (wraps under the h1) |
| `About.html` | `.about-hero-art` sketch | `0.1` | entry | 860 (goes static) |
| `Medio.html` | laptop / phone wrappers (`.md-hero-shot`) | `0.05` / `-0.07` | centre | ≤900 (stacks) |
| `Behinto.html` | outer / middle phone wrappers (`.bh-hero-shot`) | `0.04` / `-0.06` | centre | ≤1000 (wraps) |
| `Zeero.html` | the two outer phones | `0.06` | entry | 860 (wraps under ~800) |

All five were swept in headless Chrome at 880–1920 wide. On screen, no
element runs into another or into a frame edge it doesn't already stand on.
Edge-standers (Zeero, About) never lift off their edge.

**Deliberately left out.** Trio and DigiKala Mehr: one browser-framed
screenshot, so there's nothing to drift against. Drifting the whole frame
against the text just reads as lag. Agrino, Safes, Vendora, Sharif AICT:
hatch placeholders, so they get it when their real screens do. Work: its one
image is cover-cropped to an exact fit, with no slack to pan. How I Work,
Contact: text only. Screenshots in body sections: they're content to read,
and some are the nested-scroll frames.

**Never on an element that has `data-gsap`.** GSAP's CSSPlugin folds an
existing `translate` into its own transform when it sets a tween up, and
writes `translate: none`. The offset then counts twice for the whole reveal,
and motion.js's restore snaps it back: a 24–34px jump at the end of Medio's
hero fade-up. The script skips any element that has both and logs a warning.
Put `data-speed` on a wrapper that owns position (flex sizing, any baseline
offset), and leave `data-gsap` on the element inside, which owns appearance.
Medio and Behinto are built that way. Behinto's outer phones also had their
`translateY(14px)` drop on the figure, so the fade-up animated it to 0 and
motion.js snapped it back. It is on the wrapper now. `tools/motion-attrs.py`
on the GSAP side refuses to mark anything carrying `data-speed`.

- **Two resting points.** By default an element sits as designed when its
  centre crosses the viewport's, and drifts both ways from there, which keeps
  the offset on screen small. `data-speed-rest="entry"` makes it sit as
  designed when it comes into view (or at load, if it's already in view), and
  then drift one way only. Use `entry` for anything standing on a clipping
  edge: under the default it rises while below centre and opens a gap under
  itself. Use it for hero visuals too, so the page loads exactly as designed.
  Medio and Behinto use the default because their stages are mid-screen: with
  `entry`, one-way drift reaches twice the offset by the time the stage leaves.
- It writes the individual `translate` property, not `transform`, so it
  composes with an existing transform and React never resets it. It is clamped
  to ±1 viewport × speed, so an off-screen element can't stretch the page. For
  an image moving inside its frame, make the image taller (`height: 120%`) and
  give the frame `overflow: hidden`.
- **It only runs on `(hover: hover) and (pointer: fine) and (min-width:
  861px)`.** Touch scrolling runs on the compositor and a JS translate trails it
  by a frame, which reads as jitter. Under 861px everything is one column.
- **A page switches one element off at its own breakpoint with `translate:
  none !important`.** The script checks the computed `translate`, so it doesn't
  subtract an offset that was never applied. Three heroes need this (the
  "Off at" column above). Medio's wraps under ~895px, and stacked, the sinking
  laptop and rising phone ran 28px into each other at 880. Any composition that
  wraps needs the same check, because elements with opposite speeds
  **converge** once they stack. Find the wrap width by measuring, not
  arithmetic: flex wraps on the items' *basis*, not their min-width. The home
  hero's 460 + 460 + gap makes it wrap at 1020, where the arithmetic said 847.
- **A translated element paints above every plain sibling that follows it.**
  Like `transform`, it lifts the element into the positioned paint layer. The
  laptop's `0 28px 70px` shadow would have drawn over the hero's caption bar,
  which used to sit over it. The bar now has `position: relative` to restore
  the order, on Medio and on Behinto. Check what comes after anything you give
  `data-speed`.

### Testing it

The hidden preview pane pauses rAF **and ResizeObserver**. Lenis then never
ticks, and if it started before x-dc rendered, it believes the page is 0px tall
and clamps every scroll to 0, which looks like a bug in this file. The pane is
fine for logic if you drive frames by hand (`setTimeout` +
`lenis.raf(performance.now())`). Anything about real wheels was verified in
headless Chrome over CDP instead: `Input.dispatchMouseEvent` with `type:
'mouseWheel'` sends a trusted wheel, which is the only way to prove a nested
frame really scrolls. A synthetic `WheelEvent` has no default action, so it can
only show that Lenis didn't call `preventDefault`. Two traps in that setup:

- On a cold cache, React takes ~2.2s from unpkg and Lenis lands ~0–200ms
  after it. Poll for `window.lenis` rather than sleeping a fixed 3s.
- Don't `scrollIntoView` and wheel straight away while Lenis is still easing a
  previous wheel. Its animation overrides the native jump, the target slides
  out from under the cursor, and the wheel lands on the page.

## GSAP (`vendor/gsap/` + `motion.js`)

GSAP **3.15.0** is self-hosted in `vendor/gsap/`: the core and every plugin,
minified, copied from the npm package (all plugins are free since 3.13, including
SplitText, MorphSVG, DrawSVG, ScrollSmoother). No CDN. Upgrade by replacing the
folder from `npm pack gsap@<version>`. `index.html`'s card stack loads the core
from there too. It used to load 3.12.5 from cdnjs, and 3.15 was verified cycling
and swapping the deck with no console errors.

`motion.js` is a set of declarative presets for page markup. **It runs on all 14
pages, everywhere below the hero.**

- **`index.html` was choreographed by hand.** It covers the metrics strip (cells
  staggered + `count` on the five numbers), the project index rows, the logo
  bar, the testimonials (h2 `split-words`, cards staggered), and the CTA (h2
  `split-lines`, then copy and buttons). The hero is left alone because it
  already has its own `.anim` blur-in and the *avoid* highlight. The card stack
  is left alone because GSAP owns it.
- **The other 13 pages are marked by `tools/motion-attrs.py`**, which applies the
  same treatment by rule:

  | Element | Preset |
  |---|---|
  | `h2` | `split-words`, or `split-lines` when it is a large heading |
  | `.r-gN` / `.r-strip` grids | children staggered in |
  | `.r-num` step rows | each row fades up |
  | screenshot frames (an `img`'s parent) | fade up |
  | big numbers | `count` |
  | the dark CTA box | heading, then paragraph, then buttons, as on home |

  Re-run it after a Claude Design re-export, after `responsive-classes.py`
  (it reads the `.r-*` classes that script adds). It is idempotent:

  ```bash
  python3 tools/motion-attrs.py          # --check to preview
  ```

  The script leaves alone:
  - the nav, the hero (the `<section>` holding the `<h1>`), and the footer
  - anything inside `<sc-if>`, which only mounts on a state change
  - any heading that carries a pointer highlight. SplitText would tear out the
    injected `.ph-fx`
  - anything whose ancestor already animates. One element never moves inside
    another that is moving; `count` is the exception, since it changes only text
  - **any element with `data-speed`**

  `count` skips years, step numbers like "01" (the leading zero would be lost),
  values under 3, and either side of a "before → after" pair. Counting "0.4%" up
  from 0 says the opposite of what "0.4% → 2.8%" means.
- **Never put `data-gsap` and `data-speed` on the same element.**
  `smooth-scroll.js` writes its parallax as `translate`. GSAP folds that into
  its own transform, and `restore()` then snaps it back, which showed as a
  24–34px jump on Medio's hero. Wrap one element inside the other. Both scripts
  guard against it.
- **Testing:** pages take a few seconds longer to become ready now that Lenis
  loads from unpkg. A headless test that scrolls before render sees nothing
  fire, so wait about 5s first. All 13 pages were verified that way: every
  element played and restored its inline style exactly, the counters ended on
  the real text, and there were no console errors and no horizontal overflow.

To add it to a new page, put four lines in its `<helmet>`, in this order:

```html
<script src="./vendor/gsap/gsap.min.js"></script>
<script src="./vendor/gsap/ScrollTrigger.min.js"></script>
<script src="./vendor/gsap/SplitText.min.js"></script>  <!-- split-* only -->
<script src="./motion.js"></script>
```

Then `data-gsap="fade-up"` on any element. The element plays once when it scrolls
in. Presets: `fade`, `fade-up`, `fade-down`, `from-left`, `from-right`,
`scale-in`, `blur-in`, `clip-up`, `split-lines`, `split-words`, `split-chars`,
`count`. Options: `data-gsap-delay` / `-duration` / `-stagger` (ms, matching
`data-ph-delay`), `-start`. `data-gsap-stagger` animates the element's children
instead of the element. Parallax is deliberately left out; use `data-speed`
from `smooth-scroll.js`.

Things learned getting it to work:

- **x-dc runs every `<helmet>` script twice.** The raw `<x-dc>` markup is parsed
  into the body under `display:none`, which runs the scripts once, in order. Then
  x-dc re-inserts them into `<head>`, which runs them again. The second
  `gsap.min.js` replaces `window.gsap` with a separate instance. `motion.js`
  therefore captures `gsap`, `ScrollTrigger` and `SplitText` at its first run and
  only ever uses those. A bare `ScrollTrigger.refresh()` would hit the copy
  that owns no triggers. `window.__motion.gsap` / `.ScrollTrigger` is the copy
  to inspect from the console.
- **It skips anything inside `x-dc`**. That is the hidden raw template, and a
  trigger measured on a `display:none` element fires at once.
- **Not `clamp()` on the start.** It lifts anything already in view to a start of
  exactly 0, and at `scrollY` 0 that doesn't count as entered, so the first
  screen stayed hidden until the visitor scrolled. The default start is `top 88%`
  as a function, capped at `maxScroll − 1` so the last element on a page can
  still be reached.
- **One-shot presets snapshot the element's inline style and put it back
  exactly** when they finish. That covers `opacity`, `transform`, the individual
  `translate`/`rotate`/`scale` that GSAP sets to `none`, `filter` and `clip-path`.
  The export keeps layout and dimmed opacity (`.6`) inline, and a leftover GSAP
  transform becomes a baseline later GSAP work can't clear (landmine 1 of the
  card stack). Verified: a `.6` label returns to `.6`, and a `rotate(2deg)`
  element returns to `rotate(2deg)`.
- **Motion is relative to where the element already rests.** `basic()` reads
  each target's resting `x`/`y`/`scale` (`gsap.getProperty`) and animates from
  rest + offset back to rest. It used to animate `y` to an absolute 0, so an
  element sitting on an inline `translateY(14px)` lost its offset for the whole
  reveal, and `restore()` snapped it back at the end. That was Behinto's outer
  hero phones. Verified: `translateY(14px)` runs 42 → 14 with no snap, and
  `scale(1.1)` runs 1.034 → 1.1.
- `count` writes into React's own text node (`nodeValue`), not `textContent`, and
  ends on the original string. The element must hold plain text only.
- `split-*` swaps the element's children while it runs, then reverts to HTML. React's
  text nodes are gone after that. Use it only on static copy, never on text a
  `setState` changes, and not on the Contact h1 (the scramble owns it).
- Reduced motion: nothing animates, and everything is simply in place.
- The hidden preview pane pauses rAF, so GSAP looks dead there (`ticker.frame`
  stays 0). It was verified in headless Chrome over CDP instead.

## The border glow (`border-glow.js`)

A vanilla port of React Bits' `<BorderGlow>` in its light-surface settings.
While the pointer is over a card, the edge nearest it gets a mesh-gradient
border (signal blue, violet, pink, the prism grid's colours) and a soft blue
glow. Nothing shows at the centre, and it strengthens toward the edge.
`data-border-glow` on the card is all it takes. It's on the home page's 4
testimonial cards and all 9 Work cards (Trio flagship + the grid), and the
script loads on those two pages only.

- **No element is injected.** The original appends an `.edge-light` span, and
  here that would become the card's last child. Work's flagship is an
  `.r-strip`, and responsive.css hangs its stacked dividers off
  `> *:last-child`, so the image cell would grow a stray border. The border
  is the card's `::before`, the glow its `::after`, and the script only
  writes `--edge-proximity` and `--cursor-angle`. The original's third layer,
  a faint fill inside the edge (0.22 on light), is dropped because it needs
  a third box.
- Both layers are `z-index: -1` inside the card's own stacking context
  (`isolation: isolate`): above its background, below its text. They sit at
  `inset: -1px` so the colour replaces the 1px grey border rather than doubling
  it. That assumes a 1px border and a `#fff` card (`--bg-card` overrides it).
- **The card has to be `overflow: visible`** (forced with `!important`) or it
  clips its own glow. The glow's mask is drawn larger than the card with
  `mask-clip: no-clip` so the outset shadows survive it. Losing the clip cost
  Work's flagship its rounded image corners, so `.wk-flag-shot` gives the image
  its own (right side, then bottom once it stacks at 860).
- Inside `@media (hover: hover)` only, so touch layouts are untouched,
  `overflow` included. A tap would leave `:hover` stuck on.
- Verified in headless Chrome with real mouse moves on both pages: centre 0,
  edges 0.79–0.96, fades out on leave. No x-overflow at 320/375/768/1440, the
  flagship keeps 2 children, no console errors. To test a hover, wait for a
  card's GSAP reveal to finish first. The card rises 28px, the pointer ends
  up outside it, and `:hover` drops while the last proximity reading stays.

## The headline scramble (`Contact.html`)

The h1 reveals `what you're building.` out of random characters — once on load, and
again on `pointerenter`. It lives in the page's Component class, not a standalone
script, because it is one headline on one page.

**The headline is two lines and has to stay two lines while it runs.** Random glyphs
are wider than the ones they stand in for, so `building.` grew, wrapped, and the h1
sprouted a third line mid-animation. Two guards fix it and *both* are needed:

- **Every word becomes an `inline-block` locked to the width it finishes at**, so the
  h1 breaks in exactly the same places whatever is inside the words. Guard 2 alone
  leaves the break at the mercy of the string — narrower text can pull a word *up*
  just as easily as wider text pushes one down.
- **A replacement glyph is never wider than the character it replaces**, measured
  with `canvas.measureText`. Guard 1 alone would need clipping, and `overflow:
  hidden` on a `line-height: 1.0` heading cuts the descender off the `g`.

The worst possible scramble of each word measures 0–1.9px *under* its real width, so
no state can overflow its box. Three things follow from the widths being in px:

- **Measure after `document.fonts.ready`.** Measuring the fallback font locks in
  boxes that are wrong the moment Space Grotesk lands.
- **Bail if the element has no width** (background tab, `display: none`). Locking
  zero-width boxes stacks the headline one character per line. It retries on rAF,
  which is paused while hidden, so it resumes on show.
- **Abort on `resize`.** `font-size` is `clamp(36px, 5.4vw, 64px)`, so a resize
  mid-run leaves every word holding a stale box — that wraps the h1 to four lines.
  `stopScramble()` snaps to the finished text instead.

Every run rebuilds and re-measures, and the last frame restores plain text, so the
resting headline is fluid and carries no leftover spans. Verified surviving a form
`setState` re-render mid-animation, the same way the prism grid was.

## The contact form (`Contact.html`)

Submissions go to **Web3Forms**, which emails them to farhadshariatmadari@gmail.com
and keeps a copy in its dashboard (Farhad's account, signed up Oct 2026). There
is no server. The form POSTs `FormData` straight to `api.web3forms.com/submit`.
It used to open a `mailto:`, which does nothing for anyone without a desktop
mail app, yet still showed the success screen.

- `WEB3FORMS_KEY` in the Component class is **public by design**. It can only
  deliver to the inbox it was issued for, so it belongs in the client and in this
  public repo. Don't move it into a "secret" or strip it before committing.
- It is a real `<form onSubmit>`, so the browser's own validation runs before
  `send` does. A valueless `required` attribute is lost in the x-dc runtime,
  because it reaches React as `""` and React drops a falsy boolean. Always bind it
  as `required="{{ … }}"`. camelCase props go through the `sc-camel-` prefix
  (`sc-camel-auto-complete`, `sc-camel-tab-index`).
- **Only "email or mobile" is required** (Farhad, Oct 2026). Name and message are
  optional, and either contact field or both may be filled. Native validation
  can't say "one of these two", so both carry `required="{{ needContact }}"`.
  They are required while both are empty and neither is once one has text.
  `onContactInvalid` swaps in a message that names both fields. A custom validity
  message sticks until it is cleared, so `setContact` clears it on **both** fields
  whenever either one changes. Without that, filling in the mobile would leave the
  email stuck invalid.
- The mobile `pattern` accepts Persian (`۰–۹`) and Arabic-Indic digits as well as
  ASCII, because a Persian keyboard types those. Chrome compiles `pattern` with
  the `v` flag, so `( ) . -` inside the class must stay escaped.
- Blank fields are deleted from the `FormData` before sending, so the email has no
  empty rows and Web3Forms never sees a blank `email` to use as the reply-to.
- The success screen shows **only on `success: true`** from the API. A failure
  or a 15s timeout keeps everything the visitor typed and offers the old prefilled
  `mailto:` as the fallback (`mailtoHref`), so nothing has to be retyped.
- `botcheck` is Web3Forms' honeypot. It is hidden, and the service drops any
  submission that has it ticked.
- `subject` and `from_name` set the notification's subject line and sender name.
  Replying in Gmail goes to the visitor's `email` field (verified). When only a
  mobile is given there is nothing to reply to, so the number is in the subject.

## The hero mark (`vector-mark.js`)

The panel beside the home-page headline is the F logo open in a design file,
`farhad.fig`. It is drawn live from the logo's own construction, with its
anchor points, selection box, size pill and an inspector strip, and every point
can be dragged. It replaced the CSS work reel in Oct 2026. In between, a photo
portrait that turned to follow the pointer was tried locally and never
deployed. Farhad had it deleted, script, assets and build tools included. He
asked for both swaps, so don't bring either back unprompted.

What it does:

- **First view:** a multiplayer cursor labelled "Farhad" draws the mark with
  the pen tool. It places the five points, rubber-banding from one to the next,
  then the strokes inflate around the skeleton (`jelly()`, a ~13% overshoot)
  and the selection lands with the size counting up to `61 × 84`. It starts
  when the panel is first *seen* (IntersectionObserver), because on a phone it
  sits below the fold.
- **Left alone:** every few seconds the cursor picks a point up and moves it.
  The moves are listed in `EDITS`. One drags the bar tip until it lines up
  under the arm tip, so a smart guide fires.
- **A visitor's mouse** entering the canvas takes over. The cursor fades out
  and comes back 3.2s after the mouse leaves. A resting mouse pulls the nearest
  point up to 3 units towards it.
- **Dragging** a point stretches the strokes live. Smart guides (pink) snap it
  to other points' x/y, and a dashed trail runs back to where it started. On
  release it springs home with a wobble (`LOOSE`, ζ≈0.36). Dragging a stroke
  moves the whole mark, and dragging empty canvas draws a marquee.

Things that are easy to break:

- **The geometry is `logo-mark.svg`'s**: same 61×84 user space, same three
  gradients, and the same masked wedge, with the mask region made huge because
  points travel outside 61×84. If the logo's construction changes, `REST`,
  `T0` and `ARM` change with it.
- **The middle arm is pinned to the stem.** Its root `d` is a fraction `t`
  along foot → corner and can only slide along that line; the bar tip `e` rides
  on `d`. That is why tilting the stem carries the bar with it, instead of the
  bar detaching. When `a` or `b` is dragged, `d` and `e` are excluded from
  smart-guide candidates, because they move with it and would chase themselves.
- **Never inject into the copy still inside `<x-dc>`.** The runtime reads its
  template from that element's `innerHTML`, so anything put there becomes part
  of the React tree, and the next render dies on `removeChild`. `scan()` skips
  any host with an `x-dc` ancestor. This bit during development: the page went
  blank.
- **Touch:** the canvas is `touch-action: pan-y` so a phone can scroll through
  it. A touch that starts on a point (24px radius) cancels the scroll in a
  non-passive `touchstart`. A touch on bare canvas is a scroll and doesn't take
  over from the cursor.
- **Reduced motion:** no intro, no cursor, and a critically damped return (it
  goes home without bouncing). Dragging still works, because the visitor is
  the one moving it.
- The loop sleeps on a timer during the cursor's waits and stops when the
  canvas is off screen. After being away, `resume()` restarts the visits from
  a clean slate, so a queue of steps whose time has passed can't fire all at
  once.
- `.vm-frame`'s aspect ratio and `.vm-still`'s `calc()` are in `index.html`. The
  still is only for when the script never runs; the host inherits the frame's
  dot-grid background and covers it.
- The old reel's `hero-*.png` are still in `assets/`, but no page references
  them.

## The home page card stack (`index.html`)

A port of the React/GSAP "CardSwap" component to the x-dc runtime. Nine project
cards fan in 3D, auto-cycle every 3.4s, and the index list below is kept in sync.
Hovering a list row pulls that card to the front; clicking either navigates.

Four landmines already fixed here — don't reintroduce them:

1. **GSAP folds `skewY` into rotation + skewX** when it parses an existing
   transform. A CSS `skewY()` on `.cs-card` becomes a baseline GSAP can never
   clear, so `skewY: 0` silently does nothing on mobile. Let GSAP own the skew.
2. **Each `.cs-row` is its own grid**, so an `auto` column resizes the `1fr`
   columns per row and the tags stop lining up. The metric column is fixed-width.
3. **`.cs-stage` needs `overflow: hidden`** — the swapping card falls 520px and
   would otherwise sweep over the project list below it.
4. **Responsive column counts must match the visible children**, or leftovers
   wrap onto an implicit row. `measure()` also recomputes the fan geometry per
   breakpoint; it collapses to a shallow fan on narrow screens.
   **The deck has exactly one breakpoint and both halves must read it.** The
   stylesheet's `@media (max-width: 660px)` sizes the stage and card; `metrics()`
   picks the fan via `window.matchMedia(this.NARROW)` on the *same* query. They
   were once two separate numbers — CSS switched at a 620px viewport, `metrics()`
   at a 470px *stage* (≈514px of viewport) — and in the ~100px gap a 160×144 fan
   was laid out inside a 516×472 stage. `overflow: hidden` then sheared the deck
   on all four sides: the front card lost its left edge and the shadow was cut
   off square. If you move one, move the other.
   660 rather than 620 because `.cs-stage-wrap` is a flex container, so the
   600px stage is flex-shrunk once the wrap falls under 600 (from ~631px of
   viewport), and a shrunken stage still holding the desktop card leaves under
   23px below the deck. The project index keeps its own 620 breakpoint in a
   separate block — it shares nothing with the deck but the section.
5. **The stage has to leave 23px under the deck for the card shadow**, which is
   what `box-shadow: 0 26px 54px -30px` reaches below a card (offset − spread +
   half the blur). `measure()` centres the card *centres*, which is not the same
   as centring the fan: perspective shrinks the cards further back and the 2°
   skew makes the front one taller, so the deck settles low. It used to leave
   52px of slack above and 4px below, and the stage sheared the shadow into a
   hard line. `centre()` fixes it up after `place()` by measuring the fan's real
   box — call it wherever `place(false)` is called. Don't "fix" this by dropping
   the `overflow: hidden` in landmine 3; the shadow and the falling card both
   need that edge, just at different distances.
6. **One `centre()` at mount is not enough.** On a cold load the reading is
   sometimes taken before the geometry is final and lands a partial correction
   — 7px of the 24px needed — which puts the shadow back under the stage edge.
   It reproduces intermittently and only on a first, uncached load. `settle()`
   therefore re-runs `centre()` on the next frame, at `load`, and after
   `document.fonts.ready`. `centre()` re-measures from scratch and no-ops when
   the fan is already balanced, so the repeats can't compound.
   **`centre()` must never run mid-swap**: the falling card is up to 520px below
   the deck, so `below` reads hugely negative and the shadow guard would yank
   the whole fan to the top of the stage. That's what the `_tl.isActive()` bail
   at the top of `centre()` is for — don't remove it.

## Logo and favicon

Two hand-built SVGs in `assets/`:

- `logo-mark.svg` — the F mark on a transparent ground, used in the nav (19×26)
  and footer (16×22) of all 14 pages.
- `favicon.svg` — the same mark on the dark rounded tile, linked from every
  `<helmet>` as `rel="icon" type="image/svg+xml"`.

**These were reconstructed as vector from a flattened logo sheet, not exported
from the original source.** They are a close match, not a byte-exact copy — if
the real vector ever turns up, replacing these two files updates the whole site,
since nothing else references the artwork.

Construction, shared by both files: a 61×84 user space, two round-capped strokes
of width 27 — `M13.5 70.5V13.5H47.5` for the stem and top arm, `M13.5 46H34` for
the middle arm — over a blue→lavender diagonal gradient.

Two things to preserve if you edit them:

- The dark wedge where the strokes cross is the middle arm **re-stroked through a
  mask of the main shape**, not `mix-blend-mode: multiply`. Multiplying two blues
  keeps the blue channel high and lands on a bright indigo rather than the near
  navy in the source art; masking also survives `<img>` and favicon rendering,
  where blend modes and isolation are less dependable.
- That mask needs `maskUnits="userSpaceOnUse"` with an explicit region. The
  masked element is a horizontal line, so its geometry bbox has zero height and
  a default `objectBoundingBox` region collapses to nothing — the wedge silently
  disappears.

Still missing, because this machine has no rasteriser (no rsvg/imagemagick/inkscape):
`apple-touch-icon.png` (180×180) and an Open Graph share image (1200×630). Both
must be PNG — SVG is not accepted for either. `index.html` has `og:title` and
`og:description` but no `og:image`.

## Images

24 screenshot PNGs in `assets/`, already optimised (14.1 MB → 2.9 MB), plus the
four testimonial avatar JPEGs below and the four `hero-*.png` variants of the
retired hero reel (unreferenced). If
you add more screenshots:

```bash
sips --resampleWidth 2320 file.png            # only if wider than 2320
pngquant --quality=70-95 --skip-if-larger --strip --force --output f.png f.png
oxipng -o 2 --strip safe file.png
```

2320px is 2× the 1160px max render width, so it stays retina-sharp. **Always
eyeball the result** — pngquant is lossy and photo-heavy screenshots can band.

The hero reel is the one place that does *not* use the 2320px originals — they
render at 460px there and four of them above the fold is 595 KB. Its variants are
cut from the same sources at 920px (desktop shots) and 420px (phone shots), same
pngquant/oxipng pass, 175 KB for all four:

| Reel asset | Cut from |
|---|---|
| `hero-trio.png` | `trio-devices.png` |
| `hero-behinto.png` | `behinto-recommendations.png` |
| `hero-mehr.png` | `mehr-project-desktop.png` |
| `hero-zeero.png` | `zeero-map-reserve.png` |

`About.html` has an automatic fallback: if `assets/farhad-sketch.png` is missing
the page shows a placeholder instead of a broken image, and restores itself when
the file returns.

Four projects have **no screenshots at all** (Safes, Agrino, Vendora, Sharif
AICT) and use the hatch placeholder — see `assets/MISSING-ASSETS.md`.

### Medio's screens are WebP, not PNG

The 13 `assets/medio-*.webp` files (1 MB in all) arrived from Farhad as
already-compressed WebP at 2000px or less, so they skip the PNG pass above and
are mostly copied byte-for-byte. Five were cut with `cwebp -crop` (q88) from
the supplied originals, which are not in the repo:

- `medio-dashboard-top` and `medio-dashboard-feed` are the top and middle of one
  tall dashboard capture. The hero shows the first; the feed crop drops the
  empty sidebar column, so there is no repeat of what the hero already shows.
- `medio-reason-builder` has the sidebar cut off. That keeps its question text
  legible at the ~840px it renders at.
- `medio-appointment-detail` is cut tight to the modal's edge. The CSS
  `border-radius: 3.2% / 2.04%` is the modal's own 24px corner as a share of
  750×1177, so the dark backdrop's anti-aliased corner pixels never show. Re-cut
  the image and that ratio has to change with it.
- `medio-mobile-appointments` and `medio-mobile-fees` were PNGs, converted to WebP.

The chats and dashboard-feed pair share one `aspect-ratio` box with
`object-fit: contain`. Their ratios differ (1.61 vs 1.69), and the box's
`#0c0e12` matches both screenshots' own background, so the letterbox is
invisible. Don't change that colour on its own.

### Testimonial avatars

Four real photos, all present, one per testimonial card on `index.html`:

| File | Person |
|---|---|
| `assets/testimonial-soheil-tehranipour.jpg` | Soheil Tehranipour |
| `assets/testimonial-mohammad-maher.jpg` | Mohammad Maher |
| `assets/testimonial-mohammadreza-azhari.jpg` | MohammadReza Azhari |
| `assets/testimonial-masoud-kaviani.jpg` | Masoud Kaviani |

168×168 JPEG, ~12 KB each — 4× the 42px render size, so they stay sharp to 4×
DPR. All four sources happened to be square, so `object-fit: cover` is a 1:1
fit with no crop. **Check that if you replace one**: a portrait taller than it
is wide gets centre-cropped, and on a head-and-shoulders shot that cuts the
face. Crop square first, or set `object-position`.

```bash
sips -s format jpeg -s formatOptions 82 -Z 168 source.png --out assets/testimonial-name.jpg
```

`.tst-av` stacks the photo *on top of* the coloured initials disc, and
`avatarRef` hides the `<img>` on `error`, so a missing or misnamed file falls
back to initials rather than a broken image icon. Both states are verified —
which also means a typo'd filename fails silently, so check the avatar actually
renders after any rename.

`alt=""` is deliberate: the person's name sits next to the avatar as text, so
the photo is decorative and a screen reader repeating the name is noise.

## Never publish

`.gitignore` keeps these local. The repo is **public**, so keep it that way:

- `uploads/` — the content brief, with `[CONFIRM]` items, "do not mention"
  instructions, and mock-testimonial notes
- `DESIGN_HANDOFF.md`, `assets/MISSING-ASSETS.md` — internal notes
- `Style Directions.dc.html` — internal design exploration
- `legacy-portfolio.html` — the previous dark Three.js portfolio, kept for reference

## Content facts already settled (confirmed by Farhad, Aug 2026)

- Gitex recognition, and Medio's publicly-describable AI features: **confirmed**,
  the working-file `CONFIRM` badges were removed.
- **Zeero first-ride conversion is 8%** — an earlier draft said 30%+. If you see
  30% anywhere it is wrong.
- Testimonials on the home page are **real, with permission** — do not treat
  them as the placeholders the brief describes.
- Vendora has **no status section**: no launch stage or metrics exist for it.
- Farhad's GitHub username changed from `MHShariat` (his previous name,
  Mohammad Hossein) to `farhadshariatmadari`. Use the current name everywhere;
  the old `mhshariat.github.io` URL is dead.

## Conventions

Type: Space Grotesk (display), IBM Plex Sans (body), JetBrains Mono (labels).
Colour: `#f6f7f9` base, `#14171c` ink, `#2f5cf0` signal, `#e2e5ea` borders.
Section labels are lowercase mono with a `//` prefix. Placeholders for missing
imagery use the hatch pattern plus a `[ project · screen ]` mono label.
