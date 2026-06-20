/**
 * hero.js — fullscreen hero slideshow
 * Reads catalog.hero[], builds slides, crossfades every 5–7 s.
 */

import { fetchCatalog, fullUrl } from '/js/app.js';

/** Random delay in [min, max] ms. */
const randMs = (min, max) => min + Math.random() * (max - min);

export async function initHero() {
  const container = document.getElementById('hero-slides');
  if (!container) return;

  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch (err) {
    console.warn('Hero: could not load catalog', err);
    return;
  }

  if (!catalog.hero?.length) return;

  // Serve landscape images on wide viewports, portrait on tall viewports.
  // Falls back to the full set if the matched orientation has no images.
  const isPortraitViewport = window.innerHeight > window.innerWidth;
  const landscape = catalog.hero.filter(h => h.width >= h.height);
  const portrait  = catalog.hero.filter(h => h.height > h.width);
  const heroImages = (isPortraitViewport ? portrait : landscape).length
    ? (isPortraitViewport ? portrait : landscape)
    : catalog.hero;

  container.innerHTML = '';   // remove static placeholder

  const slides = heroImages.map((h, i) => {
    const div = document.createElement('div');
    div.className = 'hero-slide';

    // Build each img WITHOUT a src — only the active slide (and the one
    // preloaded ahead) ever gets a src, so we don't download all ~23
    // hero originals on load. Width/height still reserve layout space.
    const img = document.createElement('img');
    img.alt          = '';
    img.fetchpriority = i === 0 ? 'high' : 'low';
    img.loading       = i === 0 ? 'eager' : 'lazy';
    img.decoding      = 'async';
    img.setAttribute('aria-hidden', 'true');

    if (h.width)  img.width  = h.width;
    if (h.height) img.height = h.height;

    // Stash the eventual URL; assigned lazily via ensureSrc().
    // Prefer the 2560 px resized hero when the catalog provides one; fall back
    // to the full original for heroes already small enough to skip resizing.
    const heroPath = h.resized || `_hero/${h.filename}`;
    img.dataset.heroSrc = fullUrl(catalog.baseUrl, heroPath);

    div.appendChild(img);
    return { div, img };
  });

  slides.forEach(({ div }) => container.appendChild(div));

  // Assign a slide's src only when needed (idempotent — never reassign).
  const ensureSrc = (i) => {
    const { img } = slides[i];
    if (!img.src && img.dataset.heroSrc) img.src = img.dataset.heroSrc;
  };

  // First slide loads eagerly (fetchpriority high already set above).
  ensureSrc(0);
  // Preload the next slide so the first crossfade target is cached.
  if (slides.length > 1) ensureSrc(1 % slides.length);

  // Show first slide only once its image has loaded — no blank flash
  const { div: firstDiv, img: firstImg } = slides[0];
  const activateFirst = () => firstDiv.classList.add('is-active');
  if (firstImg.complete && firstImg.naturalWidth > 0) {
    activateFirst();
  } else {
    firstImg.addEventListener('load', activateFirst, { once: true });
  }

  if (slides.length < 2) return;

  // Cycle with a fresh random delay each turn (8–12 s)
  let current = 0;
  function advance() {
    slides[current].div.classList.remove('is-active');
    current = (current + 1) % slides.length;
    // Make sure the slide we're about to show has its src,
    // and preload the one after it for the following crossfade.
    ensureSrc(current);
    ensureSrc((current + 1) % slides.length);
    slides[current].div.classList.add('is-active');
    setTimeout(advance, randMs(8000, 12000));
  }
  setTimeout(advance, randMs(8000, 12000));
}
