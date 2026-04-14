# Prompt 18 — README and Documentation

Write a comprehensive `README.md` for this project. It should be useful both as a setup guide for someone deploying their own instance and as a reference for ongoing maintenance.

## Sections to include

### Overview
- What the site is (static photography portfolio)
- One-line summary of the tech stack
- "How it works" in 4 bullet points

### Architecture
- Upload → publish flow as an ASCII diagram (iPad → R2 → GitHub Actions → GitHub Pages)
- Browser rendering flow as an ASCII diagram (fetch catalog → hero / tiles / albums → PhotoSwipe)
- R2 bucket layout: show both flat category layout and album-based category layout with annotated directory trees

### Bucket layout rules
- `_hero/` for hero images
- Top-level folders are categories
- Flat vs album-based: when photos are at the category root vs in sub-folders
- Albums win if both exist for the same category
- Each category needs `cover.jpg`; each album needs `cover.jpg`
- `_draft-` prefix to hide folders
- `_thumbs/` is auto-generated — do not modify

### Project structure
- File tree with one-line descriptions for each file

### Setup sections (numbered)
1. Cloudflare R2 setup (create bucket, enable public access, create API token)
2. GitHub Pages setup (deploy from branch, custom domain, enforce HTTPS)
3. Namecheap DNS records (table of A records and CNAME for GitHub Pages IPs)
4. GitHub Secrets setup (table of the five required secrets)
5. iPad upload workflow (S3 Files app setup, per-shoot workflow for flat and album-based categories)
6. Lightroom export settings (table: format, quality, color space, size, metadata)

### Optional manifest.json
- Schema and example
- All fields optional; missing fields fall back gracefully

### Ongoing Maintenance
- How to add photos to a flat category
- How to add a new album
- How to hide a folder with `_draft-`
- How to edit an album title via manifest.json
- How to update hero images (mention orientation — both landscape and portrait)
- How to rename a category display name via `CATEGORY_NAMES` in build_catalog.py
- How to convert a flat category to album-based
- How to manually trigger the catalog rebuild

### Troubleshooting
- Photos not appearing
- EXIF not showing (export settings, force re-read by deleting from `_thumbs/`)
- Thumbnails not generating
- Site not updating after commit
- DNS not resolving
- Hero images not showing for a given screen orientation
