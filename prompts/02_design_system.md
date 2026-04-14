# Prompt 02 — Design System

Let's establish the visual design before writing any page HTML. I want a clean, minimal aesthetic appropriate for a photography portfolio — dark background, the photos should be the focus.

Please create two CSS files:

**`tokens.css`** — CSS custom properties only (no selectors besides `:root`). Should define:
- Color palette: dark background (near-black), surface colors for cards/tiles, muted text, accent color
- Typography: a font stack using Google Fonts (I like Jost for headings/UI and a clean sans-serif for body)
- Spacing scale
- Border radius values
- Transition durations

**`style.css`** — All component styles, importing tokens.css. Should include:
- CSS reset / base styles
- Site navigation bar (fixed top, translucent dark background with blur)
- `.container` max-width wrapper with horizontal padding
- `.section` and `.section--tight` vertical rhythm helpers
- `.section-heading` (title + "View all" link on the same row)
- Category tile grid (`.category-tile`, image cover, dark overlay with title)
- Album tile grid (`.album-tile`, cover image, title + subtitle below)
- `.albums-strip` horizontal scroll on mobile, grid on desktop
- Footer
- Image fade-in animation: images start invisible, gain `.loaded` class on load, fade to full opacity
- Accessibility: skip link, focus rings

The overall feel should be: dark, editorial, spacious. The photography is the hero.
