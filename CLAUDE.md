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
  ripple canvas), `About.html` (fluid canvas + image fallback), `How-I-Work.html`
  (prism grid).

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
