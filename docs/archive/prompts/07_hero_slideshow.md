# Prompt 07 — Hero Slideshow

Create `hero.js` — the module that powers the full-viewport hero image slideshow on the homepage.

## Behavior

- Read `catalog.hero[]` from the catalog (already fetched by `app.js`)
- Build one `.hero-slide` `<div>` per image, each containing an `<img>`
- Append all slides to the `#hero-slides` container (replacing the static placeholder)
- Show only one slide at a time using an `is-active` class; CSS handles the crossfade transition
- First slide activates only once its image has loaded (no blank flash)
- Cycle through slides with a random delay between 8–12 seconds per slide (randomness prevents a robotic rhythm)
- If there's only one hero image, skip the cycling logic entirely

## CSS for the slideshow (add to style.css)

- `.hero` — `position: relative; height: 100svh; overflow: hidden`
- `.hero-slide` — `position: absolute; inset: 0; opacity: 0; transition: opacity 1.8s ease`
- `.hero-slide.is-active` — `opacity: 1`
- `.hero-slide img` — `width: 100%; height: 100%; object-fit: cover`
- `.hero-overlay` — positioned over the slides with the title text, `z-index` above slides
- `.hero-placeholder` — a solid dark fallback color shown before JS runs

## Performance

- First image: `fetchpriority="high"`, `loading="eager"`
- All other images: `loading="lazy"`, `decoding="async"`
- Set `width` and `height` attributes on each `<img>` from catalog data (helps the browser allocate space)
- Images are decorative: `alt=""` and `aria-hidden="true"` on the container
