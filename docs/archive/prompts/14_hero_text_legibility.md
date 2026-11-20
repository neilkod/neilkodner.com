# Prompt 14 — Hero Text Legibility

The hero title and subtitle can be hard to read when the hero image is light-toned (e.g. a bright sky or ice rink). Fix text legibility without making it look heavy-handed.

## Approach: layered text shadows + radial gradient scrim

Don't use a full-width dark bar or heavy vignette — that overwhelms the photo. Instead, use two subtle techniques together:

### 1. Text shadows

Apply a multi-layer text shadow to the title and subtitle. Multiple soft shadows at different opacities blend into a natural-looking glow that works on both light and dark backgrounds:

```css
.hero-title {
  font-weight: 500;       /* slightly heavier than the default light weight */
  opacity: 0.95;
  text-shadow:
    0 1px 8px rgba(0,0,0,0.70),
    0 2px 20px rgba(0,0,0,0.50),
    0 4px 40px rgba(0,0,0,0.35);
}

.hero-subtitle {
  opacity: 0.70;
  text-shadow:
    0 1px 8px rgba(0,0,0,0.70),
    0 2px 20px rgba(0,0,0,0.50),
    0 4px 40px rgba(0,0,0,0.35);
}
```

### 2. Radial gradient scrim

Add a dark elliptical gradient behind the text area using a `::before` pseudo-element on `.hero`. This is centered on the overlay text and fades to transparent at the edges, so it doesn't look like a vignette border:

```css
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;     /* above slides, below overlay text */
  background: radial-gradient(
    ellipse 75% 55% at 50% 50%,
    rgba(0,0,0,0.42) 0%,
    transparent 70%
  );
  pointer-events: none;
}
```

Make sure the `.hero-overlay` has `z-index` higher than the `::before` scrim so the text renders on top.

## Result

Text is legible over both dark and light hero images, with no visible vignette border, and the effect is subtle enough that it doesn't distract from the photos.
