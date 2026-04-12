/**
 * gallery.js — PhotoSwipe v5 lightbox + album page rendering
 */

import PhotoSwipeLightbox from 'https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.min.js';
import { fetchCatalog, fullUrl, thumbUrl, fadeInOnLoad, formatDate } from '/app.js';

// ─── Lightbox ─────────────────────────────────────────────────

/**
 * Attach a PhotoSwipe v5 lightbox to a gallery container.
 * Each child <a> must have:
 *   href               — full-resolution image URL
 *   data-pswp-width    — full image width  (px)
 *   data-pswp-height   — full image height (px)
 *   data-pswp-caption  — optional caption text
 */
export function initLightbox(galleryEl) {
  const lightbox = new PhotoSwipeLightbox({
    gallery:   galleryEl,
    children:  'a[data-pswp-width]',
    pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.min.js'),

    // Preload one slide ahead and one behind
    preload: [1, 2],

    bgOpacity: 0.95,
    showHideAnimationType: 'fade',
    zoomAnimationDuration:  250,
  });

  // ── Caption ──────────────────────────────────────────────────
  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name:      'caption',
      order:     9,
      isButton:  false,
      appendTo:  'wrapper',
      onInit(el, pswp) {
        const refresh = () => {
          const caption = pswp.currSlide?.data?.element
            ?.getAttribute('data-pswp-caption') || '';
          el.innerHTML = caption
            ? `<p class="pswp-caption-text">${caption}</p>`
            : '';
        };
        pswp.on('change', refresh);
      },
    });
  });

  lightbox.init();
  return lightbox;
}

// ─── Album page ───────────────────────────────────────────────

/**
 * Reads ?cat= and ?album= from the URL, fetches catalog.json,
 * then builds the photo grid and attaches the lightbox.
 */
export async function renderAlbumPage() {
  const params  = new URLSearchParams(location.search);
  const catId   = params.get('cat');
  const albumId = params.get('album');

  const loadingEl = document.getElementById('album-loading');
  const errorEl   = document.getElementById('album-error');

  const showError = (msg) => {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl)   { errorEl.hidden = false; errorEl.textContent = msg; }
  };

  if (!catId || !albumId) {
    showError('No album specified.');
    return;
  }

  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch (err) {
    showError('Could not load catalog.');
    return;
  }

  const cat   = catalog.categories.find(c => c.id === catId);
  const album = cat?.albums.find(a => a.id === albumId);

  if (!cat || !album) {
    showError('Album not found.');
    return;
  }

  if (loadingEl) loadingEl.hidden = true;

  // ── Page metadata ─────────────────────────────────────────
  document.title = `${album.title || albumId} — Neil Kodner`;

  const breadcrumbCat = document.getElementById('breadcrumb-cat');
  if (breadcrumbCat) {
    breadcrumbCat.textContent = cat.name;
    breadcrumbCat.href = `/photography/?cat=${catId}`;
  }

  const titleEl = document.getElementById('album-title');
  if (titleEl) titleEl.textContent = album.title || albumId;

  const metaEl = document.getElementById('album-meta');
  if (metaEl) {
    const parts = [];
    if (album.date)     parts.push(formatDate(album.date));
    if (album.location) parts.push(album.location);
    metaEl.textContent = parts.join(' · ');
  }

  // ── Photo grid ────────────────────────────────────────────
  const grid = document.getElementById('photo-grid');
  if (!grid) return;

  if (!album.photos?.length) {
    grid.innerHTML = '<p style="color:var(--color-text-muted)">No photos in this album yet.</p>';
    return;
  }

  for (const photo of album.photos) {
    const path = `${album.folder}/${photo.filename}`;

    const a = document.createElement('a');
    a.className = 'album-grid-item';
    // href = full-res URL (PhotoSwipe reads this)
    a.href = fullUrl(catalog.baseUrl, path);
    a.setAttribute('data-pswp-width',  photo.width);
    a.setAttribute('data-pswp-height', photo.height);
    if (photo.caption) a.setAttribute('data-pswp-caption', photo.caption);

    const img = document.createElement('img');
    img.src      = thumbUrl(catalog.baseUrl, path);
    img.alt      = photo.caption || '';
    img.loading  = 'lazy';
    img.decoding = 'async';
    // Reserve space to prevent layout shift
    img.style.aspectRatio = `${photo.width} / ${photo.height}`;

    fadeInOnLoad(img);
    a.appendChild(img);
    grid.appendChild(a);
  }

  initLightbox(grid);
}
