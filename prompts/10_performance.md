# Prompt 10 — Performance and Layout Stability

Improve image loading performance and prevent layout shift across the site.

## Lazy loading

In `gallery.js` `renderAlbumPage()`, use `entries()` to track the photo index:

```js
for (const [i, photo] of album.photos.entries()) {
  img.loading  = i === 0 ? 'eager' : 'lazy';
  img.decoding = 'async';
}
```

The first image should be eager (it's above the fold); the rest should be lazy.

Apply the same pattern everywhere thumbnails are rendered (category tiles, album tiles, hero slides).

## Layout stability — aspect ratio reservation

Before an image loads, the browser doesn't know its size and can't reserve space for it. This causes layout shift. Fix it by setting `aspect-ratio` on each image from the catalog's stored dimensions:

```js
if (photo.width && photo.height) {
  img.style.aspectRatio = `${photo.width} / ${photo.height}`;
}
```

Also ensure the CSS has `height: auto` on grid images so the aspect-ratio reservation works:

```css
.album-grid-item img {
  width: 100%;
  height: auto;
}
```

## Responsive images (srcset) — PhotoSwipe

Add a `buildPswpSrcset()` helper that builds a PhotoSwipe `data-pswp-srcset` string. For now it produces a single entry (full-res), but it reads an optional `photo.sizes[]` array from the catalog so future size variants are automatically included without changing the JS:

```js
function buildPswpSrcset(baseUrl, photo, fullPath) {
  const fullEntry = `${fullUrl(baseUrl, fullPath)} ${photo.width}w`;
  if (!photo.sizes?.length) return fullEntry;
  const variantEntries = photo.sizes.map(s => `${fullUrl(baseUrl, s.path)} ${s.w}w`);
  return [...variantEntries, fullEntry].join(', ');
}
```

Set `data-pswp-srcset` on each `<a>` element. PhotoSwipe uses this to pick the best resolution for the current screen.

## Fade-in animation

The `fadeInOnLoad(img)` in `app.js` adds a `.loaded` class when the image loads. The CSS transition makes it fade from opacity 0 to 1:

```css
.album-grid-item img,
.album-tile img,
.category-tile img {
  opacity: 0;
  transition: opacity 0.3s ease;
}
.album-grid-item img.loaded,
.album-tile img.loaded,
.category-tile img.loaded {
  opacity: 1;
}
```
