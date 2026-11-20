# Prompt 16 — Hero Image Orientation Filtering

The hero slideshow contains a mix of landscape and portrait photos. On a phone held vertically, landscape images letterbox badly (thin horizontal strips). On a desktop monitor, portrait images pillarbox (narrow bands). Each orientation looks best when matched to the viewport.

## Desired behavior

- On a **wide viewport** (landscape screen): show only landscape hero images (`width >= height`)
- On a **tall viewport** (portrait screen): show only portrait hero images (`height > width`)
- If the filtered set for the current orientation is empty, fall back to the full set

## Implementation in hero.js

Check orientation once at page load (before building slides). No resize listener needed — users don't typically rotate the screen while on the homepage:

```js
const isPortraitViewport = window.innerHeight > window.innerWidth;

const landscape  = catalog.hero.filter(h => h.width >= h.height);
const portrait   = catalog.hero.filter(h => h.height > h.width);

const heroImages = (isPortraitViewport ? portrait : landscape).length
  ? (isPortraitViewport ? portrait : landscape)
  : catalog.hero;
```

Then use `heroImages` instead of `catalog.hero` when building slides.

## R2 upload guidance

For best results, keep both orientations in `_hero/`:
- Upload 2–4 landscape images for desktop visitors
- Upload 2–4 portrait images for mobile visitors

The build script reads `width` and `height` from Pillow during the first download, so orientation detection is automatic — no manual tagging required.
