# Photography by Neil Kodner

Personal photography portfolio — neilkodner.com

Static HTML/CSS/JS. No frameworks, no build tools. Images on Cloudflare R2. Deployed via GitHub Pages. Catalog generated automatically by GitHub Actions.

Warm light theme. Cormorant Garamond display font. PhotoSwipe v5 lightbox with per-photo permalink URLs and a structured EXIF table.

---

## How it works

1. You upload photos to a Cloudflare R2 bucket from your iPad.
2. A GitHub Action runs every 30 minutes, scans R2, generates thumbnails, extracts EXIF metadata, and writes `catalog.json`.
3. GitHub Pages redeploys the site.
4. The site fetches `catalog.json` on load and renders everything dynamically.

No CMS. No server. No git commands after initial setup.

---

## Architecture

### Upload → publish flow

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR IPAD                                                  │
│                                                             │
│  Lightroom Mobile                                           │
│       │  export JPEG (3000px, quality 85)                   │
│       ▼                                                     │
│  S3 Files app                                               │
│       │  upload to aviation/img001.jpg          (flat)      │
│       │          or aviation/oshkosh-2024/img001.jpg (album) │
└───────┼─────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────┐
│  CLOUDFLARE R2        │
│                       │
│  _hero/               │
│  aviation/            │
│    cover.jpg          │
│    img001.jpg  ◄──────┘  (flat: photos at category level)
│  places/              │
│    cover.jpg          │
│    boston-2025/       │
│      cover.jpg        │
│      img001.jpg  ◄────┘  (album: photos inside sub-folder)
│  _thumbs/  (written   │
│   by GitHub Action)   │
└───────────┬───────────┘
            │
            │  every 30 min (or manual trigger)
            ▼
┌───────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS  (ubuntu-latest runner)                   │
│                                                           │
│  1. checkout repo                                         │
│  2. pip install boto3 Pillow                              │
│  3. scripts/build_catalog.py                              │
│       • list all R2 objects                               │
│       • skip _draft- folders                              │
│       • detect flat vs album-based categories             │
│       • read manifest.json metadata                       │
│       • download new photos → get dimensions + EXIF       │
│       • generate _thumbs/ (500px long edge)               │
│       • upload thumbnails back to R2                      │
│       • merge with existing catalog (preserve captions,   │
│         captions, EXIF, and dimensions)                   │
│       • write catalog.json                                │
│  4. git commit catalog.json                               │
│  5. git push  →  triggers GitHub Pages redeploy           │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────┐
│  GITHUB PAGES                 │
│  neilkodner.com               │
│                               │
│  static files served:         │
│  index.html                   │
│  photography/index.html       │
│  album.html                   │
│  app.js / hero.js / gallery.js│
│  catalog.json  ◄── updated    │
└───────────────────────────────┘
```

### Browser rendering flow

```
  Browser loads neilkodner.com
          │
          ▼
  fetch /catalog.json  ──────────────────────────────────┐
          │                                               │
          ├── hero[]          ──► hero.js                 │
          │                       crossfade slideshow     │
          │                       filtered by viewport    │
          │                       orientation (landscape  │
          │                       vs portrait images)     │
          │                                               │
          ├── categories[]    ──► app.js                  │
          │                       category tile covers    │
          │                       from R2 _thumbs/        │
          │                       flat categories link    │
          │                       directly to album page  │
          │                                               │
          └── latest albums   ──► app.js                  │
                                  4 newest across all     │
                                  categories              │
                                                          │
  User clicks category or album                           │
          │                                               │
          ▼                                               │
  album.html?cat=aviation&album=aviation  (flat)          │
  album.html?cat=places&album=boston-2025 (album)         │
          │                                               │
          ▼                                               │
  gallery.js reads catalog.json ◄────────────────────────┘
          │
          ├── renders thumbnail grid
          │   images from R2 _thumbs/
          │
          └── user clicks photo
                    │
                    ▼
              PhotoSwipe v5 lightbox
              full-res image
              EXIF table below photo
              URL hash updates to #filename
              share button copies /photo/ permalink
                    │
                    ▼ (share link)
              /photo/?cat=…&album=…&photo=…
              editorial single-photo page
              full-res image · EXIF · prev/next nav
```

### R2 bucket layout

There are two ways to organize a category: **flat** (no sub-albums) or **album-based**.

**Flat category** — photos sit directly inside the category folder:

```
neilkodner-photos/
├── aviation/
│   ├── cover.jpg          ← category cover (required)
│   ├── img001.jpg
│   └── img002.jpg
```

**Album-based category** — photos are grouped in named sub-folders:

```
neilkodner-photos/
├── places/
│   ├── cover.jpg          ← category cover (required)
│   └── boston-2025/
│       ├── manifest.json  ← optional title/date/location
│       ├── cover.jpg      ← album cover (required)
│       ├── img001.jpg
│       └── img002.jpg
```

Full example with all current categories:

```
neilkodner-photos/
│
├── _hero/                        ← hero slideshow images
│   ├── hero1.jpg
│   └── hero2.jpg
│
├── _thumbs/                      ← generated by GitHub Action — do not modify
│   ├── aviation/
│   │   ├── cover.jpg
│   │   ├── img001.jpg
│   │   └── ...
│   └── places/
│       ├── cover.jpg
│       └── boston-2025/
│           ├── cover.jpg
│           └── img001.jpg
│
├── aviation/                     ← flat: photos at top level
│   ├── cover.jpg
│   ├── img001.jpg
│   └── img002.jpg
│
├── hockey/                       ← album-based
│   ├── cover.jpg
│   └── sharks-vs-kings-jan-2025/
│       ├── cover.jpg
│       ├── img001.jpg
│       └── img002.jpg
│
├── birds/                        ← album-based
│   ├── cover.jpg
│   └── shorebirds/
│       ├── cover.jpg
│       └── img001.jpg
│
└── places/                       ← album-based (display name overridden from "travel")
    ├── cover.jpg
    └── boston-2025/
        ├── cover.jpg
        └── img001.jpg
```

Rules:
- `_hero/` — hero slideshow images (any filename). Mix landscape and portrait freely; the site automatically serves the right orientation based on the viewer's screen.
- Top-level folders (no leading `_`) are **categories**
- If a category has photos directly inside it (no sub-folders), it is **flat** — clicking the tile goes straight to the photo grid
- If a category has sub-folders, those sub-folders are **albums** — clicking the tile shows the album grid
- If both exist, albums take precedence
- Each category needs a `cover.jpg` at the category level
- Each album needs a `cover.jpg` at the album level
- Prefix any folder with `_draft-` to hide it from the site
- `_thumbs/` is written by the automation — do not modify

---

## Project structure

```
neilkodner.com/
├── index.html              Home page
├── photography/index.html  Category and album grids
├── album.html              Single album view + PhotoSwipe
├── about/index.html        About page
├── 404.html                Custom not-found page
├── app.js                  Shared catalog loading and tile rendering
├── hero.js                 Hero slideshow (orientation-filtered)
├── gallery.js              PhotoSwipe lightbox and album rendering
├── photo.js                Single-photo page rendering
├── photo/index.html        Dedicated photo permalink page
├── tokens.css              Design tokens (colors, fonts, spacing)
├── style.css               All component styles
├── print.css               Print stylesheet
├── favicon.svg             NK monogram favicon
├── catalog.json            Generated — do not edit by hand
├── scripts/
│   ├── build_catalog.py    Catalog builder (run by GitHub Action)
│   └── requirements.txt    Python dependencies
└── .github/workflows/
    └── update-catalog.yml  GitHub Action definition
```

---

## 1 — Cloudflare R2 Setup

### Create a bucket

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. Go to **R2 Object Storage** → **Create bucket**.
3. Name it (e.g. `neilkodner-photos`). Region: Automatic.
4. Click **Create bucket**.

### Enable public access

1. Open the bucket → **Settings** tab.
2. Under **Public access**, click **Allow Access**.
3. Copy the **Public bucket URL** — it looks like:
   `https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev`
4. Save this URL; it becomes `R2_PUBLIC_BASE_URL` in GitHub Secrets.

### Create an API token

1. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**.
2. Permissions: **Object Read & Write**.
3. Specify your bucket (or leave as All buckets).
4. Click **Create API Token**.
5. Save the **Access Key ID** and **Secret Access Key** — shown once.

### Bucket folder structure

See the [R2 bucket layout](#r2-bucket-layout) section above.

---

## 2 — GitHub Pages Setup

1. Push this repository to GitHub.
2. Go to the repo → **Settings** → **Pages**.
3. Source: **Deploy from a branch**.
4. Branch: `main` — folder: `/ (root)`.
5. Click **Save**.

GitHub Pages will assign a URL like `https://neilkodner.github.io/neilkodner.com/`.
After DNS is configured it will serve at `neilkodner.com`.

**Custom domain:**
1. In **Settings → Pages**, enter `neilkodner.com` under Custom domain.
2. GitHub creates a `CNAME` file in your repo automatically.
3. Check **Enforce HTTPS** once the certificate provisions (a few minutes).

---

## 3 — Namecheap DNS Records

Log in to Namecheap → **Domain List** → **Manage** → **Advanced DNS**.

Add these records:

| Type  | Host | Value                         | TTL        |
|-------|------|-------------------------------|------------|
| A     | @    | `185.199.108.153`             | Automatic  |
| A     | @    | `185.199.109.153`             | Automatic  |
| A     | @    | `185.199.110.153`             | Automatic  |
| A     | @    | `185.199.111.153`             | Automatic  |
| CNAME | www  | `neilkodner.github.io`        | Automatic  |

These are GitHub Pages' current IP addresses. The `www` CNAME redirects to the apex domain via GitHub's infrastructure.

DNS propagation takes a few minutes to a few hours. Check with:
```
dig neilkodner.com
```

---

## 4 — GitHub Secrets Setup

In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name            | Where to find it                                      |
|------------------------|-------------------------------------------------------|
| `R2_ENDPOINT`          | `https://<account_id>.r2.cloudflarestorage.com` — find your Account ID on the R2 overview page |
| `R2_ACCESS_KEY_ID`     | From the API token you created                        |
| `R2_SECRET_ACCESS_KEY` | From the API token you created                        |
| `R2_BUCKET_NAME`       | The bucket name (e.g. `neilkodner-photos`)            |
| `R2_PUBLIC_BASE_URL`   | The public bucket URL (e.g. `https://pub-xxxx.r2.dev`) |

After adding all five secrets, trigger the workflow manually:
**Actions → Update Catalog → Run workflow**.

Watch the run log to confirm it connects to R2 and writes `catalog.json`.

---

## 5 — iPad Upload Workflow

**Recommended app:** [Creativit S3 Files](https://apps.apple.com/app/id1440621285) or [Cyberduck](https://apps.apple.com/app/id409222199)

### One-time app setup (S3 Files example)

1. Open S3 Files → **Add Connection**.
2. Select **S3-Compatible**.
3. Server: your R2 endpoint (e.g. `abc123.r2.cloudflarestorage.com`)
4. Access Key / Secret: paste from the R2 API token.
5. Bucket: your bucket name.
6. Save.

### Per-shoot workflow — flat category (e.g. aviation)

```
1. Edit photos in Lightroom Mobile
2. Export (see Lightroom settings below)
3. Open S3 Files
4. Navigate to the category folder:
      aviation/
5. Upload all exported JPEGs
6. Upload a cover.jpg (your best shot — replaces the existing category cover)
7. Wait up to 30 minutes for the GitHub Action to run
   — or trigger it manually from GitHub Actions
```

### Per-shoot workflow — album-based category (e.g. places)

```
1. Edit photos in Lightroom Mobile
2. Export (see Lightroom settings below)
3. Open S3 Files
4. Navigate to (or create) the album folder:
      places/boston-march-2025/
5. Upload all exported JPEGs
6. Upload a cover.jpg (your best shot from the album)
7. Optionally create and upload a manifest.json with title/date/location
8. Wait up to 30 minutes for the GitHub Action to run
   — or trigger it manually from GitHub Actions
```

The site updates automatically. No git commands needed.

---

## 6 — Lightroom Export Settings

**Primary workflow: Lightroom Mobile on iPad Pro.** Primary camera: Sony Alpha (ARW). Settings apply to any other camera Lightroom supports.

### Lightroom Mobile export settings (iPad)

In Lightroom Mobile: open the photo → **•••** → **Share** → **Export As…**

| Setting    | Value                                       |
|------------|---------------------------------------------|
| Format     | JPEG                                        |
| Quality    | 90 (slide to ~90%)                          |
| Dimensions | Custom — Long Edge 3000 px                  |
| Include    | All Metadata ✓                              |

**What Lightroom Mobile cannot do (vs. desktop):**

- **No color space selector.** LR Mobile JPEG exports are sRGB. There is no Display P3 option. sRGB is fine for this workflow — browsers on all devices render it correctly. If you ever export from Lightroom Classic on a Mac, use Display P3 instead for noticeably more vibrant colors on wide-gamut displays (iPhone, iPad Pro, MacBook).
- **No output sharpening.** "Screen → High" is a desktop-only export feature. Use the Detail panel workaround below instead.

**Sharpening workaround for LR Mobile:**
Output sharpening (desktop) is calibrated to the final export size. LR Mobile lacks this, but you can approximate the effect in the editing panels before export:

- **Detail → Sharpening:** Amount 70–80, Radius 0.8–1.0, Masking 20–40 (hold Alt/Option on desktop to visualise; on iPad, adjust until edges sharpen without noise)
- **Texture: +10 to +20** — adds micro-contrast that compensates for the softening introduced when the browser downscales a 3000 px image

Apply these globally as a preset or as part of your standard edit so you don't have to remember them per shot.

**Quality 90:** At 85 (the old recommendation), JPEG artifacts appear first in high-frequency detail — feathers, fur, rivets, ice texture, bokeh edges. At 90 they are essentially gone. Files land around 2–5 MB, which is fine over LTE/Wi-Fi.

**Long edge 3000 px for both orientations:** 3000 px is sufficient for 2× Retina at the photo page width (960 px) and the full-viewport lightbox. Portrait images were previously recommended at 2400 px, which can look soft on large monitors.

**All Metadata:** Required for the build script to display camera body, lens, focal length, aperture, shutter speed, and ISO in the photo viewer. Sony Alpha ARW files carry full EXIF including lens data for native E-mount and A-mount lenses. If you use adapted lenses (e.g. via LA-EA5 or third-party adapters), lens name and focal length may not be embedded — some adapters do not pass that data through to the ARW file.

**Naming:** Any filename works. Album photo order is alphabetical, so Sony's default `DSC09999.jpg` / `_DSC0001.ARW` scheme is fine for a single shoot. Be aware that Sony resets its counter and changes the filename prefix (DSC → \_DSC) when crossing 9999, which can split a shoot alphabetically — rename if that affects a single album.

### If you export from Lightroom Classic on a Mac

Use these settings instead for the best possible output:

| Setting           | Value                |
|-------------------|----------------------|
| Quality           | 90–92                |
| Color Space       | Display P3           |
| Long edge         | 3000 px              |
| Output Sharpening | Screen, High         |
| Metadata          | All                  |

Display P3 makes a visible difference for saturated subjects — bird plumage, aircraft livery, jersey colors, arena lighting. Browsers on all modern Apple devices (and most Windows monitors made after ~2020) will render the wider gamut. Older sRGB-only displays still render it correctly.

---

## Optional manifest.json

Create `manifest.json` inside any **album** folder to override its metadata:

```json
{
  "title": "EAA AirVenture Oshkosh 2024",
  "date": "2024-07",
  "location": "Oshkosh, Wisconsin"
}
```

All fields are optional. Missing fields fall back to the existing catalog value, then to the folder name.

---

## Ongoing Maintenance

**Add photos to a flat category (e.g. aviation):**
Upload photos directly to `aviation/`. The next Action run adds them automatically.

**Add a new album (e.g. places):**
Upload photos to `places/new-trip-name/` with a `cover.jpg`. The next Action run adds it automatically.

**Hide a folder while editing:**
Rename the folder to `_draft-folder-name/`. Rename it back when ready.

**Edit an album title without renaming the folder:**
Add or update `manifest.json` inside the album folder.

**Update the hero images:**
Upload new JPEGs to `_hero/`. Add both landscape and portrait images for the best experience — the site automatically shows landscape images on wide screens and portrait images on tall screens. Remove old files to stop them from cycling.

**Rename a category's display name:**
Edit `CATEGORY_NAMES` in `scripts/build_catalog.py`. For example, the `travel` folder currently displays as "Places":
```python
CATEGORY_NAMES = {"travel": "Places"}
```

**Convert a flat category to album-based:**
Move the photos from the category root into a sub-folder (e.g. `aviation/oshkosh-2024/`), add a `cover.jpg` to that sub-folder, and keep `cover.jpg` at the category root. The next Action run detects the albums and switches the category to album mode.

**Manually trigger a catalog rebuild:**
GitHub repo → **Actions** → **Update Catalog** → **Run workflow**.

---

## Troubleshooting

**Photos not appearing after upload**
- Check the GitHub Action ran (Actions tab). If it failed, read the log.
- Confirm `cover.jpg` exists in the category (and album, if album-based).
- Confirm the folder is not prefixed `_draft-`.

**EXIF not showing in the photo viewer**
- Lightroom must export with metadata included (not "Copyright only").
- EXIF is read when the photo is first downloaded by the Action. To force a re-read, delete the photo's entry from `_thumbs/` in R2 and re-run the Action.
- Only fields present in the image are shown; photos with no EXIF data will show an empty panel.

**Permalink not opening the right photo**
- The URL hash is the filename without extension (e.g. `#IMG_0042`).
- Hashes are case-sensitive — confirm the filename case matches what the catalog recorded.

**Thumbnails not generating**
- Check the Action log for `WARN` lines.
- Confirm the R2 API token has write permission.

**Site not updating after catalog commit**
- Check **Settings → Pages** — Pages deployment may have failed.
- The Action commits with `[skip ci]`; a subsequent photo upload or manual trigger will redeploy.

**DNS not resolving**
- Propagation can take up to 24 hours.
- Verify records with `dig neilkodner.com +short`.

**Hero images not showing for my screen orientation**
- The site picks landscape images for wide screens and portrait images for tall screens.
- If one orientation has no images, it falls back to the full set.
- Add appropriately oriented images to `_hero/` and re-run the Action.
