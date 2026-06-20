/**
 * app.js — catalog fetch, URL helpers, shared tile rendering
 */

const CATALOG_URL = '/catalog.json';
let _catalog = null;

export async function fetchCatalog() {
  if (_catalog) return _catalog;
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  _catalog = await res.json();
  return _catalog;
}

// ─── URL helpers ──────────────────────────────────────────────

export const fullUrl  = (base, path) => `${base}/${path}`;

/**
 * Map a source image path to its generated thumbnail URL.
 *
 * CONTRACT (must match scripts/build_catalog.py `thumb_key_for`):
 * thumbnails are WebP at `_thumbs/{path-with-extension-swapped-to-.webp}`.
 * Cover fields in the catalog carry the real original key (e.g.
 * "aviation/Cover.JPG"); we swap only the final extension to ".webp".
 */
export const thumbUrl = (base, path) => {
  const webpPath = path.replace(/\.[^./]+$/, '.webp');
  return `${base}/_thumbs/${webpPath}`;
};

/**
 * Point an <img> at its WebP thumbnail, falling back ONCE to the legacy
 * JPEG thumb (original extension) if the WebP isn't there.
 *
 * This covers the one-time WebP migration window: after this code deploys,
 * the frontend asks for `.webp` thumbs, but R2 only has them once the catalog
 * Action has regenerated. Until then (or if a regen lags/fails) the original
 * `_thumbs/{path}` JPEG still serves, so nothing breaks.
 */
export function setThumb(img, base, path) {
  img.src = thumbUrl(base, path);
  img.addEventListener('error', () => {
    const legacy = `${base}/_thumbs/${path}`;
    if (img.src !== legacy) img.src = legacy;   // try the pre-WebP thumb once
  }, { once: true });
}

/**
 * Slugify a category or album id for a pretty URL path segment.
 *
 * CONTRACT (must match scripts/build_seo.py `slugify`): lowercase, every run
 * of non-alphanumeric chars → a single hyphen, trimmed. So the hrefs built
 * here resolve to the static per-album pages that build_seo.py generates under
 * /photography/<cat-slug>/<album-slug>/.
 */
export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Pretty canonical album URL: /photography/<cat-slug>/<album-slug>/ */
export const albumPath = (catId, albumId) =>
  `/photography/${slugify(catId)}/${slugify(albumId)}/`;

// ─── Image loading ────────────────────────────────────────────

/** Add .loaded class (triggers CSS opacity fade) once the image paints. */
export function fadeInOnLoad(img) {
  if (img.complete && img.naturalWidth > 0) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  }
}

// ─── Category grid rendering ──────────────────────────────────

/**
 * Build category tiles dynamically from catalog.categories.
 * Pass showLabel: true on the photography index to render the "Category" label.
 */
export function renderCategoryGrid(catalog, container, { showLabel = false } = {}) {
  container.innerHTML = '';
  for (const cat of catalog.categories) {
    const href = cat.flat
      ? albumPath(cat.id, cat.id)
      : `/photography/?cat=${cat.id}`;

    const a = document.createElement('a');
    a.className = 'category-tile';
    a.href = href;

    a.appendChild(Object.assign(document.createElement('div'), { className: 'tile-bg' }));
    a.appendChild(Object.assign(document.createElement('div'), { className: 'category-tile-border' }));

    const info = document.createElement('div');
    info.className = 'category-tile-info';
    if (showLabel) {
      const p = Object.assign(document.createElement('p'), { className: 'label', textContent: 'Category' });
      p.style.marginBottom = '0.25rem';
      info.appendChild(p);
    }
    info.appendChild(Object.assign(document.createElement('h3'), { textContent: cat.name }));
    a.appendChild(info);

    if (cat.cover) {
      const img = document.createElement('img');
      setThumb(img, catalog.baseUrl, cat.cover);
      img.alt      = cat.name;
      img.loading  = 'lazy';
      img.decoding = 'async';
      fadeInOnLoad(img);
      a.prepend(img);
    }

    container.appendChild(a);
  }
}

// ─── Date formatting ──────────────────────────────────────────

/** "2024-07" → "July 2024",  "2024" → "2024" */
export function formatDate(str) {
  if (!str) return '';
  const [y, m] = str.split('-');
  if (!m) return y;
  return new Date(+y, +m - 1).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long',
  });
}

// ─── Album tile creation ──────────────────────────────────────

function makeAlbumTile(album, catId, catName, baseUrl) {
  const a = document.createElement('a');
  a.className = 'album-tile';
  a.href = albumPath(catId, album.id);

  const cover = document.createElement('div');
  cover.className = 'album-tile-cover';

  const bg = document.createElement('div');
  bg.className = 'tile-bg';

  const border = document.createElement('div');
  border.className = 'tile-accent-border';

  cover.appendChild(bg);
  cover.appendChild(border);

  if (album.cover) {
    const img = document.createElement('img');
    setThumb(img, baseUrl, album.cover);
    img.alt      = album.title || album.id;
    img.loading  = 'lazy';
    img.decoding = 'async';
    fadeInOnLoad(img);
    cover.appendChild(img);
  }

  a.appendChild(cover);

  const sub = [];
  if (catName) sub.push(catName);
  if (album.date) sub.push(formatDate(album.date));

  const meta = document.createElement('div');
  meta.className = 'album-tile-meta';
  meta.innerHTML = `
    <span class="album-tile-title">${album.title || album.id}</span>
    <span class="album-tile-sub">${sub.join(' · ')}</span>
  `.trim();

  a.appendChild(meta);
  return a;
}

// ─── Latest Albums strip ──────────────────────────────────────

/** Sort all albums newest-first; return top n. */
export function getLatestAlbums(catalog, n = 4) {
  const all = [];
  for (const cat of catalog.categories) {
    for (const album of cat.albums) {
      all.push({ ...album, categoryId: cat.id, categoryName: cat.name });
    }
  }
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return all.slice(0, n);
}

/** Populate #latest-albums with the four newest albums. */
export function renderLatestAlbums(catalog) {
  const container = document.getElementById('latest-albums');
  if (!container) return;

  const albums = getLatestAlbums(catalog, 4);
  container.innerHTML = '';

  if (albums.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-muted);grid-column:1/-1">No albums yet.</p>';
    return;
  }

  albums.forEach(a =>
    container.appendChild(makeAlbumTile(a, a.categoryId, a.categoryName, catalog.baseUrl))
  );
}

// ─── Category album grid ──────────────────────────────────────

/** Populate a container with album tiles for the given category id. */
export function renderAlbumGrid(catalog, catId, container) {
  const cat = catalog.categories.find(c => c.id === catId);

  if (!cat) {
    container.innerHTML = '<p style="color:var(--color-text-muted)">Category not found.</p>';
    return;
  }
  if (!cat.albums.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted)">No albums yet.</p>';
    return;
  }

  container.innerHTML = '';
  cat.albums.forEach(album =>
    container.appendChild(makeAlbumTile(album, cat.id, '', catalog.baseUrl))
  );
}
