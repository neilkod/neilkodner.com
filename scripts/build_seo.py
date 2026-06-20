#!/usr/bin/env python3
"""Generate sitemap.xml for neilkodner.com from catalog.json.

Stdlib only (Python 3.11). Run from the repo root:

    python scripts/build_seo.py

Reads catalog.json (repo root) and writes sitemap.xml (repo root). Output is
deterministic so it doesn't churn the git diff when the catalog is unchanged.
"""

import json
import os
import re
import sys
from xml.sax.saxutils import escape

SITE_ORIGIN = "https://neilkodner.com"

# Resolve paths relative to the repo root (parent of this script's directory)
# so the script works whether invoked from the repo root or elsewhere.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(REPO_ROOT, "catalog.json")
SITEMAP_PATH = os.path.join(REPO_ROOT, "sitemap.xml")


def normalize_lastmod(date):
    """Return a valid W3C date (YYYY or YYYY-MM) from an album date, or None.

    Album dates look like "2024-07" or "2024". Anything that doesn't match a
    plausible year / year-month is dropped rather than emitting invalid XML.
    """
    if not date:
        return None
    date = str(date).strip()
    if re.fullmatch(r"\d{4}", date):
        return date
    m = re.fullmatch(r"(\d{4})-(\d{2})", date)
    if m:
        month = int(m.group(2))
        if 1 <= month <= 12:
            return date
    # Try to salvage a YYYY-MM-DD style value as YYYY-MM.
    m = re.fullmatch(r"(\d{4})-(\d{2})-\d{2}", date)
    if m and 1 <= int(m.group(2)) <= 12:
        return f"{m.group(1)}-{m.group(2)}"
    return None


def url_entry(loc, lastmod=None, images=None):
    """Build a <url> element as a list of indented string lines."""
    lines = ["  <url>", f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        lines.append(f"    <lastmod>{escape(lastmod)}</lastmod>")
    for img_loc, caption in images or []:
        lines.append("    <image:image>")
        lines.append(f"      <image:loc>{escape(img_loc)}</image:loc>")
        if caption:
            lines.append(f"      <image:caption>{escape(caption)}</image:caption>")
        lines.append("    </image:image>")
    lines.append("  </url>")
    return lines


def main():
    with open(CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)

    base_url = catalog.get("baseUrl", "").rstrip("/")
    categories = catalog.get("categories", [])

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
        ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ]

    url_count = 0
    image_count = 0

    # Static pages.
    for path in ("/", "/photography/", "/about/"):
        lines += url_entry(f"{SITE_ORIGIN}{path}")
        url_count += 1

    # Category and album pages (stable ordering: as listed in catalog.json).
    for cat in categories:
        cat_id = cat.get("id")
        if cat_id is None:
            continue

        # Category index page — skipped for flat categories (they link
        # straight to an album, so there is no standalone category page).
        if not cat.get("flat"):
            loc = f"{SITE_ORIGIN}/photography/?cat={cat_id}"
            lines += url_entry(loc)
            url_count += 1

        for album in cat.get("albums", []):
            album_id = album.get("id")
            folder = album.get("folder", "")
            if album_id is None:
                continue

            loc = f"{SITE_ORIGIN}/album.html?cat={cat_id}&album={album_id}"
            lastmod = normalize_lastmod(album.get("date"))

            images = []
            for photo in album.get("photos", []):
                filename = photo.get("filename")
                if not filename:
                    continue
                img_loc = f"{base_url}/{folder}/{filename}"
                images.append((img_loc, photo.get("caption") or None))
                image_count += 1

            lines += url_entry(loc, lastmod=lastmod, images=images)
            url_count += 1

    lines.append("</urlset>")
    lines.append("")  # trailing newline

    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(
        f"Wrote {SITEMAP_PATH}: {url_count} URLs, {image_count} image entries.",
        file=sys.stdout,
    )


if __name__ == "__main__":
    main()
