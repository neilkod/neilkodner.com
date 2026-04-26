/**
 * photo.js — dedicated single-photo page
 */

import { fetchCatalog, fullUrl, formatDate } from '/app.js';

const EXIF_LABELS = {
  camera:        'Camera',
  lens:          'Lens',
  focal_length:  'Focal length',
  aperture:      'Aperture',
  shutter_speed: 'Shutter',
  iso:           'ISO',
};
const EXIF_ORDER = ['camera', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso'];

function setMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function makePhotoUrl(catId, albumId, filename) {
  const u = new URL('/photo/', location.origin);
  u.searchParams.set('cat',   catId);
  u.searchParams.set('album', albumId);
  u.searchParams.set('photo', filename);
  return u.toString();
}

export async function renderPhotoPage() {
  const params   = new URLSearchParams(location.search);
  const catId    = params.get('cat');
  const albumId  = params.get('album');
  const filename = params.get('photo');

  const loadingEl = document.getElementById('photo-loading');
  const errorEl   = document.getElementById('photo-error');
  const articleEl = document.getElementById('photo-article');

  const showError = (msg) => {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl)   { errorEl.hidden = false; errorEl.textContent = msg; }
  };

  if (!catId || !albumId || !filename) {
    showError('No photo specified.');
    return;
  }

  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch {
    showError('Could not load catalog.');
    return;
  }

  const cat   = catalog.categories.find(c => c.id === catId);
  const album = cat?.albums.find(a => a.id === albumId);

  if (!cat || !album) {
    showError('Album not found.');
    return;
  }

  const photoIndex = album.photos.findIndex(p => p.filename === filename);
  if (photoIndex === -1) {
    showError('Photo not found.');
    return;
  }

  const photo  = album.photos[photoIndex];
  const path   = `${album.folder}/${photo.filename}`;
  const imgUrl = fullUrl(catalog.baseUrl, path);

  if (loadingEl) loadingEl.hidden = true;
  if (articleEl) articleEl.hidden = false;

  // ── Page & OG metadata ────────────────────────────────────
  const albumLabel = cat.flat ? cat.name : (album.title || albumId);
  const pageTitle  = photo.caption
    ? photo.caption
    : `Photo ${photoIndex + 1} — ${albumLabel}`;

  document.title = `${pageTitle} — Neil Kodner`;

  setMeta('og:title',       pageTitle);
  setMeta('og:image',       imgUrl);
  setMeta('og:url',         location.href);
  setMeta('og:description', `Photo from ${albumLabel} by Neil Kodner.`);

  // ── Breadcrumb ────────────────────────────────────────────
  const breadcrumbEl = document.querySelector('.photo-breadcrumb');
  if (breadcrumbEl) {
    const albumHref = cat.flat
      ? `/album.html?cat=${catId}&album=${catId}`
      : `/album.html?cat=${catId}&album=${albumId}`;

    const crumbs = [
      `<li><a href="/photography/">Photography</a></li>`,
      `<li aria-hidden="true">/</li>`,
    ];

    if (cat.flat) {
      crumbs.push(
        `<li><a href="${albumHref}">${cat.name}</a></li>`,
        `<li aria-hidden="true">/</li>`,
      );
    } else {
      crumbs.push(
        `<li><a href="/photography/?cat=${catId}">${cat.name}</a></li>`,
        `<li aria-hidden="true">/</li>`,
        `<li><a href="${albumHref}">${album.title || albumId}</a></li>`,
        `<li aria-hidden="true">/</li>`,
      );
    }

    crumbs.push(`<li aria-current="page">Photo ${photoIndex + 1}</li>`);
    breadcrumbEl.innerHTML = `<ol class="breadcrumb-list">${crumbs.join('')}</ol>`;
  }

  // ── Image ─────────────────────────────────────────────────
  const figureInner = document.getElementById('photo-figure-inner');
  if (figureInner) {
    const img         = document.createElement('img');
    img.src           = imgUrl;
    img.alt           = photo.caption || '';
    img.loading       = 'eager';
    img.fetchPriority = 'high';
    img.decoding      = 'async';
    if (photo.width && photo.height) {
      img.width             = photo.width;
      img.height            = photo.height;
      img.style.aspectRatio = `${photo.width} / ${photo.height}`;
    }
    figureInner.appendChild(img);
  }

  // ── Caption ───────────────────────────────────────────────
  const captionEl = document.getElementById('photo-caption');
  if (captionEl) {
    if (photo.caption) {
      captionEl.textContent = photo.caption;
    } else {
      captionEl.hidden = true;
    }
  }

  // ── EXIF table ────────────────────────────────────────────
  const metaEl = document.getElementById('photo-meta');
  if (metaEl && photo.exif && Object.keys(photo.exif).length) {
    const rows = EXIF_ORDER
      .filter(k => photo.exif[k])
      .map(k => `<dt>${EXIF_LABELS[k]}</dt><dd>${photo.exif[k]}</dd>`)
      .join('');
    if (rows) metaEl.innerHTML = `<dl class="photo-exif-table">${rows}</dl>`;
  }

  // ── Prev / Next navigation ────────────────────────────────
  const navEl = document.getElementById('photo-nav');
  if (navEl) {
    const total     = album.photos.length;
    const prevPhoto = photoIndex > 0            ? album.photos[photoIndex - 1] : null;
    const nextPhoto = photoIndex < total - 1    ? album.photos[photoIndex + 1] : null;

    const prevHtml = prevPhoto
      ? `<a href="${makePhotoUrl(catId, albumId, prevPhoto.filename)}"
            class="photo-nav-btn photo-nav-prev" rel="prev">← Previous</a>`
      : `<span class="photo-nav-btn photo-nav-prev photo-nav-btn--disabled">← Previous</span>`;

    const nextHtml = nextPhoto
      ? `<a href="${makePhotoUrl(catId, albumId, nextPhoto.filename)}"
            class="photo-nav-btn photo-nav-next" rel="next">Next →</a>`
      : `<span class="photo-nav-btn photo-nav-next photo-nav-btn--disabled">Next →</span>`;

    const countHtml = `<span class="photo-nav-count">${photoIndex + 1} / ${total}</span>`;

    navEl.innerHTML = prevHtml + countHtml + nextHtml;
  }
}
