# Prompt 13 — Hover Effects (Desktop Only)

Add hover interactions to album tiles and category tiles, scoped to devices that actually support hover.

## The problem with CSS `:hover` on touch devices

On iOS and Android, `:hover` styles apply on tap and then stick until the user taps elsewhere. This makes hover effects feel broken on touch screens — tiles get "stuck" in the hovered state.

The fix: wrap all hover rules in `@media (hover: hover)` so they only apply on devices with a true pointer device (mouse, trackpad):

```css
@media (hover: hover) {
  .album-tile:hover img {
    transform: scale(1.04);
    transition: transform 0.35s ease;
  }
  .album-tile:hover .tile-accent-border {
    opacity: 1;
  }
}
```

Apply the same pattern to `.category-tile:hover`.

## Album tile hover effect

- The cover image scales up slightly (`scale(1.04)`) on hover
- An accent border (`.tile-accent-border`) fades in — a thin colored border at the bottom of the tile cover
- The image itself has `overflow: hidden` on the parent so the scaled image is clipped to the tile bounds

```css
.album-tile-cover {
  overflow: hidden;
  position: relative;
}
.album-tile img {
  transition: transform 0.35s ease;
}
.tile-accent-border {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-accent);
  opacity: 0;
  transition: opacity 0.25s ease;
}

@media (hover: hover) {
  .album-tile:hover img {
    transform: scale(1.04);
  }
  .album-tile:hover .tile-accent-border {
    opacity: 1;
  }
}
```

## Category tile hover effect

Similar pattern — the cover image scales slightly, and the tile border highlights. Already defined in base styles; ensure it too is inside `@media (hover: hover)`.
