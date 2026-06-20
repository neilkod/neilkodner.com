#!/usr/bin/env python3
"""
build_catalog.py
Scans a Cloudflare R2 bucket and writes catalog.json.

Expected bucket layout
----------------------
_hero/
    hero1.jpg
aviation/
    cover.jpg
    oshkosh-2024/
        manifest.json   (optional)
        cover.jpg
        img001.jpg
hockey/
    sharks-vs-kings-jan-2025/
        cover.jpg
        img001.jpg

Rules
-----
- Folders beginning with _draft- are skipped entirely.
- _thumbs/ is a system folder written by this script; its contents are skipped.
- Thumbnails (WebP, ~800 px long edge) are generated for every photo that lacks one.
- Resized JPEG variants (_resized/1200, _resized/2000) feed the lightbox srcset.
- manifest.json overrides title / date / location for an album.
- Existing catalog entries are preserved (captions, dimensions of unchanged photos).
- Entries for paths that no longer exist in R2 are removed.
"""

import io
import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from math import gcd

import boto3
import botocore.exceptions
from PIL import Image, IptcImagePlugin

# ── Constants ─────────────────────────────────────────────────────────────────

CATALOG_PATH    = "catalog.json"
THUMB_LONG_EDGE = 800        # grid/cover thumbnails, WebP
THUMB_QUALITY   = 75         # WebP quality for thumbnails

# Full-res-ish responsive variants served to the lightbox (photo.sizes[]).
# JPEG for broad <img srcset> compatibility. Long edge → quality.
RESIZED_WIDTHS  = (1200, 2000)
RESIZED_QUALITY = 82

# Override display names for category folders whose folder name alone
# doesn't reflect what you want shown on the site.
CATEGORY_NAMES = {
    "travel": "Places",
}


# ── R2 client ─────────────────────────────────────────────────────────────────

def make_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def list_all_keys(s3, bucket: str) -> list[str]:
    """Return every object key in the bucket (handles pagination)."""
    keys = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def get_bytes(s3, bucket: str, key: str) -> bytes:
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def put_bytes(s3, bucket: str, key: str, data: bytes,
              content_type: str = "image/jpeg"):
    # Filenames are content-stable (originals never change once uploaded;
    # derived keys embed dimensions/format), so long-lived immutable caching
    # is safe and lets CDN/browser hold derived assets effectively forever.
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )


# ── Image helpers ─────────────────────────────────────────────────────────────

def image_dimensions(data: bytes) -> tuple[int, int]:
    img = Image.open(io.BytesIO(data))
    return img.width, img.height


def _rational_to_float(val):
    """Convert a Pillow IFDRational or (n, d) tuple to float, or None on failure."""
    try:
        if hasattr(val, "numerator") and hasattr(val, "denominator"):
            return val.numerator / val.denominator if val.denominator else None
        if isinstance(val, tuple) and len(val) == 2:
            return val[0] / val[1] if val[1] else None
        return float(val)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _format_exposure(val) -> str | None:
    """Format ExposureTime rational as '1/1600s', '0.5s', or '2s'."""
    f = _rational_to_float(val)
    if not f:
        return None
    if hasattr(val, "numerator"):
        n, d = int(val.numerator), int(val.denominator)
    elif isinstance(val, tuple):
        n, d = int(val[0]), int(val[1])
    else:
        # Plain float — express as fraction if < 1s
        if f < 1:
            d = round(1 / f)
            return f"1/{d}s"
        return f"{f:g}s"
    if d == 0:
        return None
    common = gcd(n, d)
    n, d = n // common, d // common
    if d == 1:
        return f"{n}s"
    if n == 1:
        return f"1/{d}s"
    return f"{n}/{d}s"


def extract_exif(img: Image.Image) -> dict:
    """
    Extract a small set of photographic EXIF fields from a PIL Image.
    Returns a dict with string values; absent fields are omitted.
    All failures are silently ignored — EXIF is best-effort.
    """
    result: dict = {}
    try:
        exif_data = img.getexif()
        if not exif_data:
            return result

        # IFD0 ─ Make, Model
        make  = (exif_data.get(271) or "").strip()
        model = (exif_data.get(272) or "").strip()
        if model:
            # Many cameras embed the make inside the model string; strip it.
            if make and model.upper().startswith(make.upper()):
                model = model[len(make):].strip()
            result["camera"] = model

        # ExifIFD ─ lens, focal length, aperture, shutter speed, ISO
        ifd = exif_data.get_ifd(0x8769)  # 34665 = ExifIFD pointer

        lens = (ifd.get(42036) or "").strip()   # LensModel
        if lens:
            result["lens"] = lens

        fl = _rational_to_float(ifd.get(37386))  # FocalLength
        if fl:
            result["focal_length"] = f"{round(fl)}mm"

        fn = _rational_to_float(ifd.get(33437))  # FNumber
        if fn:
            result["aperture"] = f"f/{fn:g}"

        et = ifd.get(33434)  # ExposureTime
        if et is not None:
            s = _format_exposure(et)
            if s:
                result["shutter_speed"] = s

        iso = ifd.get(34855)  # ISOSpeedRatings
        if iso:
            result["iso"] = f"ISO {iso}"

    except Exception:
        pass  # EXIF failures are non-fatal

    return result


# Values written by iOS Photos when it misreads the XMP language tag — not real captions.
_BAD_CAPTION_VALUES = {"default", "x-default"}


def extract_caption(img: Image.Image) -> str:
    """
    Read caption from IPTC (APP13) or XMP (APP1), whichever has a real value.

    When a photo passes through the iOS Photos library before upload, iOS can
    corrupt the XMP metadata by replacing the caption text with the literal
    string "default" (misread from the xml:lang="x-default" language tag).
    Those known-bad values are skipped.

    Field priority:
      1. IPTC Caption-Abstract (2,120) — Lightroom Classic, iOS Photos edits
      2. XMP dc:description             — Lightroom Mobile direct export
      3. XMP dc:title                   — Lightroom Mobile Title field fallback
    """
    def _is_real(val: str) -> bool:
        return bool(val) and val.lower() not in _BAD_CAPTION_VALUES

    # IPTC Caption-Abstract (2,120)
    try:
        iptc = IptcImagePlugin.getiptcinfo(img)
        if iptc:
            raw = iptc.get((2, 120), b"")
            if isinstance(raw, list):
                raw = raw[0] if raw else b""
            val = raw.decode("utf-8", errors="ignore").strip()
            if _is_real(val):
                return val
    except Exception:
        pass

    # XMP dc:description, then dc:title
    try:
        xmp_bytes = img.info.get("xmp", b"")
        if xmp_bytes:
            root = ET.fromstring(xmp_bytes)
            for field in (
                "{http://purl.org/dc/elements/1.1/}description",
                "{http://purl.org/dc/elements/1.1/}title",
            ):
                for elem in root.iter(field):
                    for li in elem.iter("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}li"):
                        val = (li.text or "").strip()
                        if _is_real(val):
                            return val
    except Exception:
        pass

    return ""


def _resize_to_long_edge(img: Image.Image, long_edge: int) -> Image.Image:
    """Return img scaled so its longer side == long_edge (never upscales)."""
    w, h = img.size
    if max(w, h) <= long_edge:
        return img
    if w >= h:
        new_size = (long_edge, max(1, round(h * long_edge / w)))
    else:
        new_size = (max(1, round(w * long_edge / h)), long_edge)
    return img.resize(new_size, Image.LANCZOS)


def thumb_key_for(folder: str, filename: str) -> str:
    """
    Derive the thumbnail object key for a source filename.

    KEY SCHEME / FRONTEND CONTRACT
    ------------------------------
    Thumbs are WebP and live at `_thumbs/{folder}/{stem}.webp`, where {stem}
    is the source filename with its extension swapped to `.webp`.

    js/app.js `thumbUrl()` MUST mirror this exactly: it takes a source path
    (e.g. an album `cover` field carrying the real original key, or a photo
    path) and produces `_thumbs/{path-with-.webp}`. So the rule both sides
    obey is: lowercase-swap the final extension to `.webp`, prefix `_thumbs/`.
    """
    stem = filename.rsplit(".", 1)[0]
    return f"_thumbs/{folder}/{stem}.webp"


def make_thumbnail(data: bytes) -> bytes:
    """800 px long-edge WebP thumbnail (grid tiles + covers)."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img = _resize_to_long_edge(img, THUMB_LONG_EDGE)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=THUMB_QUALITY, method=6)
    return buf.getvalue()


def make_resized(data: bytes, long_edge: int) -> tuple[bytes, int]:
    """
    Render a JPEG variant scaled to `long_edge` (never upscaled).
    Returns (jpeg_bytes, actual_width_px).
    """
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img = _resize_to_long_edge(img, long_edge)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=RESIZED_QUALITY, optimize=True)
    return buf.getvalue(), img.width


# ── Bucket tree parser ────────────────────────────────────────────────────────

def parse_bucket(keys: list[str]) -> tuple[list[str], dict, dict]:
    """
    Build an in-memory representation of the bucket layout.

    Returns
    -------
    hero_files  : sorted list of filenames under _hero/
    categories  : {cat_id: {album_id: {"files": [...], "has_cover": bool, "cover_file": str|None}}}
                  Only populated when sub-albums exist (depth-3 keys).
    flat_photos : {cat_id: {"files": [...], "has_cover": bool, "cover_file": str|None}}
                  Depth-2 image files sitting directly in a category folder.
                  Ignored for any cat_id that also has sub-albums (albums win).
    """
    hero_files  = []
    categories:  dict = {}
    flat_photos: dict = {}

    for key in keys:
        parts = key.split("/")

        # Skip _thumbs/ and any other internal _ folders (except _hero)
        if parts[0].startswith("_") and parts[0] != "_hero":
            continue

        # Skip _draft- at any level
        if any(p.startswith("_draft-") for p in parts):
            continue

        # Skip root-level files
        if len(parts) == 1:
            continue

        # ── Hero ──────────────────────────────────────────────────────────
        if parts[0] == "_hero":
            if len(parts) == 2 and parts[1]:
                hero_files.append(parts[1])
            continue

        # ── Flat category photos (depth 2: cat/file.jpg) ──────────────────
        if len(parts) == 2:
            cat_id, filename = parts
            if not filename or filename.lower() == "manifest.json":
                continue
            flat_photos.setdefault(cat_id, {"files": [], "has_cover": False, "cover_file": None})
            if filename.lower() == "cover.jpg":
                flat_photos[cat_id]["has_cover"] = True
                flat_photos[cat_id]["cover_file"] = filename
            else:
                flat_photos[cat_id]["files"].append(filename)
            continue

        # ── Album photos (depth 3: cat/album/file.jpg) ────────────────────
        if len(parts) != 3:
            continue

        cat_id, album_id, filename = parts
        if not filename or filename.lower() == "manifest.json":
            continue

        categories.setdefault(cat_id, {})
        categories[cat_id].setdefault(album_id, {"files": [], "has_cover": False, "cover_file": None})

        if filename.lower() == "cover.jpg":
            categories[cat_id][album_id]["has_cover"] = True
            categories[cat_id][album_id]["cover_file"] = filename  # preserve actual case
        else:
            categories[cat_id][album_id]["files"].append(filename)

    hero_files.sort()
    return hero_files, categories, flat_photos


# ── Catalog merging helpers ───────────────────────────────────────────────────

def load_existing_catalog(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def existing_photo_lookup(catalog: dict) -> dict:
    """Return {"{folder}/{filename}": photo_entry} for fast lookup."""
    lookup = {}
    for cat in catalog.get("categories", []):
        for album in cat.get("albums", []):
            folder = album.get("folder", "")
            for photo in album.get("photos", []):
                lookup[f"{folder}/{photo['filename']}"] = photo
    return lookup


def existing_album_lookup(catalog: dict) -> dict:
    """Return {folder: album_entry} for fast lookup."""
    lookup = {}
    for cat in catalog.get("categories", []):
        for album in cat.get("albums", []):
            folder = album.get("folder", "")
            lookup[folder] = album
    return lookup


def folder_to_title(folder_id: str) -> str:
    """'oshkosh-2024' → 'Oshkosh 2024'"""
    return folder_id.replace("-", " ").title()


def ensure_resized_variants(s3, bucket: str, keys_set: set, folder: str,
                            filename: str, data: bytes,
                            orig_w: int, orig_h: int) -> list[dict]:
    """
    Generate `_resized/{long_edge}/{folder}/{filename}` JPEG variants
    (uploading any that don't already exist) and return the catalog `sizes`
    array, ascending by pixel width:
        [{"w": <actual width px>, "path": "_resized/.../file.jpg"}, ...]

    `w` is the variant's actual pixel WIDTH (what <img srcset> wants), derived
    from the original aspect ratio so it's correct for both orientations and
    doesn't require re-reading an already-uploaded variant.

    A variant is skipped when the original's long edge is already <= that
    target (no point shipping an upscaled / identical copy).
    """
    orig_long = max(orig_w, orig_h)
    sizes: list[dict] = []
    for long_edge in RESIZED_WIDTHS:
        if orig_long <= long_edge:
            continue
        # actual pixel width of the variant after scaling longer side → long_edge
        actual_w = (long_edge if orig_w >= orig_h
                    else max(1, round(orig_w * long_edge / orig_h)))
        variant_key = f"_resized/{long_edge}/{folder}/{filename}"
        if variant_key not in keys_set:
            print(f"    → resized  {variant_key}")
            jpeg, _ = make_resized(data, long_edge)
            put_bytes(s3, bucket, variant_key, jpeg, content_type="image/jpeg")
        sizes.append({"w": actual_w, "path": variant_key})
    sizes.sort(key=lambda s: s["w"])
    return sizes


# ── Main ──────────────────────────────────────────────────────────────────────

def build():
    bucket   = os.environ["R2_BUCKET_NAME"]
    base_url = os.environ["R2_PUBLIC_BASE_URL"].rstrip("/")

    s3 = make_client()

    existing      = load_existing_catalog(CATALOG_PATH)
    old_photos    = existing_photo_lookup(existing)
    old_albums    = existing_album_lookup(existing)
    old_hero      = {h["filename"]: h for h in existing.get("hero", [])}

    # ── Scan bucket ───────────────────────────────────────────────────────────
    print("Scanning R2 bucket…")
    all_keys     = list_all_keys(s3, bucket)
    keys_set     = set(all_keys)
    # Case-insensitive lookup: lowercase path → actual key in R2
    key_lower    = {k.lower(): k for k in all_keys}
    print(f"  {len(all_keys)} objects found")

    def find_key(path: str):
        """Return the actual R2 key matching path regardless of case, or None."""
        return key_lower.get(path.lower())

    hero_files, cat_tree, flat_photos = parse_bucket(all_keys)

    # ── Hero images ───────────────────────────────────────────────────────────
    hero_entries = []
    for filename in hero_files:
        if filename in old_hero:
            hero_entries.append(old_hero[filename])
            continue
        key = f"_hero/{filename}"
        print(f"  Hero  {key}")
        try:
            data = get_bytes(s3, bucket, key)
            w, h = image_dimensions(data)
            hero_entries.append({"filename": filename, "width": w, "height": h})
        except Exception as exc:
            print(f"  WARN  could not process {key}: {exc}")

    # ── Categories ────────────────────────────────────────────────────────────
    # Merge cat_tree (album-based) and flat_photos into one sorted list of ids.
    # Albums win: if a cat_id appears in cat_tree it is treated as album-based
    # even if flat photos also exist alongside.
    all_cat_ids = sorted(set(cat_tree) | set(flat_photos))

    category_entries = []

    for cat_id in all_cat_ids:
        is_flat    = cat_id not in cat_tree  # no sub-albums found
        albums_map = cat_tree.get(cat_id, {})
        album_entries = []

        if is_flat:
            # ── Flat category — photos live directly in cat_id/ ───────────
            info   = flat_photos[cat_id]
            folder = cat_id
            prev   = old_albums.get(folder, {})

            photos = []
            for filename in sorted(info["files"]):
                photo_key = f"{folder}/{filename}"
                thumb_key = thumb_key_for(folder, filename)
                prev_photo = old_photos.get(photo_key)

                # Fast path: unchanged photo whose thumb AND every expected
                # resized variant already exist. Carry `sizes` forward so the
                # lightbox srcset survives incremental builds.
                if prev_photo and thumb_key in keys_set and prev_photo.get("sizes") \
                        and all(s["path"] in keys_set for s in prev_photo["sizes"]):
                    photos.append({
                        "filename": filename,
                        "width":    prev_photo["width"],
                        "height":   prev_photo["height"],
                        "caption":  prev_photo.get("caption", ""),
                        "exif":     prev_photo.get("exif", {}),
                        "sizes":    prev_photo["sizes"],
                    })
                    continue

                print(f"  Photo (flat)  {photo_key}")
                try:
                    data = get_bytes(s3, bucket, photo_key)
                    img  = Image.open(io.BytesIO(data))
                    w, h = img.width, img.height
                    exif = extract_exif(img)

                    if thumb_key not in keys_set:
                        print(f"    → thumb  {thumb_key}")
                        put_bytes(s3, bucket, thumb_key, make_thumbnail(data),
                                  content_type="image/webp")

                    sizes = ensure_resized_variants(
                        s3, bucket, keys_set, folder, filename, data, w, h)

                    photos.append({
                        "filename": filename,
                        "width":    w,
                        "height":   h,
                        "caption":  prev_photo.get("caption", "") if prev_photo else extract_caption(img),
                        "exif":     exif,
                        "sizes":    sizes,
                    })
                except Exception as exc:
                    print(f"  WARN  could not process {photo_key}: {exc}")

            # Single implicit album — id and folder both equal cat_id.
            # `cover` carries the REAL original key (actual case preserved by
            # parse_bucket), e.g. "{folder}/Cover.JPG". The frontend derives the
            # thumb via thumbUrl() (extension → .webp), which matches the lowercase
            # `.webp` thumb key we generate below. See thumb_key_for() for the contract.
            album_entries.append({
                "id":       cat_id,
                "folder":   folder,
                "title":    CATEGORY_NAMES.get(cat_id) or folder_to_title(cat_id),
                "date":     prev.get("date", ""),
                "location": prev.get("location", ""),
                "cover":    f"{folder}/{info['cover_file']}" if info["has_cover"] else "",
                "photos":   photos,
            })

        else:
            # ── Album-based category ──────────────────────────────────────
            for album_id in sorted(albums_map):
                info   = albums_map[album_id]
                folder = f"{cat_id}/{album_id}"

                # ── manifest.json ──────────────────────────────────────────
                manifest = {}
                manifest_key = f"{folder}/manifest.json"
                if manifest_key in keys_set:
                    try:
                        manifest = json.loads(get_bytes(s3, bucket, manifest_key))
                    except Exception as exc:
                        print(f"  WARN  bad manifest {manifest_key}: {exc}")

                # Title / date / location: manifest > existing catalog > folder name
                prev = old_albums.get(folder, {})
                title    = manifest.get("title")    or prev.get("title")    or folder_to_title(album_id)
                date     = manifest.get("date")     or prev.get("date")     or ""
                location = manifest.get("location") or prev.get("location") or ""

                # ── Photos ────────────────────────────────────────────────
                photos = []
                for filename in sorted(info["files"]):
                    photo_key = f"{folder}/{filename}"
                    thumb_key = thumb_key_for(folder, filename)

                    prev_photo = old_photos.get(photo_key)

                    # Fast path: unchanged photo whose thumb AND every expected
                    # resized variant already exist. Carry `sizes` forward so the
                    # lightbox srcset survives incremental builds.
                    if prev_photo and thumb_key in keys_set and prev_photo.get("sizes") \
                            and all(s["path"] in keys_set for s in prev_photo["sizes"]):
                        photos.append({
                            "filename": filename,
                            "width":    prev_photo["width"],
                            "height":   prev_photo["height"],
                            "caption":  prev_photo.get("caption", ""),
                            "exif":     prev_photo.get("exif", {}),
                            "sizes":    prev_photo["sizes"],
                        })
                        continue

                    # New photo, missing thumbnail, or missing variants — download original
                    print(f"  Photo  {photo_key}")
                    try:
                        data = get_bytes(s3, bucket, photo_key)
                        img  = Image.open(io.BytesIO(data))
                        w, h = img.width, img.height
                        exif = extract_exif(img)

                        if thumb_key not in keys_set:
                            print(f"    → thumb  {thumb_key}")
                            put_bytes(s3, bucket, thumb_key, make_thumbnail(data),
                                      content_type="image/webp")

                        sizes = ensure_resized_variants(
                            s3, bucket, keys_set, folder, filename, data, w, h)

                        photos.append({
                            "filename": filename,
                            "width":    w,
                            "height":   h,
                            "caption":  prev_photo.get("caption", "") if prev_photo else extract_caption(img),
                            "exif":     exif,
                            "sizes":    sizes,
                        })
                    except Exception as exc:
                        print(f"  WARN  could not process {photo_key}: {exc}")

                # ── Cover thumbnail ───────────────────────────────────────
                # Thumb key derives from the real-cased cover filename so it
                # stays in sync with what the frontend requests via thumbUrl()
                # (cover field below carries the real original key).
                if info["has_cover"]:
                    cover_thumb_key = thumb_key_for(folder, info["cover_file"])
                    if cover_thumb_key not in keys_set:
                        cover_key = f"{folder}/{info['cover_file']}"  # actual case
                        print(f"  Cover thumb  {cover_key}")
                        try:
                            data = get_bytes(s3, bucket, cover_key)
                            put_bytes(s3, bucket, cover_thumb_key, make_thumbnail(data),
                                      content_type="image/webp")
                        except Exception as exc:
                            print(f"  WARN  {cover_key}: {exc}")

                album_entries.append({
                    "id":       album_id,
                    "folder":   folder,
                    "title":    title,
                    "date":     date,
                    "location": location,
                    # Real original key (actual case); frontend swaps ext → .webp.
                    "cover":    f"{folder}/{info['cover_file']}" if info["has_cover"] else "",
                    "photos":   photos,
                })

            # Sort newest-first by date
            album_entries.sort(key=lambda a: a["date"] or "", reverse=True)

        # ── Category cover thumbnail ──────────────────────────────────────
        # actual_cat_cover is the real-cased key, e.g. "aviation/Cover.JPG".
        # Thumb key + the `cover` field both derive from it so the frontend's
        # thumbUrl() (ext → .webp) resolves to the thumb we actually write.
        actual_cat_cover = find_key(f"{cat_id}/cover.jpg")  # handles .JPG etc.
        if actual_cat_cover:
            cat_cover_filename = actual_cat_cover.split("/")[-1]
            cat_cover_thumb_key = thumb_key_for(cat_id, cat_cover_filename)
            if cat_cover_thumb_key not in keys_set:
                print(f"  Cat cover thumb  {actual_cat_cover}")
                try:
                    data = get_bytes(s3, bucket, actual_cat_cover)
                    put_bytes(s3, bucket, cat_cover_thumb_key, make_thumbnail(data),
                              content_type="image/webp")
                except Exception as exc:
                    print(f"  WARN  {actual_cat_cover}: {exc}")

        category_entries.append({
            "id":     cat_id,
            "name":   CATEGORY_NAMES.get(cat_id) or folder_to_title(cat_id),
            "flat":   is_flat,
            # Real original key (actual case); frontend swaps ext → .webp.
            "cover":  actual_cat_cover if actual_cat_cover else "",
            "albums": album_entries,
        })

    # ── Write catalog ─────────────────────────────────────────────────────────
    catalog = {
        "generated":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "baseUrl":    base_url,
        "hero":       hero_entries,
        "categories": category_entries,
    }

    with open(CATALOG_PATH, "w") as f:
        json.dump(catalog, f, indent=2)
        f.write("\n")

    total_albums = sum(len(c["albums"]) for c in category_entries)
    total_photos = sum(len(a["photos"]) for c in category_entries for a in c["albums"])
    print(f"Done — {len(category_entries)} categories, {total_albums} albums, {total_photos} photos")


if __name__ == "__main__":
    required = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                "R2_BUCKET_NAME", "R2_PUBLIC_BASE_URL"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"ERROR: missing environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    build()
