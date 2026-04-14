# Prompt 12 — PhotoSwipe UI Polish

Refine the PhotoSwipe viewer UI: counter, captions, and caption positioning.

## Photo counter

PhotoSwipe v5 includes a **built-in** counter element (name `"counter"`, order 5). Do not register a custom counter — it will appear twice. The built-in counter shows "3 / 12" style text automatically.

Style it in the `<style>` block inside `album.html`:

```css
.pswp__counter {
  font-family: 'Jost', sans-serif;
  font-weight: 300;
  font-size: 0.75rem;
  opacity: 0.75;
  height: 44px;
  display: flex;
  align-items: center;
}
```

## Caption + EXIF element

Register a custom element named `"caption"` (not `"counter"`) in `lightbox.on('uiRegister')`:

```js
lightbox.pswp.ui.registerElement({
  name:     'caption',
  order:    9,
  isButton: false,
  appendTo: 'wrapper',
  onInit(el, pswp) {
    const refresh = () => { /* build innerHTML from caption + exif */ };
    pswp.on('change', refresh);
  },
});
```

`appendTo: 'wrapper'` places the element inside the PhotoSwipe wrapper so it sits below the image but inside the viewport.

## Caption positioning — always below the photo

The problem: for portrait images that fill the full viewport height, an `position: absolute; bottom: 0` caption lands on top of the photo.

The fix: use the PhotoSwipe `padding` option to permanently reserve 80px at the bottom (and 44px at the top for the counter bar). This shrinks the image's available space so it never extends into the caption zone:

```js
padding: { top: 44, bottom: 80, left: 0, right: 0 }
```

Style the caption container as a fixed-height flex bar, not a gradient overlay:

```css
.pswp__custom-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  /* No background — the padding option keeps images above this zone */
}
.pswp-caption-text {
  color: rgba(255,255,255,0.9);
  font-size: 0.85rem;
}
.pswp-exif-text {
  color: rgba(255,255,255,0.5);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
```
