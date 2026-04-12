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
- Thumbnails (~500 px long edge) are generated for every photo that lacks one.
- manifest.json overrides title / date / location for an album.
- Existing catalog entries are preserved (captions, dimensions of unchanged photos).
- Entries for paths that no longer exist in R2 are removed.
"""

import io
import json
import os
import sys
from datetime import datetime, timezone

import boto3
import botocore.exceptions
from PIL import Image

# ── Constants ─────────────────────────────────────────────────────────────────

CATALOG_PATH    = "catalog.json"
THUMB_LONG_EDGE = 500
THUMB_QUALITY   = 85


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


def put_bytes(s3, bucket: str, key: str, data: bytes):
    s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType="image/jpeg")


# ── Image helpers ─────────────────────────────────────────────────────────────

def image_dimensions(data: bytes) -> tuple[int, int]:
    img = Image.open(io.BytesIO(data))
    return img.width, img.height


def make_thumbnail(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    if w >= h:
        new_size = (THUMB_LONG_EDGE, max(1, int(h * THUMB_LONG_EDGE / w)))
    else:
        new_size = (max(1, int(w * THUMB_LONG_EDGE / h)), THUMB_LONG_EDGE)
    img = img.resize(new_size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=THUMB_QUALITY, optimize=True)
    return buf.getvalue()


# ── Bucket tree parser ────────────────────────────────────────────────────────

def parse_bucket(keys: list[str]) -> tuple[list[str], dict]:
    """
    Build an in-memory representation of the bucket layout.

    Returns
    -------
    hero_files : sorted list of filenames under _hero/
    categories : {cat_id: {album_id: {"files": [...], "has_cover": bool}}}
    """
    hero_files = []
    categories: dict = {}

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

        # ── Categories / albums ───────────────────────────────────────────
        # We only care about depth-3 keys: cat/album/file.jpg
        if len(parts) != 3:
            continue

        cat_id, album_id, filename = parts
        if not filename or filename == "manifest.json":
            continue

        categories.setdefault(cat_id, {})
        categories[cat_id].setdefault(album_id, {"files": [], "has_cover": False})

        if filename == "cover.jpg":
            categories[cat_id][album_id]["has_cover"] = True
        else:
            categories[cat_id][album_id]["files"].append(filename)

    hero_files.sort()
    return hero_files, categories


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
    print(f"  {len(all_keys)} objects found")

    hero_files, cat_tree = parse_bucket(all_keys)

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
    category_entries = []

    for cat_id in sorted(cat_tree):
        albums_map = cat_tree[cat_id]
        album_entries = []

        for album_id in sorted(albums_map):
            info   = albums_map[album_id]
            folder = f"{cat_id}/{album_id}"

            # ── manifest.json ──────────────────────────────────────────────
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

            # ── Photos ────────────────────────────────────────────────────
            photos = []
            for filename in sorted(info["files"]):
                photo_key = f"{folder}/{filename}"
                thumb_key = f"_thumbs/{folder}/{filename}"

                prev_photo = old_photos.get(photo_key)

                if prev_photo and thumb_key in keys_set:
                    # Preserve existing entry — no download needed
                    photos.append({
                        "filename": filename,
                        "width":    prev_photo["width"],
                        "height":   prev_photo["height"],
                        "caption":  prev_photo.get("caption", ""),
                    })
                    continue

                # New photo or missing thumbnail — download original
                print(f"  Photo  {photo_key}")
                try:
                    data = get_bytes(s3, bucket, photo_key)
                    w, h = image_dimensions(data)

                    if thumb_key not in keys_set:
                        print(f"    → thumb  {thumb_key}")
                        put_bytes(s3, bucket, thumb_key, make_thumbnail(data))

                    photos.append({
                        "filename": filename,
                        "width":    w,
                        "height":   h,
                        "caption":  prev_photo.get("caption", "") if prev_photo else "",
                    })
                except Exception as exc:
                    print(f"  WARN  could not process {photo_key}: {exc}")

            # ── Cover thumbnail ───────────────────────────────────────────
            if info["has_cover"]:
                cover_key       = f"{folder}/cover.jpg"
                cover_thumb_key = f"_thumbs/{folder}/cover.jpg"
                if cover_thumb_key not in keys_set:
                    print(f"  Cover thumb  {cover_key}")
                    try:
                        data = get_bytes(s3, bucket, cover_key)
                        put_bytes(s3, bucket, cover_thumb_key, make_thumbnail(data))
                    except Exception as exc:
                        print(f"  WARN  {cover_key}: {exc}")

            album_entries.append({
                "id":       album_id,
                "folder":   folder,
                "title":    title,
                "date":     date,
                "location": location,
                "cover":    f"{folder}/cover.jpg" if info["has_cover"] else "",
                "photos":   photos,
            })

        # Sort newest-first by date; albums without dates sort alphabetically
        # at the end (empty string sorts before any date string when reversed,
        # so undated albums appear last — correct for Aviation/Hockey/Travel).
        # For Birds (all undated), sorted(albums_map) already gives alphabetical order.
        album_entries.sort(key=lambda a: a["date"] or "", reverse=True)

        # ── Category cover thumbnail ──────────────────────────────────────
        cat_cover_key       = f"{cat_id}/cover.jpg"
        cat_cover_thumb_key = f"_thumbs/{cat_id}/cover.jpg"
        if cat_cover_key in keys_set and cat_cover_thumb_key not in keys_set:
            print(f"  Cat cover thumb  {cat_cover_key}")
            try:
                data = get_bytes(s3, bucket, cat_cover_key)
                put_bytes(s3, bucket, cat_cover_thumb_key, make_thumbnail(data))
            except Exception as exc:
                print(f"  WARN  {cat_cover_key}: {exc}")

        category_entries.append({
            "id":     cat_id,
            "name":   folder_to_title(cat_id),
            "cover":  cat_cover_key if cat_cover_key in keys_set else "",
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
