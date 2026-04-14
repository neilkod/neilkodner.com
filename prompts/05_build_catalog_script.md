# Prompt 05 — Build Catalog Script

Write `scripts/build_catalog.py` — the Python script that runs in GitHub Actions to scan R2, generate thumbnails, and produce `catalog.json`.

## What it should do

1. **Connect to R2** using boto3 with credentials from environment variables:
   `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`

2. **Parse the bucket** by listing all objects and categorizing keys:
   - `_hero/*.jpg` → hero images
   - `cat/album/file.jpg` → album-based categories (depth 3)
   - `cat/file.jpg` → flat categories (depth 2, photos directly in category folder)
   - Skip any key containing `/_draft-` or starting with `_thumbs/` or `_hero/`

3. **Read `manifest.json`** from album folders when present for title, date, and location overrides.

4. **Merge with existing `catalog.json`** if it exists, so that:
   - Previously extracted dimensions, captions, and EXIF data are preserved
   - New photos are added; deleted photos are removed
   - Existing metadata isn't re-fetched unnecessarily

5. **Download new photos** that aren't in the existing catalog, using a temp file:
   - Extract image dimensions with Pillow
   - Extract EXIF metadata (camera make/model, lens, focal length, aperture, shutter speed, ISO)
   - Generate a 500px-long-edge JPEG thumbnail
   - Upload the thumbnail to `_thumbs/<original-path>` in R2

6. **Write `catalog.json`** with the full structure (see Prompt 04 for schema).

## EXIF extraction

Use `img.getexif()` and the ExifIFD sub-IFD (`0x8769`) to read:
- Camera: Make + Model (combined, with duplicate words removed)
- Lens: LensModel (tag 42036)
- Focal length: FocalLength (tag 37386) — format as `"400mm"`
- Aperture: FNumber (tag 33437) — format as `"f/5.6"`
- Shutter speed: ExposureTime (tag 33434) — format as `"1/500s"` or `"2s"`
- ISO: ISOSpeedRatings (tag 34855) — format as `"ISO 800"`

Handle rational number types (tuples or `IFDRational`) gracefully. Skip EXIF silently if anything fails.

## Display name overrides

Add a `CATEGORY_NAMES` dict at the top of the script for overriding folder names to display names:

```python
CATEGORY_NAMES = {"travel": "Places"}
```

## Notes

- Sort photos within albums alphabetically by filename
- Sort albums within categories by date descending (newest first), with undated albums last
- The script should be idempotent — running it twice produces the same result
- Print progress to stdout so the Action log is readable
- Write `scripts/requirements.txt` with `boto3` and `Pillow`
