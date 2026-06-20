# Roadmap

Forward-looking plan based on the performance/UX audit of 2026-06-11. Each phase is
independently shippable; order reflects impact-per-effort, not dependencies (the few
real dependencies are noted inline).

## Audit summary (what's wrong today)

| # | Finding | Severity |
|---|---------|----------|
| 1 | Homepage downloads **all** `_hero/` images at full resolution on load — stacked `inset:0` slides defeat `loading="lazy"` (~23 originals today) | 🔴 Critical |
| 2 | Images served from `pub-….r2.dev`, which Cloudflare rate-limits and excludes from CDN caching; no `Cache-Control` headers on objects | 🔴 Critical |
| 3 | Thumbnails are 500px JPEG q90 — soft on retina (grid cells need ~800px at 2× DPR), no WebP/AVIF | 🟠 High |
| 4 | Lightbox always loads camera-original full-res; `buildPswpSrcset()` in `gallery.js` already supports `photo.sizes[]` but the pipeline never generates `_resized/` variants (dead code path) | 🟠 High |
| 5 | Open Graph tags are set by JavaScript — social scrapers don't run JS, so **shared links have no image preview today** | 🟠 High |
| 6 | No sitemap.xml, no robots.txt, no JSON-LD; uncaptioned photos get `alt=""` | 🟡 Medium |
| 7 | Album grid uses CSS `columns: 3`, which reorders photos top-to-bottom per column — curated Lightroom sequence is scrambled vs. the lightbox's DOM order | 🟡 Medium |
| 8 | Lightbox reserves a 200px bottom info panel even when a photo has no caption/EXIF | 🟡 Medium |
| 9 | Cover matching is case-insensitive but catalog writes literal `cover.jpg`; a `Cover.JPG` upload yields a broken cover URL (R2 keys are case-sensitive) | 🟡 Medium |
| 10 | Third-party render chain: PhotoSwipe from jsdelivr, Space Grotesk via CSS `@import` of Google Fonts, `tokens.css` via `@import` | 🟢 Low |
| 11 | Originals in R2 keep full EXIF — verify Lightroom export strips GPS (privacy/trust) | 🟢 Low |

What's already **good** (don't churn): lazy-loading discipline (`loading`, `decoding`,
`fetchpriority`, `aspect-ratio` reservation), incremental catalog builds that preserve
hand-edited captions/dates, the PhotoSwipe lightbox with EXIF panel + share permalinks,
overall whitespace/typography.

---

## Phase 1 — Stop the bleeding (pure code, ~1 session) ✅ COMPLETE

- [x] **Hero lazy slideshow** (`js/hero.js`): create `<img>` without `src`; assign `src`
      only for the active slide and preload one ahead each cycle. Fixes finding #1.
- [x] **Fix cover case bug** (`scripts/build_catalog.py`): build cover URL from the
      preserved `cover_file` / actual key, not literal `cover.jpg`. Finding #9.
- [x] **`preconnect` to the image host** in `<head>` of all pages.
- [x] **Collapse empty lightbox info panel** (`js/gallery.js` `paddingFn` + panel CSS). Finding #8.

## Phase 2 — CDN & caching (one dashboard step + code)

- [ ] **Manual (Neil, Cloudflare dashboard):** connect a custom domain
      (e.g. `img.neilkodner.com`) to the R2 bucket; add a Cache Rule with long edge TTL.
      Then update the `R2_PUBLIC_BASE_URL` GitHub secret — `catalog.json` picks it up on
      the next 30-min run; no frontend change needed.
      ⚠️ Still TODO — only Neil can do this in the Cloudflare dashboard.
- [x] **`Cache-Control` headers**: `CacheControl="public, max-age=31536000, immutable"`
      in `put_bytes()` for generated thumbs; `--header-upload "Cache-Control: …"` in
      `scripts/upload-to-r2.sh` for originals. Filenames are content-stable, so immutable is safe.
      (Code in place; headers apply only to objects written *after* this change.)

## Phase 3 — Modern image pipeline (Python only; frontend already ready)

- [x] **WebP thumbnails, 800px long edge, q≈75** in `make_thumbnail()`. New `.webp` keys
      miss the existence check, so the first run regenerates all thumbs — that *is* the
      migration. `thumbUrl()` now swaps the extension to `.webp` (contract mirrored in
      `thumb_key_for()`); frontend `setThumb()` falls back to the legacy JPEG thumb during
      the migration window. Finding #3.
- [x] **Generate `_resized/1200/` and `_resized/2000/` variants** in the same loop
      (original already in memory) and write `photo.sizes[]` to the catalog — this lights
      up the existing `buildPswpSrcset()` with zero frontend changes. Finding #4.
- [x] **Resize hero images** (~2560px long edge, `_resized/hero/`) and point
      `hero.js` at them. Heroes ≤2560px keep their original; entries gain a `resized`
      path that `hero.js` prefers via the lazy-load scheme. Finding #1 (compounds).

## Phase 4 — Social previews & SEO (build-time generation)

- [x] **Inject a real `og:image`** into `index.html` from the Action: `build_seo.py`
      rewrites the tag between `<!-- og:image:start/end -->` markers (prefers the
      resized hero), committed alongside `catalog.json`. Finding #5.
- [ ] **Generate static per-album stub pages** (`/photography/<cat>/<album>/index.html`)
      with correct `og:title`/`og:image`/JSON-LD that hand off to the existing JS album
      page. Optionally per-photo stubs later.
      ⏸ Deferred — routing/sitemap-canonicalization decision; wants a deliberate call.
- [x] **Generate `sitemap.xml`** (with image-sitemap entries) **and `robots.txt`** from
      the catalog. (New `scripts/build_seo.py`, wired into the Action.) Finding #6.
- [x] **Alt-text fallback** (done frontend-side in `gallery.js` rather than the catalog):
      `photo.caption || \`${pageTitle}, photo ${i + 1}\``. Finding #6.

## Phase 5 — Presentation craft (design decisions, take slowly)

- [ ] **Justified-row album grid** (vanilla flex, grow by aspect ratio) to preserve the
      curated photo sequence; decide deliberately vs. keeping the contact-sheet columns look. Finding #7.
- [ ] **Self-host PhotoSwipe + Space Grotesk**; replace CSS `@import`s with `<link>` tags. Finding #10.
- [ ] **RSS/Atom feed** of latest albums, generated by the catalog script — fits the
      "Instagram alternative" goal.
- [ ] **Verify Lightroom export preset strips GPS** from originals (or strip in pipeline). Finding #11.

---

*Notes: thumbnail/variant regeneration downloads each original once — fine at current
catalog size (~28 photos + 23 hero). R2 egress is free; the cost model is unaffected by
any of the above.*
