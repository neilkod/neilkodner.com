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

    // Reserve space for toolbar (top) and info panel (bottom).
    // Collapse the bottom panel on short viewports (landscape mobile) so
    // the photo isn't squeezed to a sliver.
    paddingFn: (viewportSize) => ({
      top:    44,
      bottom: viewportSize.y < 500 ? 80 : 200,
      left:   0,
      right:  0,
    }),
  });

  lightbox.on('uiRegister', () => {
    // Note: PhotoSwipe v5 registers a built-in counter (name:'counter',
    // order:5) — no custom registration needed.

    // ── Info panel: caption + EXIF table ────────────────────
    lightbox.pswp.ui.registerElement({
      name:     'caption',
      order:    9,
      isButton: false,
      appendTo: 'root',
      onInit(el, pswp) {
        el.className = 'pswp__caption pswp-info';

        const LABELS = {
          camera:        'Camera',
          lens:          'Lens',
          focal_length:  'Focal length',
          aperture:      'Aperture',
          shutter_speed: 'Shutter',
          iso:           'ISO',
        };
        const ORDER = ['camera', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso'];

        const refresh = () => {
          const elem    = pswp.currSlide?.data?.element;
          const caption = elem?.getAttribute('data-pswp-caption') || '';
          const exifRaw = elem?.getAttribute('data-pswp-exif') || '';

          let captionHtml = caption
            ? `<p class="pswp-caption">${caption}</p>`
            : '';

          let exifHtml = '';
          if (exifRaw) {
            try {
              const exif = JSON.parse(exifRaw);
              const rows = ORDER
                .filter(k => exif[k])
                .map(k => `<dt>${LABELS[k]}</dt><dd>${exif[k]}</dd>`)
                .join('');
              if (rows) exifHtml = `<dl class="pswp-exif-table">${rows}</dl>`;
            } catch { /* malformed JSON — skip */ }
          }

          el.innerHTML = captionHtml + exifHtml;
        };

        pswp.on('change', refresh);
      },
    });

    // ── Share / permalink button ─────────────────────────────
    lightbox.pswp.ui.registerElement({
      name:     'share-button',
      order:    8,
      isButton: true,
      appendTo: 'bar',
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
               <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
             </svg>`,
      onInit(el, pswp) {
        el.setAttribute('aria-label', 'Copy link to this photo');
        el.setAttribute('title', 'Copy link');

        const LINK_SVG  = el.innerHTML;
        const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;

        // Keep URL hash in sync with current photo
        pswp.on('change', () => {
          const anchor = pswp.currSlide?.data?.element;
          const href   = anchor?.getAttribute('href') || '';
          const stem   = href.split('/').pop().replace(/\.[^.]+$/, '');
          if (stem) {
            history.replaceState(null, '', `${location.pathname}${location.search}#${stem}`);
          }
        });

        // Restore clean URL when lightbox closes
        pswp.on('close', () => {
          history.replaceState(null, '', `${location.pathname}${location.search}`);
        });

        el.addEventListener('click', () => {
          // Build a /photo/ permalink rather than the album+hash URL so
          // shared links land on the dedicated page with full og:image support.
          const anchor   = pswp.currSlide?.data?.element;
          const href     = anchor?.getAttribute('href') || '';
          const filename = href.split('/').pop();
          const sp       = new URLSearchParams(location.search);
          const photoUrl = new URL('/photo/', location.origin);
          photoUrl.searchParams.set('cat',   sp.get('cat')   || '');
          photoUrl.searchParams.set('album', sp.get('album') || '');
          photoUrl.searchParams.set('photo', filename);
          const url = photoUrl.toString();

          const confirm = () => {
            el.innerHTML = CHECK_SVG;
            el.setAttribute('title', 'Copied!');
            setTimeout(() => {
              el.innerHTML = LINK_SVG;
              el.setAttribute('title', 'Copy link');
            }, 2000);
          };
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(confirm).catch(() => prompt('Copy this link:', url));
          } else {
            prompt('Copy this link:', url);
          }
        });
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
  // For flat categories the album title equals the category name —
  // use the category name as the page title so it reads naturally.
  const pageTitle = cat.flat ? cat.name : (album.title || albumId);
  document.title = `${pageTitle} — Neil Kodner`;

  const breadcrumbCat = document.getElementById('breadcrumb-cat');
  if (breadcrumbCat) {
    if (cat.flat) {
      // Flat: breadcrumb reads "Photography / Aviation" — no album level.
      breadcrumbCat.textContent = cat.name;
      breadcrumbCat.href = `/photography/`;
      breadcrumbCat.setAttribute('aria-current', 'page');
      // Hide the separators and album crumb that follow
      const crumbItems = breadcrumbCat.closest('ol')?.querySelectorAll('li');
      if (crumbItems) {
        // li[0]=Photography li[1]=/ li[2]=Category li[3]=/ li[4]=Album
        crumbItems[3]?.remove();
        crumbItems[4]?.remove();
      }
    } else {
      breadcrumbCat.textContent = cat.name;
      breadcrumbCat.href = `/photography/?cat=${catId}`;
    }
  }

  const titleEl = document.getElementById('album-title');
  if (titleEl) titleEl.textContent = pageTitle;

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

  const lb = initLightbox(grid);

  // If the URL contains a filename hash (e.g. #IMG_0042), open directly to that photo
  const hash = location.hash.slice(1);
  if (hash) {
    const items = [...grid.querySelectorAll('a[data-pswp-width]')];
    const idx = items.findIndex(a => {
      const href = a.getAttribute('href') || '';
      return href.split('/').pop().replace(/\.[^.]+$/, '') === decodeURIComponent(hash);
    });
    if (idx >= 0) lb.loadAndOpen(idx);
  }
}
