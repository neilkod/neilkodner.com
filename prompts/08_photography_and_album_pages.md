# Prompt 08 — Photography Page and Album Page

Build the two remaining HTML pages and their supporting JS.

## photography/index.html

The photography index shows either a category grid (default) or an album grid (when `?cat=` is in the URL).

- Navigation bar (same as homepage, `aria-current` on Photography link)
- `<h1>` that reads "Photography" by default, or the category name when drilling into a category
- Breadcrumb nav: "Photography" when at root, "Photography / Category Name" when in a category
- Category grid (`#category-grid`) — same `.category-tile` structure as the homepage; JS populates cover images
- Album grid (`#album-grid`) — hidden by default, shown when `?cat=` is present; JS populates it
- Loading / error states: a `#loading` element and an `#error` element
- A `<script type="module">` that reads `?cat=` from the URL and calls either `renderAlbumGrid()` or shows the category grid

## album.html

Single album view with a photo grid and PhotoSwipe lightbox.

- Navigation bar
- Breadcrumb: "Photography / Category / Album Title" — or just "Photography / Category" for flat categories
- `<h1 id="album-title">` — set by JS
- `<p id="album-meta">` — date and location, set by JS
- `<div id="photo-grid">` — JS builds the grid
- `#album-loading` and `#album-error` states
- Import `renderAlbumPage` from `gallery.js` and call it on load

## gallery.js — renderAlbumPage()

Reads `?cat=` and `?album=` from the URL, fetches the catalog, then:

1. Finds the category and album in the catalog
2. Sets the page title: for flat categories use the category name (no redundant album level); for album-based use the album title
3. Updates breadcrumbs appropriately — flat categories collapse the album level
4. Renders `#album-meta` with formatted date and location
5. For each photo, creates an `<a class="album-grid-item">` with:
   - `href` = full-res URL
   - `data-pswp-width` / `data-pswp-height` = photo dimensions
   - An `<img>` pointing to the thumbnail URL
   - `loading="eager"` on the first image, `loading="lazy"` on the rest
   - `decoding="async"` on all
   - `style="aspect-ratio: W / H"` to reserve layout space before load
6. Calls `initLightbox(grid)` after building the grid

## Album grid CSS

```css
#photo-grid {
  columns: 2;
  gap: 6px;
}
@media (min-width: 700px) {
  #photo-grid { columns: 3; }
}
.album-grid-item img {
  width: 100%;
  height: auto;
  display: block;
  margin-bottom: 6px;
}
```
