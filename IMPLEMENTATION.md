# Implementation spec

Executable companion to [`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md). That document
explains *why*. This one says *exactly what to do*, in an order that works, with no
decisions left open.

---

## How to use this document

**If you are an AI agent working on this repo, read this section fully before touching
anything.**

1. **Work one task at a time.** Tasks are `T0`…`T12`. Each has explicit preconditions,
   exact file paths, a verification step, and a commit message. Do not start a task whose
   preconditions aren't met.
2. **Do not make design decisions.** Every open decision was already resolved in
   `ARCHITECTURE_REVIEW.md`. If a task seems to require a judgment call that isn't written
   down here, **stop and ask**. Do not infer, do not pick "the sensible default," do not
   scope-creep. An unasked question is much cheaper than a wrong guess.
3. **The Contracts appendix (§C) is binding.** Key schemes, JSON shapes, and cookie
   formats are specified there byte-for-byte because two independent pieces of code have
   to agree on them. If your implementation disagrees with §C, your implementation is
   wrong.
4. **Verify before committing.** Every task has a "Verify" block with a runnable command
   and the expected result. Run it. If it doesn't match, fix it or stop and ask — do not
   commit and note the discrepancy.
5. **One commit per task**, using the message given. Don't batch tasks into one commit.
6. **Do not edit `ROADMAP.md` or `ARCHITECTURE_REVIEW.md`.** They're historical records.
   If reality diverges from them, say so in your reply; don't silently rewrite them.

### Repo invariants — breaking any of these is a bug, not a tradeoff

- **No build step.** No `package.json`, no bundler, no npm dependencies for the site
  itself. Files are edited and served directly. The Cloudflare Worker in `worker/` is the
  one exception and it has its own `package.json`; nothing in the site root gets one.
- **Vendored third-party code goes in `/vendor/`**, following how PhotoSwipe is handled.
  No CDN `<script>` tags. No `@import` of remote CSS.
- **ES modules only**, imported with absolute paths (`/js/app.js`), matching existing code.
- **`catalog.json` is generated.** Never hand-edit it. Never commit a hand-edited version.
- **The `_thumbs/` and `_resized/` key schemes are a contract between Python and
  JavaScript**, documented in `scripts/build_catalog.py:thumb_key_for()` and
  `js/app.js:thumbUrl()`. If you change one you must change all of them, and §C.1 is the
  source of truth.
- **Secrets never enter the repo.** R2 credentials, the upload password, and the HMAC
  signing key live in GitHub repository secrets and Cloudflare Worker secrets only.

---

## Task index

| Task | What | Who | Effort | Depends on |
|---|---|---|---|---|
| **T0** | Fix `catalog.json` commit churn | 🤖 Agent | 30 min | — |
| **T1** | Extract `site.config.json` | 🤖 Agent | 1 h | — |
| **T2** | HEIC decode spike on a real iPhone | 👤 **Neil** | 15 min | — |
| **T3** | Create Worker, R2 CORS, secrets | 👤 **Neil** | 30 min | — |
| **T4** | Worker: auth routes | 🤖 Agent | 1–2 h | T3 |
| **T5** | Worker: presign route | 🤖 Agent | 1–2 h | T4 |
| **T6** | Worker: publish route | 🤖 Agent | 1–2 h | T5 |
| **T7** | `repository_dispatch` trigger | 🤖 Agent | 15 min | — |
| **T8** | Upload page: shell + login | 🤖 Agent | 1–2 h | T4 |
| **T9** | Upload page: file staging + EXIF | 🤖 Agent | 2–3 h | T8, T2 |
| **T10** | Upload page: metadata form | 🤖 Agent | 2 h | T9 |
| **T11** | Upload page: transfer + progress | 🤖 Agent | 2–3 h | T5, T10 |
| **T12** | Browser-generated derivatives | 🤖 Agent | 1–2 h | T11 |

**T0, T1, and T7 are standalone.** They touch nothing else and can be done immediately, in
any order, before any of the upload work starts. Start there.

### Not delegated — do not attempt these

| Phase | Why not |
|---|---|
| **DNS / nameserver migration to Cloudflare** | Touches live DNS for a domain that may carry mail. Irreversible-ish, needs a human watching. `ARCHITECTURE_REVIEW.md` §11 Phase 3. |
| **`img.neilkodner.com` R2 custom domain + cache rules** | Cloudflare dashboard, requires the DNS migration first. |
| **Cloudflare Images transformations** | Depends on both of the above. Revisit after they're done. |
| **Renaming/moving existing albums** | Breaks published permalinks in `sitemap.xml`. Open question 4 in the review — unresolved. |

If asked to do any of these, decline and point at this table.

---

## T0 — Fix the `catalog.json` commit churn

**Who:** Agent · **Depends on:** nothing · **Files:** `scripts/build_catalog.py`

### Problem

`build()` writes `"generated": datetime.now(...)` unconditionally, so `catalog.json`
differs on every run even when the bucket hasn't changed. The workflow's
`git diff --staged --quiet` guard therefore never fires. Result: ~1,033 of this repo's
1,083 commits change nothing but that timestamp, each triggering a full Pages rebuild.

### Verified facts you can rely on

- Nothing reads `catalog.generated`. Confirmed by grepping `js/`, `*.html`, and
  `scripts/build_seo.py`. Leaving it stale is safe.
- `scripts/build_seo.py:378` already has `_write_if_changed(path, content)`. Mirror its
  behavior; do not import across scripts.

### The change

In `scripts/build_catalog.py`, in `build()`, replace the final unconditional write:

```python
with open(CATALOG_PATH, "w") as f:
    json.dump(catalog, f, indent=2)
    f.write("\n")
```

with a comparison that ignores `generated` on both sides. Requirements:

- Compare the **serialized** form, not dicts, so formatting changes are caught too.
- Compare with `generated` removed from both the new catalog and the on-disk one.
- If they match, print `catalog unchanged — not rewriting` and return without writing.
- If they differ, write the new catalog **including** its fresh `generated` timestamp.
- Handle `FileNotFoundError` (first run) by writing.
- Keep the existing summary `print()` at the end of `build()` running in both cases.

Suggested shape:

```python
new_text = json.dumps(catalog, indent=2) + "\n"

def _without_generated(text):
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return None
    d.pop("generated", None)
    return json.dumps(d, indent=2, sort_keys=True)

try:
    with open(CATALOG_PATH) as f:
        old_text = f.read()
except FileNotFoundError:
    old_text = ""

if old_text and _without_generated(old_text) == _without_generated(new_text):
    print("catalog unchanged — not rewriting")
else:
    with open(CATALOG_PATH, "w") as f:
        f.write(new_text)
```

### Verify

```bash
# 1. Byte-identical output for an unchanged catalog:
cp catalog.json /tmp/cat-before.json
python3 - <<'EOF'
# Simulate: re-serialize the existing catalog with a NEW timestamp and confirm
# the comparison treats it as unchanged.
import json, datetime, sys
sys.path.insert(0, "scripts")
c = json.load(open("catalog.json"))
c["generated"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
a = dict(c); a.pop("generated")
b = json.load(open("catalog.json")); b.pop("generated")
assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
print("OK: timestamp-only diff correctly detected as unchanged")
EOF

# 2. Confirm catalog.json is untouched by the check itself:
diff -q /tmp/cat-before.json catalog.json && echo "OK: catalog.json not modified"
```

You cannot run `build_catalog.py` end-to-end without R2 credentials. Do not try, and do
not add a mock. The verification above is sufficient.

### Do NOT

- Remove the `generated` field. It's harmless and may be useful for debugging.
- Change the cron schedule in this task. That's a separate decision (see review §11
  Phase 0) and Neil hasn't ruled on it.
- Touch `build_seo.py`.

### Commit

```
Skip catalog.json write when only the timestamp would change

build_catalog.py rewrote `generated` on every run, so the workflow's
"commit if changed" guard never fired — ~1,033 of 1,083 commits in this
repo change nothing else, each triggering a Pages rebuild. Compare the
serialized catalog with `generated` excluded and skip the write when the
content is otherwise identical. Nothing reads the field.
```

---

## T1 — Extract `site.config.json`

**Who:** Agent · **Depends on:** nothing · **Files:** `site.config.json` (new),
`scripts/build_catalog.py`, `scripts/build_seo.py`

Site identity is currently hardcoded in two Python files. Pull it into one JSON file. This
is a pure refactor: **the generated output must not change by a single byte.**

### Create `site.config.json` at the repo root

```json
{
  "siteName": "Photography by Neil Kodner",
  "siteOrigin": "https://neilkodner.com",
  "authorName": "Neil Kodner",
  "tagline": "Los Gatos, California",
  "categoryNames": {
    "travel": "Places"
  }
}
```

### Wire it up

- `scripts/build_catalog.py`: replace the module-level `CATEGORY_NAMES` dict (currently
  `{"travel": "Places"}`) with a load of `categoryNames` from the config. Keep the
  variable name `CATEGORY_NAMES` so the two `CATEGORY_NAMES.get(cat_id) or …` call sites
  don't change.
- `scripts/build_seo.py`: replace the `SITE_ORIGIN = "https://neilkodner.com"` constant
  with `siteOrigin` from the config. Keep the name `SITE_ORIGIN`.
- Both scripts resolve the config relative to the repo root, matching how `build_seo.py`
  already computes `REPO_ROOT` via `os.path.dirname(os.path.dirname(os.path.abspath(__file__)))`.
- If the file is missing or malformed, **exit with a clear error**. Do not fall back to
  defaults — silent fallback would make a typo in the config invisible.

### Verify

```bash
# Snapshot the generated artifacts, re-run the SEO build, confirm zero drift.
mkdir -p /tmp/seo-before
cp sitemap.xml feed.xml index.html /tmp/seo-before/
cp -r photography /tmp/seo-before/photography
python3 scripts/build_seo.py
diff -r /tmp/seo-before/photography photography && \
  diff /tmp/seo-before/sitemap.xml sitemap.xml && \
  diff /tmp/seo-before/feed.xml feed.xml && \
  diff /tmp/seo-before/index.html index.html && \
  echo "OK: no output drift"
```

Expected: `OK: no output drift`. Any diff means the refactor changed behavior — fix it.

### Do NOT

- Introduce a config loader module, a schema validator, or a settings class. Two
  `json.load()` calls.
- Move `siteName`/`tagline` into the HTML templates in this task. The HTML is static and
  hand-edited; templating it is a separate, larger change nobody has asked for.
- Add keys beyond the five above.

### Commit

```
Extract site identity into site.config.json

CATEGORY_NAMES lived in build_catalog.py and SITE_ORIGIN in build_seo.py.
One config file at the repo root, loaded by both. Pure refactor — generated
sitemap, feed, index og:image, and album stubs are byte-identical.
```

---

## T2 — HEIC decode spike 👤 **Neil, on your iPhone**

**Blocks T9.** Everything about client-side image handling assumes mobile Safari can
decode HEIC via `createImageBitmap()`. That's the highest-risk assumption in the plan and
it's cheap to test.

An agent can write the test page. Only you can run it, because it needs a real iPhone and
a real HEIC from your camera roll.

**Agent:** create `scratch/heic-test.html` (gitignored, not committed) that:
- takes `<input type="file" accept="image/*" multiple>`
- for each file: prints name, MIME type, and byte size
- calls `createImageBitmap(file)`, prints the resulting `width`×`height` or the error
- draws it to a canvas at 2560px long edge, calls `canvas.toBlob(…, 'image/jpeg', 0.82)`,
  prints the output byte size
- reports pass/fail per file in large text readable on a phone

**Neil:** serve it (`python3 -m http.server`), open it on your iPhone over your LAN, pick
a few HEIC files straight from the camera roll.

**Record the result here when done:**

- [ ] HEIC decodes via `createImageBitmap` — iOS version: `______`
- [ ] If it fails: T9 must reject HEIC with a clear message, and you'll need
      Settings → Camera → Formats → **Most Compatible**.

---

## T3 — Create the Worker, R2 CORS, and secrets 👤 **Neil, dashboards**

**Blocks T4–T6, T8–T12.** Requires Cloudflare and GitHub account access.

1. **Create the Worker.** Cloudflare dashboard → Workers & Pages → Create → name it
   `neilkodner-upload`. Note the assigned `*.workers.dev` hostname and record it below.
2. **R2 API token** scoped to *Object Read & Write* on the `neilkodner-photos` bucket
   only. (A separate token from the GitHub Actions one — do not reuse.)
3. **Worker secrets** (Settings → Variables → Add secret):
   - `UPLOAD_PASSWORD_SHA256` — SHA-256 hex of your chosen passphrase. Generate with
     `printf '%s' 'your passphrase' | shasum -a 256`. Use a passphrase of 4+ random words.
   - `SESSION_HMAC_KEY` — 32 random bytes, hex. `openssl rand -hex 32`.
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`
   - `GITHUB_DISPATCH_TOKEN` — a fine-grained PAT scoped to this repo only, with
     **Contents: read and write** permission (that's what `repository_dispatch` needs).
4. **R2 bucket CORS.** R2 → `neilkodner-photos` → Settings → CORS policy:
   ```json
   [{
     "AllowedOrigins": ["https://neilkodner.com"],
     "AllowedMethods": ["PUT"],
     "AllowedHeaders": ["content-type"],
     "ExposeHeaders": ["etag"],
     "MaxAgeSeconds": 3600
   }]
   ```
   For local development add `"http://localhost:8000"` to `AllowedOrigins` temporarily.
   Remove it before you're done.

**Record when done:**

- [ ] Worker hostname: `______________________.workers.dev`
- [ ] All seven secrets set
- [ ] CORS policy saved

---

## T4 — Worker: auth routes

**Who:** Agent · **Depends on:** T3 · **Files:** `worker/` (new)

Create a Cloudflare Worker project at `worker/` with `wrangler.toml`, `src/index.js`, and
its own `package.json` (wrangler as the only devDependency). This is the one place in the
repo where npm is allowed.

Routes in this task: `POST /api/login`, `POST /api/logout`, `GET /api/session`.

### Rules

- **`POST /api/login`** — body `{"password": "..."}`. SHA-256 the submitted value and
  compare against the `UPLOAD_PASSWORD_SHA256` secret using **`crypto.subtle.timingSafeEqual`**
  over the raw digest bytes. On success set the session cookie (§C.3) and return
  `200 {"ok": true}`. On failure return `401 {"error": "invalid_password"}` — never echo
  anything about the expected value.
- **Rate limit:** KV counter keyed `login:<cf-connecting-ip>`, TTL 3600s, max **10**
  attempts per hour. Over the limit → `429 {"error": "rate_limited"}` without doing the
  comparison. Bind a KV namespace named `RATE_LIMIT` in `wrangler.toml`.
- **`POST /api/logout`** — clear the cookie (`Max-Age=0`), return `200 {"ok": true}`.
- **`GET /api/session`** — verify the cookie; return `200 {"authenticated": true}` or
  `401 {"authenticated": false}`. The upload page calls this on load to decide whether to
  show the login form.
- **CORS:** allow origin `https://neilkodner.com` exactly (plus `http://localhost:8000`
  when `env.ENVIRONMENT === "dev"`), `Access-Control-Allow-Credentials: true`, and handle
  `OPTIONS` preflight. **Never use `*`** — it's incompatible with credentialed requests
  and would defeat the cookie.
- Every response gets `Cache-Control: no-store`.

### Verify

```bash
cd worker && npx wrangler dev
# In another shell — replace PORT with wrangler's:
curl -si -X POST localhost:PORT/api/login -d '{"password":"wrong"}' | head -1
#   expect: HTTP/1.1 401
curl -si -X POST localhost:PORT/api/login -d '{"password":"<real>"}' | egrep -i 'HTTP/|set-cookie'
#   expect: HTTP/1.1 200, and Set-Cookie with HttpOnly, Secure, SameSite=Lax
curl -si localhost:PORT/api/session -H 'Cookie: nk_sess=<value from above>' | head -1
#   expect: HTTP/1.1 200
curl -si localhost:PORT/api/session -H 'Cookie: nk_sess=tampered.abc' | head -1
#   expect: HTTP/1.1 401
```

### Do NOT

- Store sessions in KV. The token is self-contained and HMAC-signed (§C.3); a session
  store is state you'd have to maintain for no benefit.
- Add user accounts, registration, password reset, or a second user. One shared password.
- Implement "remember me," CSRF tokens, or refresh tokens. `SameSite=Lax` plus a 30-day
  cookie is the whole design.

### Commit

```
Add upload Worker with password auth

Cloudflare Worker at worker/ with /api/login, /api/logout, /api/session.
Constant-time password comparison against a SHA-256 secret, stateless
HMAC-signed session cookie, KV-backed per-IP login rate limiting. Explicit
origin allowlist since credentialed CORS forbids wildcards.
```

---

## T5 — Worker: presign route

**Who:** Agent · **Depends on:** T4 · **Files:** `worker/src/`

`POST /api/presign` returns presigned S3 `PUT` URLs so the browser uploads straight to R2,
never through the Worker. Request/response shapes are in §C.4.

### Validation — this is the security boundary, not the password

Reject the **whole batch** with `400` if any file fails. Partial acceptance would leave
the client in an ambiguous state.

| Check | Rule |
|---|---|
| Session | Valid cookie required, else `401` |
| Batch size | ≤ 50 files, else `400 {"error":"batch_too_large"}` |
| Content type | Must match `^image/(jpeg|png|webp)$` |
| Size | `1 ≤ bytes ≤ 31457280` (30 MB) |
| Key pattern | Must match the regex in §C.2 exactly |
| Reserved prefixes | Keys under `_thumbs/`, `_resized/`, `_hero/` are rejected **unless** the Worker itself derived them in this same request (T12) |
| URL TTL | 300 seconds |

The key regex bans spaces and uppercase in directory segments. That is deliberate — it's
what would have prevented `places/New York City` and `aviation/USAF Thunderbirds` from
existing. Do not loosen it.

**Do not trust the client's `key`.** The client sends `category`, `album`, and `filename`;
the **Worker** constructs the key per §C.2 and returns it. This is the difference between
a validated endpoint and a validated-looking one.

### Verify

```bash
# Valid request → 200 with one url per file
curl -s -X POST localhost:PORT/api/presign -H 'Cookie: nk_sess=<valid>' \
  -H 'content-type: application/json' \
  -d '{"category":"places","album":"tokyo-2026","files":[{"filename":"DSC001.jpg","contentType":"image/jpeg","bytes":700000}]}' | jq .
# Each rejection case → 400, and no URL returned:
#   filename "../../etc/passwd"     → invalid_key
#   category "New York City"        → invalid_key
#   contentType "application/pdf"   → invalid_content_type
#   bytes 99999999                  → file_too_large
#   no cookie                       → 401
```

### Do NOT

- Proxy file bytes through the Worker. Presigned URLs exist so you don't.
- Use the S3 `POST` policy form. Presigned `PUT` only.
- Accept a client-supplied key.

### Commit

```
Add presigned-PUT endpoint to upload Worker

POST /api/presign issues short-lived presigned R2 PUT URLs so the browser
uploads directly to R2. Keys are constructed server-side from category/album/
filename and validated against a strict pattern; content-type, size, and batch
size are capped. This bounds the blast radius if the shared password leaks.
```

---

## T6 — Worker: publish route

**Who:** Agent · **Depends on:** T5 · **Files:** `worker/src/`

`POST /api/publish` runs after all uploads succeed. Shape in §C.5. It:

1. Verifies the session.
2. Writes `manifest.json` to `{category}/{album}/manifest.json` in R2 with `title`, `date`,
   `location` — matching the format `build_catalog.py` already reads (see its
   `manifest.json` handling around line 626). Omit empty fields rather than writing `""`.
3. If a cover was starred, copies that object to `{category}/{album}/cover.jpg`.
   **Lowercase `.jpg` exactly** — R2 keys are case-sensitive and ROADMAP finding #9 was
   about this. Use S3 `CopyObject`, not a re-upload.
4. Fires `repository_dispatch` at `neilkod/neilkodner.com` with
   `{"event_type": "catalog-update"}` using `GITHUB_DISPATCH_TOKEN`.
5. Returns `200 {"ok": true, "albumUrl": "/photography/<cat-slug>/<album-slug>/"}`.

Slugs must be produced by the **same** algorithm as `js/app.js:slugify()` and
`scripts/build_seo.py:slugify()` — see §C.6. Three implementations of one rule now exist;
they must agree or the returned URL will 404.

If the dispatch call fails, still return `200` but with `{"ok": true, "dispatched": false}`.
The upload succeeded; only the rebuild trigger didn't. The cron is the backstop.

### Verify

```bash
curl -s -X POST localhost:PORT/api/publish -H 'Cookie: nk_sess=<valid>' \
  -H 'content-type: application/json' \
  -d '{"category":"places","album":"tokyo-2026","title":"Tokyo 2026","date":"2026-05","location":"Tokyo, Japan","cover":"places/tokyo-2026/DSC001.jpg"}' | jq .
# expect: {"ok":true,"albumUrl":"/photography/places/tokyo-2026/","dispatched":true}
```

Then confirm in the R2 dashboard that `places/tokyo-2026/manifest.json` and `cover.jpg`
exist, and in GitHub Actions that a run was triggered. Clean up the test objects.

### Do NOT

- Write to `catalog.json` from the Worker. The Action owns that file exclusively.
- Trigger `workflow_dispatch` instead of `repository_dispatch` — the former needs
  different token scopes and can't carry a payload.

### Commit

```
Add publish endpoint to upload Worker

POST /api/publish writes manifest.json (title/date/location) and copies the
starred photo to cover.jpg, then fires repository_dispatch to rebuild the
catalog. Slugify mirrors app.js and build_seo.py so the returned album URL
resolves. Publishing succeeds even if the dispatch fails; the cron backstops.
```

---

## T7 — Add `repository_dispatch` to the workflow

**Who:** Agent · **Depends on:** nothing · **Files:** `.github/workflows/update-catalog.yml`

Add a third trigger alongside `schedule` and `workflow_dispatch`:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
  repository_dispatch:
    types: [catalog-update]
```

Change nothing else in the file. Publish latency drops from ≤6 h to roughly the Action's
runtime once T6 is live.

### Verify

```bash
grep -cE '^\s*(schedule|workflow_dispatch|repository_dispatch):' .github/workflows/update-catalog.yml
# expect: 3
grep -A1 'repository_dispatch:' .github/workflows/update-catalog.yml
# expect: types: [catalog-update]
```

(`pyyaml` is not installed in this environment — don't reach for a YAML parser here, and
don't `pip install` one just to validate a three-line change.)

Then confirm it actually fires, once T6 exists:

```bash
gh api repos/neilkod/neilkodner.com/dispatches -f event_type=catalog-update
gh run list --workflow=update-catalog.yml --limit 1
```

### Commit

```
Trigger catalog rebuild on repository_dispatch

Lets the upload Worker rebuild the catalog immediately after a publish
instead of waiting for the 6-hour cron.
```

---

## T8–T11 — The upload page

**Files:** `upload/index.html`, `js/upload.js`, `css/upload.css`, `vendor/exif/`

Split across four tasks so each is reviewable, but they share one design spec. **Read the
design rules below before starting T8.**

### Design rules — binding

The page must look like it belongs to this site. Everything you need already exists in
`css/tokens.css` and `css/style.css`.

**Reuse these exactly:**

| Need | Use |
|---|---|
| Page background | `var(--color-bg)` `#F6F3EE` |
| Text | `var(--color-text)` `#1C1916`, muted `var(--color-text-muted)` |
| Accent (progress, cover star, focus) | `var(--color-accent)` `#C9963A` |
| Field labels | the existing `.label` class — `--text-xs`, `0.09em` tracking, uppercase |
| Buttons | the existing `.btn` class (`css/style.css:681`) |
| Staging grid | the existing `.album-grid` / `.album-grid-item` flex layout |
| Container width | `var(--max-width)` `1400px`, `var(--gutter)` padding |
| Nav | copy the `.site-nav` markup from `index.html` verbatim |
| Rules/dividers | `1px solid var(--color-border)` |

**The core idea:** the staging area *is* a preview of the album page. Set `flex-grow` and
`flex-basis` from each file's aspect ratio exactly the way `js/gallery.js` does (lines
~305–307), so what you stage matches what publishes, including the row rhythm.

**Banned — do not introduce any of these:**

- Cards, panels, or any container with a border-radius over 2px
- Box-shadows of any kind
- Gradients of any kind, especially purple/violet
- Any color not in `tokens.css`
- Spinners, percentage badges, rounded progress pills, toast notifications
- A dashed drag-and-drop rectangle (meaningless on mobile, which is the primary target)
- Sidebars, tabs, modals, accordions
- Any typeface other than Space Grotesk
- Icon libraries. If you need an icon, inline a stroke SVG matching the share icon in
  `js/gallery.js:114`
- Emoji in the UI

**Progress indicator, specifically:** a 2px `var(--color-accent)` rule beneath each
thumbnail that fills left-to-right with a `transform: scaleX()` transition. On completion
it fades out and the thumbnail goes to full opacity via the existing `.loaded` class. That
is the entire treatment.

### T8 — Shell and login

`upload/index.html` + the login half of `js/upload.js`.

- `<meta name="robots" content="noindex, nofollow">` in `<head>`. Non-negotiable.
- On load, `GET /api/session` with `credentials: 'include'`. Authenticated → show the
  upload UI; otherwise → show login.
- Login is a single password field, centered in an otherwise empty page, site wordmark
  above it. No card, no shadow, no icon.
- Wrong password shows an inline message in `--color-text-muted`. Rate-limited (429) shows
  "Too many attempts. Wait an hour."
- Every `fetch` to the Worker needs `credentials: 'include'`.
- Add `/upload/` to the `Disallow` list in `robots.txt` and confirm `build_seo.py` doesn't
  emit it into `sitemap.xml`.

**Verify:** load `/upload/` logged out → login form. Enter the wrong password → inline
error, no console errors. Enter the right one → upload UI, and the cookie is `HttpOnly`
(invisible to `document.cookie` in the console). Reload → still authenticated. Confirm
`curl -s https://neilkodner.com/sitemap.xml | grep -c upload` returns `0`.

**Commit:** `Add password-gated /upload/ page shell`

### T9 — File staging and EXIF

**Precondition: T2 is resolved.**

- `<input type="file" accept="image/*" multiple>`. **Never add the `capture` attribute** —
  it forces the camera and removes the library picker on iOS.
- For each file: parse EXIF from the first 128 KB via `File.slice()` **before** any canvas
  work, since canvas strips metadata. Extract `DateTimeOriginal`, `Make`, `Model`,
  `LensModel`, `FNumber`, `ExposureTime`, `ISOSpeedRatings`, `FocalLength`.
- Format EXIF into the **exact same shape** `scripts/build_catalog.py:extract_exif()`
  produces — see §C.7. Same keys, same string formatting (`"f/2.8"`, `"1/500s"`,
  `"ISO 640"`, `"200mm"`), same make-stripped-from-model rule. The frontend's EXIF panel
  reads these keys directly.
- Vendor a small EXIF reader into `vendor/exif/` following the PhotoSwipe pattern. Pick one
  with no dependencies, under ~15 KB minified. Record its name, version, and license in a
  header comment.
- Decode via `createImageBitmap(file)` in a Web Worker, render the thumbnail preview, and
  compute aspect ratio for the staging grid.
- Show filename, dimensions, and file size under each thumbnail in `.label` style.
- Let files be removed from the staging set before publish.

**Verify:** stage 5+ photos including at least one portrait. The grid should form justified
rows matching an album page. Compare the parsed EXIF for one photo against
`catalog.json`'s entry for a photo from the same camera — the key names and value formats
must match exactly.

**Commit:** `Add file staging and client-side EXIF extraction to upload page`

### T10 — Metadata form

This is the task that fixes the 0-of-7 empty dates. Fields:

- **Category** — `<select>` from `catalog.json` `categories[].id`, plus "New category…"
  which reveals a text input.
- **Album** — `<select>` from that category's `albums[].id`, plus "New album…" and "No
  album (flat category)". This dropdown is what determines flat vs. album-based, so the
  structural decision is a UI choice rather than a folder-layout side effect.
- **Title** — text. Show the derived slug live below it (`places/new-york-city`) using
  §C.6's algorithm, so the URL being created is visible before committing to it.
- **Date** — pre-filled from the `DateTimeOriginal` of the first staged photo, formatted
  `YYYY-MM` to match what `build_catalog.py` and `formatDate()` in `app.js` expect. Editable.
- **Location** — text. Persist the last value per category in `localStorage`.
- **Cover** — tap a staged thumbnail to star it. Amber dot in the corner, nothing else.
- **Draft** — checkbox. When on, the Worker prefixes the album folder with `_draft-`.

Disable Publish until category, album (or flat), and title are valid.

**Verify:** pick an existing category → its albums populate. Type a title with spaces and
capitals → the slug preview lowercases and hyphenates identically to `app.js:slugify()`.
The date pre-fills from EXIF. Starring a thumbnail moves the dot.

**Commit:** `Add album metadata form to upload page`

### T11 — Transfer and progress

- **Downscale before upload.** Resize to **2560 px long edge, JPEG quality 0.82** in a Web
  Worker via `OffscreenCanvas`. These constants match `HERO_LONG_EDGE` and `HERO_QUALITY`
  in `build_catalog.py` — keep them in sync. A 20 MB camera JPEG becomes ~700 KB.
- **"Also upload original" toggle, default OFF.** See review open question 3.
- **`XMLHttpRequest`, not `fetch`.** `fetch` has no upload progress event in any browser.
  Use `xhr.upload.onprogress`.
- **Concurrency 3.** Not 8 — mobile radios do worse under high parallelism.
- **Retry per file:** 3 attempts, exponential backoff (1s, 2s, 4s), re-presigning each
  time since URLs expire after 300s. Files are independent; one failure must not abort the
  batch.
- **`navigator.wakeLock.request('screen')`** while uploading, released in a `finally`.
  Wrap in try/catch — it's unsupported in some browsers and must not break the upload.
- Show "Keep this screen on" during transfer. iOS suspends background tabs and there is no
  Background Fetch API in Safari; do not build UI implying resilience that doesn't exist.
- On completion call `/api/publish` and show the returned `albumUrl` as a tappable link.
- If some files failed, show which and offer to retry just those.

**Verify:** upload 10+ photos from an actual iPhone on cellular, not WiFi. Confirm progress
advances per file, the wake lock holds the screen on, a mid-upload airplane-mode toggle
triggers retry rather than a dead batch, and the resulting album loads at the returned URL
with correct EXIF in the lightbox.

**Commit:** `Add resilient upload transfer with progress to upload page`

---

## T12 — Browser-generated derivatives

**Who:** Agent · **Depends on:** T11

The browser already has each image decoded for T11's downscale. Have it produce the
derived files too, so no CI runner ever downloads a photo again.

- Generate an **800 px long-edge WebP at quality 0.75** (matching `THUMB_LONG_EDGE` /
  `THUMB_QUALITY`) and a **1200 px and 2000 px JPEG at quality 0.82** (matching
  `RESIZED_WIDTHS` / `RESIZED_QUALITY`).
- Skip a `_resized/` variant when the source's long edge is already ≤ that target,
  exactly as `ensure_resized_variants()` does.
- The **Worker** derives the destination keys per §C.1 and presigns them. The client never
  supplies a derived key.
- Extend `/api/publish` to accept the `sizes[]` array and per-photo `width`/`height`/
  `caption`/`exif`, and write them into a sidecar the Action can read.

**Critical:** `scripts/build_catalog.py` must **not** change in this task. Its existing
fast path already skips work when the thumb and every expected variant are present in the
bucket. If your keys are right, the Action simply finds them and does nothing. **If you
find yourself editing `build_catalog.py`, your keys are wrong.** That's the test.

The Pillow path stays for `rclone`/Cyberduck uploads and the 31 existing photos. Do not
delete it.

**Verify:** upload one photo through the page, then check R2 for
`_thumbs/{cat}/{album}/{stem}.webp`, `_resized/1200/{cat}/{album}/{file}`, and
`_resized/2000/...`. Trigger the Action and confirm its log shows **no** `→ thumb` or
`→ resized` lines for that photo.

**Commit:** `Generate thumbnails and resized variants in the browser`

---

## §C — Contracts

Binding. Two or more independent pieces of code depend on each of these.

### C.1 Derived key schemes

Mirrors `scripts/build_catalog.py:thumb_key_for()` and `js/app.js:thumbUrl()`.

```
original      {category}/{album}/{filename}
thumbnail     _thumbs/{category}/{album}/{stem}.webp     stem = filename minus final ext
resized       _resized/{width}/{category}/{album}/{filename}   width ∈ {1200, 2000}
hero          _hero/{filename}  and  _resized/hero/{filename}
cover         {category}/{album}/cover.jpg               lowercase .jpg, always
```

The thumbnail rule is: swap the final extension to lowercase `.webp` and prefix
`_thumbs/`. Nothing else changes — case in directory segments is preserved.

### C.2 Upload key construction

Server-side only. The client sends `category`, `album`, `filename`; the Worker builds:

```
{slug(category)}/{slug(album)}/{sanitized_filename}
```

- `slug()` per §C.6.
- Draft albums: prefix the album segment with `_draft-`.
- Flat categories: omit the album segment entirely.
- `sanitized_filename`: keep the basename only (strip any path), allow
  `[A-Za-z0-9._-]`, replace anything else with `-`, cap at 80 chars, extension preserved.

Final key must match:

```
^(?!_)[a-z0-9][a-z0-9-]{0,40}(/(_draft-)?[a-z0-9][a-z0-9-]{0,60})?/[A-Za-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$
```

Reject anything containing `..`, a leading `/`, a backslash, or a null byte, before regex
matching.

### C.3 Session cookie

```
Name:   nk_sess
Value:  base64url({"exp": <unix_seconds>}) + "." + base64url(HMAC-SHA256(payload, SESSION_HMAC_KEY))
Flags:  HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

Verification: split on the last `.`, recompute the HMAC over the payload segment, compare
with `timingSafeEqual`, then check `exp > now`. Reject on any parse failure. Rotating
`SESSION_HMAC_KEY` invalidates every session — that is the entire revocation story.

### C.4 `POST /api/presign`

Request:
```json
{
  "category": "places",
  "album": "tokyo-2026",
  "draft": false,
  "files": [
    { "filename": "DSC001.jpg", "contentType": "image/jpeg", "bytes": 712043 }
  ]
}
```

Response `200`:
```json
{
  "uploads": [
    {
      "filename": "DSC001.jpg",
      "key": "places/tokyo-2026/DSC001.jpg",
      "url": "https://<account>.r2.cloudflarestorage.com/...&X-Amz-Expires=300",
      "headers": { "content-type": "image/jpeg" }
    }
  ],
  "expiresIn": 300
}
```

Errors `4xx`: `{"error": "<code>"}` where code is one of `unauthorized`,
`rate_limited`, `batch_too_large`, `invalid_key`, `invalid_content_type`,
`file_too_large`.

### C.5 `POST /api/publish`

```json
{
  "category": "places",
  "album": "tokyo-2026",
  "draft": false,
  "title": "Tokyo 2026",
  "date": "2026-05",
  "location": "Tokyo, Japan",
  "cover": "places/tokyo-2026/DSC001.jpg",
  "photos": [
    {
      "key": "places/tokyo-2026/DSC001.jpg",
      "width": 6000, "height": 4000,
      "caption": "",
      "exif": { "camera": "ILCE-7RM4", "aperture": "f/2.8" },
      "sizes": [{ "w": 1200, "path": "_resized/1200/places/tokyo-2026/DSC001.jpg" }]
    }
  ]
}
```

`photos` is optional until T12. Response:
`{"ok": true, "albumUrl": "/photography/places/tokyo-2026/", "dispatched": true}`.

### C.6 Slugify

Must be identical in `js/app.js`, `scripts/build_seo.py`, and the Worker:

```
lowercase → replace every run of [^a-z0-9] with a single "-" → trim leading/trailing "-"
```

`"New York City"` → `"new-york-city"`. `"USAF Thunderbirds"` → `"usaf-thunderbirds"`.

### C.7 EXIF object

Produced by `scripts/build_catalog.py:extract_exif()`; consumed by `js/gallery.js` and
`js/photo.js`. The browser must produce the same shape. Omit absent fields; never write
`""` or `null`.

```json
{
  "camera":        "ILCE-7RM4",
  "lens":          "FE 70-200mm F2.8 GM OSS",
  "focal_length":  "200mm",
  "aperture":      "f/3.2",
  "shutter_speed": "1/500s",
  "iso":           "ISO 640"
}
```

Formatting rules, copied from the Python:
- `camera` — the model with the make stripped from the front when the model starts with it
  (`"SONY ILCE-7RM4"` → `"ILCE-7RM4"`).
- `focal_length` — rounded to a whole number, `mm` suffix.
- `aperture` — `f/` plus the number with trailing zeros trimmed (`2.80` → `f/2.8`).
- `shutter_speed` — reduced fraction with `s`: `1/500s`, `2s`, `1/1600s`.
- `iso` — `ISO ` prefix.

Also skip the literal caption values `"default"` and `"x-default"`, which iOS Photos
writes when it misreads the XMP language tag. See `extract_caption()`.

---

## Definition of done

- [ ] Neil uploads 10 photos from his phone, on cellular, in under a minute
- [ ] The album appears at the returned URL with title, date, location, and cover
- [ ] EXIF renders in the lightbox identically to Cyberduck-uploaded photos
- [ ] `git log --oneline -20` shows no timestamp-only catalog commits
- [ ] The GitHub Action logs no `→ thumb` / `→ resized` lines for browser-uploaded photos
- [ ] `/upload/` is absent from `sitemap.xml` and disallowed in `robots.txt`
- [ ] No secrets in the repo: `git log -p | grep -iE 'secret|password|access_key'` finds
      only variable names
