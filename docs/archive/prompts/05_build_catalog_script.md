# Prompt 05 — Build Catalog Script

Write `scripts/build_catalog.py` — the Python script that runs in GitHub Actions to scan R2, generate thumbnails, and produce `catalog.json`.

## What it should do

1. **Connect to R2** using boto3 with credentials from environment variables:
   `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`

2. **Parse the bucket** by listing all objects and categorizing keys:
   - `_hero/*.jpg` → hero images
   - `cat/album/file.jpg` → album-based categories (depth 3)
   - `cat/file.jpg` → flat categories (depth 2, photos directly in category folder)
   - Skip any path segment starting with `_draft-`
   - Skip `_thumbs/` and all other `_`-prefixed top-level folders (except `_hero`)
   - Skip root-level files (depth 1)

3. **`parse_bucket(keys)`** returns three values:
   - `hero_files` — sorted list of filenames under `_hero/`
   - `categories` — `{cat_id: {album_id: {"files": [filenames...], "has_cover": bool, "cover_file": str|None}}}`
     for depth-3 keys; `cover.jpg` sets `has_cover=True` and is NOT added to `files`
   - `flat_photos` — `{cat_id: {"files": [filenames...], "has_cover": bool, "cover_file": str|None}}`
     for depth-2 keys; same cover treatment

4. **Case-insensitive key lookup** — some uploads capitalise extensions (`.JPG`). After listing all keys, build:
   ```python
   key_lower = {k.lower(): k for k in all_keys}
   def find_key(path):
       return key_lower.get(path.lower())
   ```
   Use `find_key()` when looking up category `cover.jpg` files.

5. **Read `manifest.json`** from album folders when present for title, date, and location overrides.

6. **Merge with existing `catalog.json`** if it exists, so that:
   - Previously extracted dimensions, captions, and EXIF data are preserved
   - New photos are added; deleted photos are removed
   - Existing metadata isn't re-fetched unnecessarily

7. **Download new photos** that aren't in the existing catalog:
   - Extract image dimensions with Pillow
   - Extract EXIF metadata (see below)
   - Generate a 500px-long-edge JPEG thumbnail
   - Upload the thumbnail to `_thumbs/<original-path>` in R2

8. **Generate cover thumbnails** for each album's `cover.jpg` (inline in the album loop) and for each category's `cover.jpg` (at the end of the per-category loop, using `find_key()` to handle case differences). Only generate if the thumbnail doesn't already exist in R2.

9. **Write `catalog.json`** with the full structure (see Prompt 04 for schema).

## EXIF extraction helpers

Add `_rational_to_float(val)` — converts a Pillow `IFDRational`, `(numerator, denominator)` tuple, or plain number to a Python float, returning `None` on failure.

Add `_format_exposure(val)` — converts an `ExposureTime` rational to a string:
- Values ≥ 1 second: `"2s"`
- Values < 1 second: `"1/500s"` — use `math.gcd` to reduce to lowest terms

Add `extract_exif(img)` — reads a Pillow image and returns:
```python
{
    "camera":        "NIKON Z9",
    "lens":          "NIKKOR Z 100-400mm f/4.5-5.6 VR S",
    "focal_length":  "400mm",
    "aperture":      "f/5.6",
    "shutter_speed": "1/2000s",
    "iso":           "ISO 800",
}
```

Read from IFD0 (tags 271=Make, 272=Model) and ExifIFD sub-IFD (`0x8769`):
- Camera: strip Make from the front of Model if it starts with it (avoids `"NIKON NIKON Z9"`)
- Lens: LensModel (tag 42036)
- Focal length: FocalLength (tag 37386) → `"400mm"`
- Aperture: FNumber (tag 33437) → `"f/5.6"`
- Shutter speed: ExposureTime (tag 33434) via `_format_exposure()`
- ISO: ISOSpeedRatings (tag 34855) → `"ISO 800"`

Wrap the entire function in try/except and return `{}` on any error. EXIF is optional.

## Display name overrides

Add a `CATEGORY_NAMES` dict at the top of the script for overriding folder names to display names:

```python
CATEGORY_NAMES = {"travel": "Places"}
```

Also add a `folder_to_title(folder_id)` helper:
```python
def folder_to_title(folder_id):
    return folder_id.replace("-", " ").title()
```

## Notes

- Sort photos within albums alphabetically by filename
- Sort albums within categories by date descending (newest first), with undated albums last
- The script should be idempotent — running it twice produces the same result
- Print progress to stdout so the Action log is readable (`print(f"Photo  {key}")`)
- Write `scripts/requirements.txt` with pinned versions: `boto3==1.34.69` and `Pillow==10.3.0`
