# neilkodner.com

Photography portfolio. Eleventy 3 static site, deployed to GitHub Pages by
`.github/workflows/deploy.yml` on push to `main` (Pages source must be "GitHub Actions").

## Development

`npm install`, then `npm start` (dev server on :8080) or `npm run build` (output in `_site/`).
Node 20+. No client-side framework; the only script is `src/js/copy.js`.

## Content

- Photos: `src/photos/<gallery>/*.jpg`, Lightroom exports (sRGB, 3000 px long edge, no GPS).
- Order, captions, alt text: `src/_data/galleries/<gallery>.yml`. `confirm:` keys are notes
  for Neil and are never rendered.
- Homepage photo choices are hard-coded in `src/index.njk`.
- Never invent captions, credits, clients, dates or biography. Capture dates come from the
  photo files. Anything unknown stays out or goes in a `confirm:` note.

## Design rules (see docs/redesign/index.html)

- Two typefaces only: Newsreader (voice) and Schibsted Grotesk (captions, nav). Self-hosted in `src/fonts/`.
- Colours are the tokens at the top of `src/css/site.css`. One accent (Blueline), interactive states only.
- Photographs are never cropped, rounded, bordered, shadowed or overlaid with text.
  No image taller than the viewport. No all-caps text, icons, cards, lightbox or scroll animation.

## History

The previous R2/catalog site and its docs were removed; commit `8869580` is its last version. Never use
it as a guide to the current code. `docs/redesign/` holds the brief, the proposal and a list of where
the build differs.

## Generated, do not edit

- `_site/` (build output, gitignored)
