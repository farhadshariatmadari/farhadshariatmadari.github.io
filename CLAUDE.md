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
  two URLs, which is why every page carries a `<link rel="canonical">`
  pointing at the extensionless form.
- Adding a page means adding its canonical tag too, right after `<title>`,
  adding it to `PAGES` in `tools/seo-head.py`, and running that script (next
  section).

## Search (`tools/seo-head.py`, `sitemap.xml`, `robots.txt`)

Set up in Oct 2026 so that searching Farhad's name, in English or in Persian,
finds the site.

- **Search tags live in the real `<head>`, between `<!-- seo:start -->` and
  `<!-- seo:end -->`, not in `<helmet>`.** Helmet sits in `<body>` until x-dc
  moves it with JavaScript. Google ignores a canonical in `<body>`, and
  anything that exists only after rendering waits for Google's slower
  rendering pass. The block holds the canonical, `<title>`, description,
  `og:*` (plus a generated `og:url` and `og:site_name`) and the favicon.
- **They are moved out of helmet, never copied.** The helmet manager in
  `support.js` appends every tag it holds to `<head>` without checking what is
  already there, so a copy would mean two titles and two canonicals. Verified
  on all 14 pages after render: exactly one of each.
- **A Claude Design re-export puts them back in helmet.** Re-run the script
  after one. It is idempotent, and tags from a fresh export win over the old
  block:

  ```bash
  python3 tools/seo-head.py          # --check to preview
  ```

- The home page's block also holds a JSON-LD graph (`Person` + `WebSite`).
  `alternateName` carries the Persian spellings (فرهاد شریعتمداری, and the
  ZWNJ form), and `sameAs` carries LinkedIn and GitHub. Add any new public
  profile there; a link from that profile back to the site counts as much.
- The script also writes `sitemap.xml`, with each page's last commit date as
  `<lastmod>`. Run it after committing a content change if you want that date
  current. `robots.txt` is static and points at the sitemap.
- Every footer's bottom line has the Persian name in a `<bdi lang="fa">`, so it
  exists as visible text on all 14 pages. It uses `system-ui` because
  JetBrains Mono has no Persian glyphs, and `nowrap` so the name never splits
  at 320px.
- **Google Search Console ownership is proved two ways (Oct 2026):** the
  `google-site-verification` meta in `index.html`'s seo block, and
  `google9065f1fe6f7c74c5.html` in the root. **Delete neither.** Google keeps
  re-checking, and the property is un-verified once both are gone. The script
  carries the meta through re-runs, and it belongs in the block, not in helmet
  (Google reads it from the raw HTML).
- Not done yet: there's no `og:image` (needs a 1200×630 PNG).

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
means eight places. Farhad asked for it everywhere (Oct 2026), and these are
everywhere it means something:

| Page | Element | Speed | Rest | Off at |
|---|---|---|---|---|
| `index.html` | hero "farhad.fig" window (`.hero-shot`) | `0.08` | entry | ≤1024 (wraps under the h1) |
| `About.html` | `.about-hero-art` sketch | `0.1` | entry | 860 (goes static) |
| `Medio.html` | laptop / phone wrappers (`.md-hero-shot`) | `0.05` / `-0.07` | centre | ≤900 (stacks) |
| `Behinto.html` | outer / middle phone wrappers (`.bh-hero-shot`) | `0.04` / `-0.06` | centre | ≤1000 (wraps) |
| `Agrino.html` | outer / middle phone wrappers (`.ag-hero-shot`) | `0.04` / `-0.06` | centre | ≤1000 (wraps) |
| `Zeero.html` | the two outer phones | `0.06` | entry | 860 (wraps under ~800) |
| `Vendora.html` | inventory window / media dialog wrappers (`.vd-hero-back` / `.vd-hero-front`) | `0.04` / `-0.06` | entry | never (they overlap, so can't stack) |
| `Sharif-AICT.html` | assistant / studio window wrappers (`.sh-back` / `.sh-front`) | `0.04` / `-0.06` | centre | never (they overlap, so can't stack) |

The first five were swept in headless Chrome at 880–1920 wide. On screen, no
element runs into another or into a frame edge it doesn't already stand on.
Edge-standers (Zeero, About) never lift off their edge. Agrino (Oct 2026) is
Behinto's hero rebuilt with its own screens (same 272px phones, speeds and
wrap point), so it inherits that sweep rather than having its own.
Vendora (Oct 2026) is the one overlap: the dark dialog is absolutely placed
on the light window's lower-right corner at every width, so the two never
stack and need no "off at" rule. Swept at 880–1920: the dialog's top stays
258px+ inside the stage, and no screen's bottom gets nearer the caption bar
than the stage's own padding.
Sharif AICT (Oct 2026) overlaps too: two windows in row 1 of a 12-column
grid, with the studio's top just under the assistant's prompt. It rests at
**centre**, not entry. The studio is the lower layer and the nearer one, so
the two can only ever converge. Under entry, that put the studio over the
prompt by 300px of scroll, before the stage had reached mid-screen. At centre
they arrive a little apart, sit exactly as laid out when centred, and close
only as the stage leaves. Swept at 880–1920 (viewports 640–1080 tall): on
arrival the back keeps 27px+ under the stage top and the studio 13px+ above
the caption bar.

**Deliberately left out.** Trio and DigiKala Mehr: one browser-framed
screenshot, so there's nothing to drift against. Drifting the whole frame
against the text just reads as lag. Safes: hatch placeholders, so it
gets it when its real screens do. Work: its one
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

## The spotlight (`spotlight-card.js`)

A vanilla port of React Bits' `<SpotlightCard>`, light theme, on the same 13
cards as the border glow (`data-spotlight`). It draws a soft signal-blue light
inside the card. The light eases after the pointer, fades in from 80px outside
the card, swells while the card is pressed, centres on a card with keyboard
focus, and under reduced motion jumps instead of easing.

- **It is the card's own `background-image`**, through `--spot-fill`, which
  the script rewrites each frame with the strength baked into the alphas
  (`!important`, since every card sets `background` inline). The original's
  four spans are out for the same `.r-strip` last-child reason as the border
  glow, and the border glow already owns both pseudo-elements.
- **The two files are coupled.** border-glow.js's `::before` paints the card's
  interior opaque under its ring, so its fill repeats `var(--spot-fill)`.
  Without that, the light disappears under the glowing edge, exactly where the
  pointer is. Change the fill in one, check the other.
- Left out: the film grain (0 by default in the original) and the 1px rim
  light, which needs a box of its own. Near an edge, the border glow lights
  the rim anyway.
- Ink (`#18181b`) is the original's light-theme colour. It's signal blue here so
  it reads as the same light as the glow, at 1.6× the original's light-theme
  strength (a peak alpha of ~0.067), since blue on white reads fainter than
  ink.
- One rAF loop for all cards, which stops once every card has settled.
- Verified in headless Chrome: it eases (60ms after a move it's partway
  there), flares on press (240 → 288px), shows faintly at 40px outside, is
  gone at 200px, and runs on seamlessly under the glowing edge. Flagship
  children unchanged, no x-overflow, no console errors.

## The pixel field (`pixel-card.js`)

A vanilla port of React Bits' `<PixelCard>` (dark theme, its "blue" variant
re-hued to signal blue) on the home page's dark CTA ("Have a complex problem…").
On hover, pixels on an 8px pitch (six per 48px grid cell) ripple out from the
pointer with a blue glow, and the ones near the cursor swell after it on a
spring. A press sends a pulse ring across, and leaving drains them toward
the edges. It plays once by itself the first time the box scrolls into view.
Keyboard focus (`:focus-visible` only, so clicking the mail button doesn't
pin it on) counts as hover.

- `data-pixel-card` goes on an element React renders **empty** inside a
  `position: relative; overflow: hidden` box. On the CTA that's the existing
  48px grid layer, so the canvas sits over the grid lines and under the copy.
  The box (the host's parent) is what takes the pointer. Same trick as the
  prism grid.
- **The field parts around the copy (Oct 2026).** The blue pixels used to
  ripple straight under the words, and the brightest one (`#dbe4ff`) took the
  paragraph down to 1.75:1 and LinkedIn's label and outline to 1.18:1.
  Dimming the effect was ruled out (Farhad wanted it kept lively), so the copy
  is a quiet zone instead. Every frame the field draws, `copyRects()` reads
  the line boxes of every text node in the box (a `Range` per node, so the
  zone hugs ragged line ends) plus the border box of every link and button.
  It reads through transforms, so a heading still rising on its GSAP reveal
  is followed. Within `QUIET_EDGE` (4px) of those boxes no pixel is drawn,
  and a swollen one is capped at `clear × 1.41` so even a square's corner
  can't reach in. Over the next `QUIET_FEATHER` (30px) pixels shrink and fade
  back in, and the ones lining the zone get a little extra alpha (`RIM`), so
  the words read as cut out of the light rather than dimmed into it. The
  radial glow is thinned to `GLOW_KEEP` (20%) under the copy through a mask
  of one cell per pixel, drawn `destination-out` and upscaled with smoothing,
  which is what feathers it. The distance field is recomputed only when the
  rect key changes. Measured in headless Chrome by sampling the canvas under
  each element's glyph boxes during a sweep and a press: paragraph ≥ 7.16:1,
  headline and LinkedIn ≥ 14.79:1, at 1440 and 375, reduced motion included.
  The worst background left is the CSS grid line, not the canvas.
  It's automatic: any text or link you add to the box is avoided too.
- Pre-existing, not the effect's: the `// let's talk` kicker (`#6f7a8a`) is
  4.1:1 on the plain card and 3.7:1 over a grid line, and the mail button's
  hover blue (`#3f6bff`) is 4.4:1 with white. Both are under AA with the
  field off; the same kicker colour is used on the other dark CTAs.
- Only hosts with a box get mounted. The raw x-dc template is in the DOM under
  `display: none` until render, and mounting into it would size the canvas
  to 0.
- Left out: the original's variants, shapes and `trigger` modes (the chosen
  values are constants at the top), and its card chrome (surface, edge
  highlight, tabIndex). The CTA has its own, and its links are focusable.
- Reduced motion: no twinkle, flash, pulse or intro, and hover shows the field
  at once. The rAF loop stops when the field is settled or off screen.
- The other dark "let's talk" boxes (About, Work, How I Work) don't have it.
  Adding it is one attribute plus the script tag.
- Verified in headless Chrome: canvas = box size (1160×500 at 1440), dark
  before view, intro lights ~38k px then clears, hover lights it and leave
  clears it, idle afterwards. Headline still hit-tests above the canvas, no
  x-overflow, no console errors.

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

The contact-methods column is stretched to the form's height (`align-items:
stretch` on the grid, `.ct-methods` in the page's `<style>`). Each card takes
an equal share of the difference and centres its content, so no single card
ends in empty space. If the methods column is the taller one (around 720–780px
wide), the form card stretches instead. Below 720 the columns stack and none of
this applies.

### Halo fields (`halo-field.js`)

The form's five controls are a vanilla port of cult-ui's `<HaloInput>`,
`<HaloTextarea>` and `<HaloSelect>`. Blurred gradient bars drift along the
bottom of each field, clipped to a shell 1px larger than it. They show through
that gap as a rim and through the frosted fill as a haze. The colours are
re-hued from cult-ui's Vercel rainbow to the prism grid's pink, violet,
amber and blues. Contact is the only page that loads the script.

- **Input and textarea are CSS only.** The markup is a `.halo` shell holding a
  static `<span class="halo-glow"><i></i><i></i></span>`, followed by the
  field. The script adds the stylesheet and gives each field a different
  phase, so the column doesn't drift as one wave. The invalid state is
  `:user-invalid`, so nothing turns red before the visitor touches it.
- **The select keeps the native `<select>`.** React's `onChange` and the
  form's `FormData` still read it. Beside it sits an empty
  `<div data-halo-select>`, and the script builds the trigger and listbox in
  there (the prism grid's trick). A choice is written back as `select.value`
  plus a bubbling `change` event, which is what React listens to on a select.
  The native one is hidden only via `:has(.hs-trigger)`, so if the script
  never runs, the plain styled select is still there.
- The `<label for="ct">` still points at the native select, which is
  `tabindex=-1` and forwards focus to the trigger. Without the `-1`,
  Shift+Tab from the trigger lands on the select, which sends focus straight
  back: a trap.
- `.halo-sel` has `z-index: 2` because every `.halo` is `isolation: isolate`.
  Without it, the open list draws under the textarea that follows.
- The select is the **translucent** variant, as in cult-ui's demo: washes on,
  a frosted trigger tinted pink → violet → blue. The component's own default
  (`translucent={false}`) is a near-white trigger, and it read as plain next
  to the inputs.
- Left out of the original: Base UI's align-item-with-trigger positioning (the
  list drops below, or flips above if there's no room) and the loading
  spinner.
- Verified in headless Chrome with real mouse and keys: open, hover, choose
  (check flash and staggered label), Tab in, arrows/Home/End/Enter/Escape,
  type-ahead, label click, outside click, React state surviving a re-render,
  red borders after an empty submit. No x-overflow at 320/375/768, no console
  errors. The hidden preview pane can't test the focus paths, because an
  unfocused document fires no `focus` events.

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
cards fan in 3D and auto-cycle, and the project index **beside** the deck is
kept in sync. Hovering a list row pulls that card to the front; clicking either
navigates.

**Index and deck sit side by side (Oct 2026).** The index used to be a
full-width table under the deck. At laptop heights the two never fit on one
screen, so the card a row pulled forward was off screen. Now `.cs-head` spans
the top as one block (kicker, h2, lede) with "All projects →" on the right, on the
lede's last line, the same shape as the testimonials header. Two earlier
versions put the lede in a column of its own beside the h2, and Farhad
rejected both: the title and its description read as two separate things. The
h2's 20px bottom margin is what keeps the *proof* highlight's cursor clear of
the lede's first line. At 14px it ran 7px into it. `.cs-top` is a
`1fr | 600px` grid: the index on the left stretches to the stage's 590px and
its nine rows share it equally (`flex: 1 1 0`), so both columns end on the same
line. Rows are two lines (name over tag), with the metric on the right. The
metric drops under 1180px, where the column is too narrow for it, and comes
back once the columns stack at 1100. Stacked, the deck comes first (`order:
-1`). `.cs-head`'s right column is 592px, not 600, so the lede lands on the
front card's left edge and the h2 gets the 514px it needs to stay on one line.

**The countdown.** The active row draws a 2px signal-blue bar along its bottom
edge, filling over `DELAY` (3.4s), and the swap fires when it's full. It is a
GSAP tween (`countdown()`) writing `--cs-p` on the list, read by
`.cs-row.is-active::after`. There is no `setInterval` any more. `sync()` runs or
holds it from three flags: `_hover` (pointer on the deck, which pauses and
resumes mid-bar), `_held` (a row is holding a card, and release starts a fresh
bar), and `_seen` (an IntersectionObserver at 0.35, so the first bar starts
when the visitor arrives). `swap()` lights the next row, commits `_order` and
starts its bar at the `promote` label, where the next card starts forward, not
at the end of the timeline. That way a resize or a row hover that kills the
timeline later still sees the right order. `onResize` calls `sync()` because a
swap killed before `promote` never started the next bar. Verified in headless
Chrome: rows change every ~3.8s (3.4 bar + 0.4 to promote), a row hover holds
with the bar at 0, the deck hover freezes the bar, and it pauses off screen. No
x-overflow from 320 to 1440.

Four landmines already fixed here — don't reintroduce them:

1. **GSAP folds `skewY` into rotation + skewX** when it parses an existing
   transform. A CSS `skewY()` on `.cs-card` becomes a baseline GSAP can never
   clear, so `skewY: 0` silently does nothing on mobile. Let GSAP own the skew.
2. **Each `.cs-row` is its own grid**, so an `auto` column resizes the `1fr`
   columns per row. That is safe now only because the tag sits *under* the name
   in the same `1fr` column (`grid-template-areas`). Give the tag its own column
   again and the metric column must go back to a fixed width.
3. **`.cs-stage` needs `overflow: hidden`** — the swapping card falls 520px and
   would otherwise sweep over whatever is below the stage (the logo bar, or
   the index once the columns stack).
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

## The logo bar (`index.html`)

"Trusted with the work at", under the project section. Real logos since Oct
2026, from files Farhad supplied, except Trio:

| File | Notes |
|---|---|
| `logo-digikala.png` | Persian wordmark, as supplied |
| `logo-keshavarzi.png` | Emblem, trimmed from a 500px canvas, 110px tall |
| `logo-sharif.png` | Supplied white-on-transparent, **recoloured to ink** so it shows on the light page |
| `logo-trio.svg` | Paths from trio.so's own header logo (single colour, ink here). Trio is SternX's product, so it stands in for "SternX Technology" |
| `logo-zeero.png` | Mark + Persian wordmark, trimmed |

Circle One has no logo yet. It is a type-only mark in the same slot, with no
caption. Every logo sits in a 44px slot. Each img's inline height is set by
eye for equal visual weight, not equal boxes. Logos are greyscale at 60%
at rest and full colour on hover. The mono caption carries the name, because
three of the marks are Persian-only, so each `alt` is empty. If a phone
squashes a logo, look for a `max-width` on `.lg`: it belongs on the caption.

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

One project has **no screenshots at all** (Safes), and it uses the hatch
placeholder. See `assets/MISSING-ASSETS.md`.

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

### Agrino's screens are WebP too

The 13 `assets/agrino-*.webp` files (about 0.9 MB in all) came from Farhad in Oct
2026, in three batches. The third was `consult-request`, which he asked for as
the businesses block's example. Everything that arrived as WebP is copied byte-for-byte.
The four PNGs (`my-ads`, `channel`, `business-clan`, `farmers-office`) were
converted with `cwebp -q 88`. `agrino-ad-flow.webp` is a whole conversation as
one strip, only 274px wide, so it sits in a 560px scroll frame at about its
native width. Give it a wider column and it goes soft. The second batch is a
newer chat style (robot avatar, one "all products" pill), and its three price
screens (`prices`, `wheat-price`, `price-alert`) are the hero. The older-style
market-bot screens are the four numbered steps below it, and `market-bot` is
also the home card-stack image. A wheat-bot intro screen from the first batch
was dropped when the hero changed.

### Vendora's screens are WebP too

The 8 `assets/vendora-*.webp` files (about 0.6 MB) came from Farhad in Oct
2026 as WebP at 2000px or less. Six are copied byte-for-byte. Two were cut
(q88) from the supplied originals, which are not in the repo:

- `vendora-media-picker` arrived with the dialog's 20% black scrim baked in as
  alpha around it. It is cropped to the dialog's edge, and the scrim is taken
  back out of the anti-aliased corner pixels (alpha unmixed, colour
  un-premultiplied), so the corners are transparent. The CSS
  `border-radius: 0.64% / 0.94%` (its 10px corner of 1564×1067) only shapes
  the shadow. It is the hero's front layer, over `vendora-inventory`, which
  is also the home card-stack image.
- `vendora-filter-states` has 8px off the top, where a Figma frame label was
  cut in half by the capture.

`filter-states` and `save-view` are Figma boards, not screens. Their frames
are too small to read on the page, so the captions carry the detail. The two
pairs below them (collection + variant, sign-up + settings) sit in grid
columns set to the images' aspect ratios (`900fr 958fr`, `1600fr 1538fr`),
which makes each pair exactly the same height. Re-cut one and its `fr` has to
change with it. The screens carry Greek sample data (Athens, Thessaloniki,
a Greek business entity), while the copy says "European launch". Farhad is
fine with Greece showing there (Oct 2026), so leave the screens as they are.

### Sharif AICT's screens are WebP too

The 7 `assets/sharif-*.webp` files (about 0.4 MB) are the National AI
Platform, from Farhad in Oct 2026 as 2000px WebP. Persian and right to left,
so the page's captions say "on the right" where an LTR page would say left.
Three are copied byte-for-byte. Four were cut (q88, the strip q90) from the
supplied originals, which are not in the repo:

- `sharif-infrastructure` is the top 1000px of 1300. The rest was empty canvas
  under the cards, and it set the hero's height, because the studio window is
  the lower layer. It is also the home card-stack image (`object-position:
  top right`, so the sidebar and its logo show).
- `sharif-support-panel` is cut tight to the dark help panel, out of a capture
  of the infrastructure page with the panel open. The CSS `border-radius:
  1.5% / 1.9%` is its ~11px corner as a share of 725×573.
- `sharif-org-picker` is the middle 722×854 of a mostly white 2000px frame.
- `sharif-handoff-signup` loses its right 12px, a Figma scrollbar.

The hero's studio sits at `margin-top: calc(32.7% + 32px + 18px)`. That is
the prompt's depth (44% down a 1300/2000 image, scaled by the back window's
width over the front's, 8/7), plus the 32px window bar and clearance. A plain
% put the studio over the prompt below ~800px, because the bar doesn't shrink.
The phone layout has its own numbers. Swap either hero image and both have to
be re-derived. Both windows reveal at `data-gsap-start="top bottom"`, so a
window that is half in view on arrival doesn't sit invisible until a scroll.

`sharif-handoff-signup` is a 4.7:1 Figma board. It holds 880px and scrolls
sideways in its frame below ~940px, and the "four states" list beside the org
picker spells out what its Persian frame labels and notes say. The screens'
sample data (olivia@untitledui.com, a university seal as the org avatar,
`Playload` on the code tabs) is in Farhad's files as supplied.

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
