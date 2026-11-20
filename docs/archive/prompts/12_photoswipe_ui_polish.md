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
  appendTo: 'root',   // NOT 'wrapper' — root places it relative to the PhotoSwipe container
  onInit(el, pswp) {
    el.className = 'pswp__caption pswp-info';
    const refresh = () => { /* build innerHTML from caption + exif dl table */ };
    pswp.on('change', refresh);
  },
});
```

`appendTo: 'root'` positions the element relative to the PhotoSwipe root container. Give it the class `pswp-info` for styling (not `pswp__custom-caption`).

## Caption positioning — always below the photo

The problem: for portrait images that fill the full viewport height, an `position: absolute; bottom: 0` caption lands on top of the photo.

The fix: use the PhotoSwipe `paddingFn` option to reserve space at the bottom. The reservation is adaptive — 200px on normal viewports, 80px on short viewports (landscape mobile, `height < 500px`). See Prompt 09 for the `paddingFn` implementation. This shrinks the image's available space so it never extends into the caption zone.

Style the info panel as a fixed-height block at the bottom. The EXIF is a `<dl>` table (see Prompt 11):

```css
.pswp-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem 1rem;
  text-align: center;
}
.pswp-caption {
  color: rgba(255,255,255,0.9);
  font-size: 0.85rem;
  margin: 0 0 0.4rem;
}
.pswp-exif-table {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 1.25rem;
  margin: 0;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.5);
}
.pswp-exif-table dt { font-weight: 500; margin-right: 0.3em; }
.pswp-exif-table dd { margin: 0; }
```
