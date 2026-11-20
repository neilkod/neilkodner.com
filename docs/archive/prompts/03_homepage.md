# Prompt 03 — Homepage

Build `index.html` — the site's home page. It should have three sections:

**Navigation**
- Fixed top bar: site name on the left, links (Home, Photography, About) on the right.
- `aria-current="page"` on the active link.

**Hero section**
- Full-viewport-height image slideshow. The slides are populated by JavaScript from `catalog.json` — the HTML just needs a `#hero-slides` container and a placeholder div shown before JS runs.
- Dark overlay on top of the hero with the site title ("Photography by Neil Kodner") and location subtitle ("Los Gatos, California").
- The hero slides themselves should be `aria-hidden` since they're decorative.

**Category tiles section**
- Heading "Categories" with a "View all" link to `/photography/`.
- A 2×2 grid of `.category-tile` links. Each tile shows a cover image (injected by JS), a dark overlay, and the category name as an `<h3>`.
- Hard-code the four tiles: Aviation (`?cat=aviation`), Hockey (`?cat=hockey`), Places (`?cat=travel`), Birds (`?cat=birds`).

**Latest Albums section**
- Heading "Latest Albums".
- An `#latest-albums` container that JS populates with the four newest albums across all categories.
- Show four placeholder `.album-tile` skeleton elements before JS loads so layout doesn't shift.

**Footer**
- Simple: "© 2026 Neil Kodner"

Include Open Graph meta tags. Add a `<script type="module">` at the bottom that imports from `app.js` and `hero.js` to initialize everything.

No inline styles. All visual styling through CSS classes.
