# Prompt 11 — EXIF Metadata

Extract camera EXIF metadata during the build step and display it in the PhotoSwipe photo viewer.

## build_catalog.py — EXIF extraction

Add an `extract_exif(img)` function that reads the Pillow image object and returns a dict:

```python
def extract_exif(img):
    # Read IFD0 for Make/Model, ExifIFD for the rest
    # ExifIFD is a sub-IFD pointed to by tag 0x8769
    ...
    return {
        "camera":        "NIKON Z9",          # Make + Model, deduped
        "lens":          "NIKKOR Z 100-400mm f/4.5-5.6 VR S",
        "focal_length":  "400mm",
        "aperture":      "f/5.6",
        "shutter_speed": "1/2000s",
        "iso":           "ISO 800",
    }
```

**Camera field:** combine `Make` and `Model`, but strip the make from the model string if it starts with the make (e.g. `"NIKON NIKON Z9"` → `"NIKON Z9"`).

**Shutter speed:** if ExposureTime ≥ 1 second, format as `"2s"`; if < 1, format as `"1/500s"` using the rational representation (or compute from float). Use `math.gcd` to reduce the fraction.

**Rational values:** Pillow may return `IFDRational` objects or `(numerator, denominator)` tuples. Write a `_rational_to_float(val)` helper that handles both.

**Failure handling:** wrap the entire function in a try/except and return `{}` on any error. EXIF is optional — the site should work fine without it.

**Preservation:** store `photo["exif"]` in `catalog.json`. On subsequent runs, if a photo already has `exif` data in the existing catalog, keep it — don't re-download just to re-read EXIF.

## gallery.js — EXIF display

In `renderAlbumPage()`, serialize the exif dict as JSON and store it on the `<a>` element:

```js
if (photo.exif && Object.keys(photo.exif).length) {
  a.setAttribute('data-pswp-exif', JSON.stringify(photo.exif));
}
```

In the PhotoSwipe `uiRegister` → custom caption element's `onInit`, read both `data-pswp-caption` and `data-pswp-exif`. Display EXIF as a definition list (`<dl>`) with human-readable labels, not as dot-separated text:

```js
const LABELS = {
  camera:        'Camera',
  lens:          'Lens',
  focal_length:  'Focal length',
  aperture:      'Aperture',
  shutter_speed: 'Shutter',
  iso:           'ISO',
};
const ORDER = ['camera', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso'];

// inside refresh():
const exif = JSON.parse(exifRaw);
const rows = ORDER
  .filter(k => exif[k])
  .map(k => `<dt>${LABELS[k]}</dt><dd>${exif[k]}</dd>`)
  .join('');
if (rows) exifHtml = `<dl class="pswp-exif-table">${rows}</dl>`;
```

Refresh on every `pswp.on('change', refresh)` event so it updates as the user navigates.

## Lightroom export note

To populate EXIF, Lightroom must export with **All Metadata** (not "Copyright only"). Update the export preset and the README.
