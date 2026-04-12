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
export const thumbUrl = (base, path) => `${base}/_thumbs/${path}`;

// ─── Image loading ────────────────────────────────────────────

/** Add .loaded class (triggers CSS opacity fade) once the image paints. */
export function fadeInOnLoad(img) {
  if (img.complete && img.naturalWidth > 0) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  }
}

// ─── Tile hydration ───────────────────────────────────────────

/**
 * Inject cover images into all .category-tile elements.
 * Reads the category id from the existing href (?cat=<id>) —
 * no data attributes needed in the HTML.
 */
export function hydrateCategoryTiles(catalog) {
  document.querySelectorAll('.category-tile').forEach(tile => {
    const href = tile.getAttribute('href') || '';
    let catId;
    try {
      catId = new URL(href, location.origin).searchParams.get('cat');
    } catch { return; }

    const cat = catalog.categories.find(c => c.id === catId);
    if (!cat?.cover) return;

    // Don't inject twice
    if (tile.querySelector('img')) return;

    const img = document.createElement('img');
    img.src     = thumbUrl(catalog.baseUrl, cat.cover);
    img.alt     = cat.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    fadeInOnLoad(img);
    // prepend so it sits behind the absolute-positioned overlay divs
    tile.prepend(img);
  });
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
  a.href = `/album.html?cat=${catId}&album=${album.id}`;

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
    img.src      = thumbUrl(baseUrl, album.cover);
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
