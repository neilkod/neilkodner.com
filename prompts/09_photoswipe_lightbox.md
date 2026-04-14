# Prompt 09 — PhotoSwipe v5 Lightbox

Add a full-screen photo viewer to the album page using PhotoSwipe v5.

## Requirements

- Use PhotoSwipe v5 loaded from CDN as an ES module (no npm, no bundler):
  ```js
  import PhotoSwipeLightbox from 'https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.min.js';
  ```
- The lightbox attaches to the `#photo-grid` container
- Each `<a data-pswp-width data-pswp-height>` in the grid is a slide
- Tapping/clicking a thumbnail opens the full-res image in the lightbox

## initLightbox(galleryEl) in gallery.js

```js
export function initLightbox(galleryEl) {
  const lightbox = new PhotoSwipeLightbox({
    gallery:  galleryEl,
    children: 'a[data-pswp-width]',
    pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.min.js'),
    preload: [1, 2],
    bgOpacity: 0.95,
    showHideAnimationType: 'fade',
  });
  lightbox.init();
  return lightbox;
}
```

## album.html — PhotoSwipe CSS

Add a `<link>` to the PhotoSwipe base CSS from CDN. Then add a `<style>` block in `album.html` for site-specific overrides:

- Style the built-in counter (`.pswp__counter`) to match the site font (Jost, light weight, small, slightly transparent)
- Style `.pswp__custom-caption` as a fixed-height bar at the bottom (80px), flex-centered, for caption and EXIF text
- `.pswp-caption-text` — white, normal weight, small
- `.pswp-exif-text` — dimmer, lighter weight, letter-spaced, smaller

## PhotoSwipe UI padding

Reserve space for the counter bar at top and caption bar at bottom so images never extend into those zones:

```js
padding: { top: 44, bottom: 80, left: 0, right: 0 }
```

This ensures the photo is always fully visible with UI chrome above and below.
