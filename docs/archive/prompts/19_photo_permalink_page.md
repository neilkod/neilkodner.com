# Prompt 19 — Photo Permalink Page and Share Button

Add a dedicated single-photo page so that any photo can be linked to directly, with full Open Graph metadata for rich previews when shared on social media.

## photo/index.html

Create `photo/index.html` — an HTML shell with no photo content in the markup (JS fills everything in):

- Site navigation bar (same as other pages, no `aria-current`)
- A `.photo-breadcrumb` element for the dynamically-built breadcrumb
- A `#photo-loading` element shown while the catalog loads
- A `#photo-error` element (hidden by default) for error messages
- A `#photo-article` element (hidden by default) that contains:
  - A `<figure>` with `#photo-figure-inner` — JS injects the `<img>` here
  - A `<figcaption id="photo-caption">` for the caption text
  - A `<div id="photo-meta">` for the EXIF `<dl>` table
  - A `<nav id="photo-nav">` for previous / next / count navigation
- Open Graph `<meta>` tags in `<head>` — `og:title`, `og:image`, `og:url`, `og:description` — JS updates these at runtime
- `<script type="module">` that imports `renderPhotoPage` from `/photo.js` and calls it

## photo.js

Create `photo.js` — an ES module that reads `?cat=`, `?album=`, and `?photo=` from the URL:

1. **Fetch catalog** via `fetchCatalog()` from `app.js`
2. **Find the photo** in `catalog.categories → albums → photos`; show error if not found
3. **Set page title** — use the caption if present, otherwise `"Photo N — Album Title"`
4. **Update Open Graph meta** — `og:title`, `og:image` (full-res URL), `og:url`, `og:description`
5. **Render breadcrumb** — for album-based categories: `Photography / Category / Album / Photo N`;
   for flat categories collapse to: `Photography / Category / Photo N`
6. **Inject the image** into `#photo-figure-inner`:
   - `loading="eager"`, `fetchPriority="high"`, `decoding="async"`
   - Set `width`, `height`, and `style="aspect-ratio: W / H"` from catalog dimensions
7. **Render caption** in `#photo-caption` (hide the element if no caption)
8. **Render EXIF table** in `#photo-meta` — same `<dl class="photo-exif-table">` structure and EXIF_LABELS/EXIF_ORDER constants as in `gallery.js` (see Prompt 11)
9. **Render prev/next nav** in `#photo-nav`:
   - Previous and Next links using `makePhotoUrl(catId, albumId, filename)` helper
   - Disabled spans (not links) when at the first or last photo
   - A count in the middle: `"3 / 12"`

## Share button in gallery.js (lightbox)

Register a second custom UI element — the share/permalink button — alongside the caption element in `lightbox.on('uiRegister')`:

```js
lightbox.pswp.ui.registerElement({
  name:     'share-button',
  order:    8,
  isButton: true,
  appendTo: 'bar',
  html: `<svg ...link icon...>`,
  onInit(el, pswp) {
    el.setAttribute('aria-label', 'Copy link to this photo');

    el.addEventListener('click', () => {
      // Build a /photo/ URL from the current slide's data
      const anchor   = pswp.currSlide?.data?.element;
      const filename = anchor?.getAttribute('href')?.split('/').pop();
      const sp       = new URLSearchParams(location.search);
      const photoUrl = new URL('/photo/', location.origin);
      photoUrl.searchParams.set('cat',   sp.get('cat'));
      photoUrl.searchParams.set('album', sp.get('album'));
      photoUrl.searchParams.set('photo', filename);

      // Copy to clipboard with visual feedback (link icon → checkmark → back)
      navigator.clipboard.writeText(photoUrl.toString())
        .then(() => { /* show check SVG for 2s */ })
        .catch(() => prompt('Copy this link:', photoUrl.toString()));
    });
  },
});
```

Use a link SVG icon normally and switch to a checkmark SVG for 2 seconds after a successful copy. Fall back to `prompt()` if the Clipboard API is unavailable.

## Hash-based deep-linking in gallery.js

When a user is viewing the lightbox, keep the URL hash in sync with the current photo so the browser URL can be bookmarked or shared:

```js
// Inside the share-button onInit (pswp is available there):
pswp.on('change', () => {
  const anchor = pswp.currSlide?.data?.element;
  const href   = anchor?.getAttribute('href') || '';
  const stem   = href.split('/').pop().replace(/\.[^.]+$/, '');  // filename without extension
  if (stem) history.replaceState(null, '', `${location.pathname}${location.search}#${stem}`);
});

pswp.on('close', () => {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
});
```

After `initLightbox()` returns, check if the page URL has a hash and open directly to that photo:

```js
const hash = location.hash.slice(1);
if (hash) {
  const items = [...grid.querySelectorAll('a[data-pswp-width]')];
  const idx = items.findIndex(a => {
    const href = a.getAttribute('href') || '';
    return href.split('/').pop().replace(/\.[^.]+$/, '') === decodeURIComponent(hash);
  });
  if (idx >= 0) lb.loadAndOpen(idx);
}
```

## URL structure

Photo permalink URLs look like:
```
/photo/?cat=aviation&album=aviation&photo=img001.jpg       ← flat category
/photo/?cat=hockey&album=sharks-vs-kings-jan-2025&photo=img042.jpg  ← album-based
```

These are the URLs the share button copies to the clipboard — not the album+hash URLs.
