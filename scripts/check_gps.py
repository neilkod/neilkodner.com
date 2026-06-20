#!/usr/bin/env python3
"""check_gps.py — audit R2 originals for embedded GPS coordinates.

Privacy check for roadmap finding #11. The build pipeline already strips EXIF
from every generated derivative (make_thumbnail / make_resized / make_hero all
save without `exif=`), and the catalog never records GPS — so the only place a
location could leak is a camera-original uploaded via upload-to-r2.sh and served
full-res by the lightbox. This script downloads each original and reports any
that still carry GPS lat/long.

Run with the same R2_* env vars as build_catalog.py (locally or in CI):

    python scripts/check_gps.py

Exits 1 if any original contains GPS coordinates, 0 if all clean.
"""

import io
import os
import sys

GPS_IFD = 0x8825                     # EXIF GPSInfo IFD pointer
SKIP_PREFIXES = ("_thumbs/", "_resized/")   # generated derivatives, not originals
ORIGINAL_EXTS = (".jpg", ".jpeg", ".png", ".tif", ".tiff")


def is_original(key: str) -> bool:
    """True for camera-original photo keys (skip generated + draft folders)."""
    if any(key.startswith(p) for p in SKIP_PREFIXES):
        return False
    if key.startswith("_draft-") or "/_draft-" in key:
        return False
    return key.lower().endswith(ORIGINAL_EXTS)


def has_gps(data: bytes) -> bool:
    """True if the image carries GPS latitude/longitude EXIF."""
    from PIL import Image
    try:
        exif = Image.open(io.BytesIO(data)).getexif()
        gps = exif.get_ifd(GPS_IFD) if exif else {}
        return bool(gps and (gps.get(2) or gps.get(4)))  # 2=lat, 4=long
    except Exception:
        return False


def main():
    # Imported here so the module loads without boto3 for --help / py_compile.
    from build_catalog import make_client, list_all_keys, get_bytes

    bucket = os.environ["R2_BUCKET_NAME"]
    s3 = make_client()
    keys = [k for k in list_all_keys(s3, bucket) if is_original(k)]
    print(f"Auditing {len(keys)} originals for GPS…")

    flagged = []
    for key in keys:
        if has_gps(get_bytes(s3, bucket, key)):
            flagged.append(key)
            print(f"  GPS PRESENT: {key}")

    if flagged:
        print(f"\n{len(flagged)} original(s) contain GPS coordinates — "
              f"re-export from Lightroom with 'Remove Location Info' enabled.")
        sys.exit(1)
    print("No GPS coordinates found in any original. ✓")


if __name__ == "__main__":
    required = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"ERROR: missing environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(2)
    main()
