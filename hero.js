/**
 * hero.js — fullscreen hero slideshow
 * Reads catalog.hero[], builds slides, crossfades every 5–7 s.
 */

import { fetchCatalog, fullUrl } from '/app.js';

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

  container.innerHTML = '';   // remove static placeholder

  const slides = catalog.hero.map((h, i) => {
    const div = document.createElement('div');
    div.className = 'hero-slide';

    const img = document.createElement('img');
    img.src          = fullUrl(catalog.baseUrl, `_hero/${h.filename}`);
    img.alt          = '';
    img.fetchpriority = i === 0 ? 'high' : 'low';
    img.loading       = i === 0 ? 'eager' : 'lazy';
    img.decoding      = 'async';
    img.setAttribute('aria-hidden', 'true');

    if (h.width)  img.width  = h.width;
    if (h.height) img.height = h.height;

    div.appendChild(img);
    return { div, img };
  });

  slides.forEach(({ div }) => container.appendChild(div));

  // Show first slide only once its image has loaded — no blank flash
  const { div: firstDiv, img: firstImg } = slides[0];
  const activateFirst = () => firstDiv.classList.add('is-active');
  if (firstImg.complete && firstImg.naturalWidth > 0) {
    activateFirst();
  } else {
    firstImg.addEventListener('load', activateFirst, { once: true });
  }

  if (slides.length < 2) return;

  // Cycle with a fresh random delay each turn (5–7 s)
  let current = 0;
  function advance() {
    slides[current].div.classList.remove('is-active');
    current = (current + 1) % slides.length;
    slides[current].div.classList.add('is-active');
    setTimeout(advance, randMs(5000, 7000));
  }
  setTimeout(advance, randMs(5000, 7000));
}
