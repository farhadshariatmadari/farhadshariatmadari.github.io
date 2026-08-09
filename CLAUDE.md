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
- The 9 case-study pages still use the old static grid background.

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

24 PNGs in `assets/`, already optimised (14.1 MB → 2.9 MB). If you add more:

```bash
sips --resampleWidth 2320 file.png            # only if wider than 2320
pngquant --quality=70-95 --skip-if-larger --strip --force --output f.png f.png
oxipng -o 2 --strip safe file.png
```

2320px is 2× the 1160px max render width, so it stays retina-sharp. **Always
eyeball the result** — pngquant is lossy and photo-heavy screenshots can band.

`About.html` has an automatic fallback: if `assets/farhad-sketch.png` is missing
the page shows a placeholder instead of a broken image, and restores itself when
the file returns.

Five projects have **no screenshots at all** (Safes, Medio, Agrino, Vendora,
Sharif AICT) and use the hatch placeholder — see `assets/MISSING-ASSETS.md`.

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
