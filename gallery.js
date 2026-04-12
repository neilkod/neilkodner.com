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

  lightbox.on('uiRegister', () => {
    // Note: PhotoSwipe v5 registers a built-in counter (name:'counter',
    // order:5) — no custom registration needed.

    // ── Caption + EXIF ──────────────────────────────────────
    lightbox.pswp.ui.registerElement({
      name:      'caption',
      order:     9,
      isButton:  false,
      appendTo:  'wrapper',
      onInit(el, pswp) {
        const refresh = () => {
          const elem    = pswp.currSlide?.data?.element;
          const caption = elem?.getAttribute('data-pswp-caption') || '';
          const exifRaw = elem?.getAttribute('data-pswp-exif') || '';

          let exifHtml = '';
          if (exifRaw) {
            try {
              const exif  = JSON.parse(exifRaw);
              const parts = [
                exif.camera,
                exif.lens,
                exif.focal_length,
                exif.aperture,
                exif.shutter_speed,
                exif.iso,
              ].filter(Boolean);
              if (parts.length) {
                exifHtml = `<p class="pswp-exif-text">${parts.join(' · ')}</p>`;
              }
            } catch { /* malformed JSON — skip */ }
          }

          el.innerHTML = caption || exifHtml
            ? `${caption ? `<p class="pswp-caption-text">${caption}</p>` : ''}${exifHtml}`
            : '';
        };
        pswp.on('change', refresh);
      },
    });
  });

  lightbox.init();
  return lightbox;
}

// ─── Srcset builder ───────────────────────────────────────────

/**
 * Build a PhotoSwipe srcset string for a photo.
 *
 * Reads the optional `photo.sizes` array written by the catalog pipeline:
 *   [{ w: 800, path: "_resized/800/aviation/album/img.jpg" },
 *    { w: 1600, path: "_resized/1600/aviation/album/img.jpg" }]
 *
 * The full-res URL is always appended as the largest entry.
 * Falls back to full-res only when `photo.sizes` is absent or empty,
 * preserving backward compatibility with the current single-size catalog.
 *
 * `w` descriptors are the actual pixel widths of each variant so the
 * browser (and PhotoSwipe) can pick the closest fit for the viewport.
 */
function buildPswpSrcset(baseUrl, photo, fullPath) {
  const fullEntry = `${fullUrl(baseUrl, fullPath)} ${photo.width}w`;
  if (!photo.sizes?.length) return fullEntry;

  const variantEntries = photo.sizes.map(s => `${fullUrl(baseUrl, s.path)} ${s.w}w`);
  return [...variantEntries, fullEntry].join(', ');
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

  for (const [i, photo] of album.photos.entries()) {
    const path = `${album.folder}/${photo.filename}`;

    const a = document.createElement('a');
    a.className = 'album-grid-item';
    // href = full-res URL (PhotoSwipe fallback if srcset is unsupported)
    a.href = fullUrl(catalog.baseUrl, path);
    // Dimensions are always the full-res size; PhotoSwipe uses them for
    // aspect-ratio layout regardless of which srcset entry it loads.
    a.setAttribute('data-pswp-width',  photo.width);
    a.setAttribute('data-pswp-height', photo.height);
    a.setAttribute('data-pswp-srcset', buildPswpSrcset(catalog.baseUrl, photo, path));
    if (photo.caption) a.setAttribute('data-pswp-caption', photo.caption);
    if (photo.exif && Object.keys(photo.exif).length) {
      a.setAttribute('data-pswp-exif', JSON.stringify(photo.exif));
    }

    const img = document.createElement('img');
    img.src      = thumbUrl(catalog.baseUrl, path);
    img.alt      = photo.caption || '';
    img.loading  = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    // Reserve space before image loads; guard against missing dimensions
    if (photo.width && photo.height) {
      img.style.aspectRatio = `${photo.width} / ${photo.height}`;
    }

    fadeInOnLoad(img);
    a.appendChild(img);
    grid.appendChild(a);
  }

  initLightbox(grid);
}
