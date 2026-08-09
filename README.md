# Farhad Shariatmadari — Portfolio

Lead Product & Experience Designer. Static site, no build step.

## Local preview

```bash
npx serve -l 4321 .
```

Then open http://localhost:4321

## Structure

- `index.html` — home (project card stack + project index)
- `Work.html`, `About.html`, `How-I-Work.html`, `Contact.html`
- Case studies: `Trio`, `Behinto`, `DigiKala-Mehr`, `Safes`, `Medio`, `Agrino`, `Zeero`, `Vendora`, `Sharif-AICT`
- `assets/` — product screenshots
- `support.js` — page runtime (renders the templates; loads React from a CDN)
- `fx.js` — cursor particle effect

## Deploying

Pushing to `main` publishes automatically via GitHub Pages.
