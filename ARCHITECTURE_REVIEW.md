# Architecture review — neilkodner.com

Date: 2026-08-09
Scope: publishing workflow, upload UX, catalog pipeline, hosting/CDN, cost
Status: analysis and plan only. No code written, no existing files edited.

> **Implementing this?** See [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — the phases below
> are broken into self-contained tasks with exact file paths, contracts, and verification
> steps, written to be executed without re-deriving any of the reasoning here.

---

## 1. The short version

The upload workflow didn't become painful because Cyberduck is a bad client. It became
painful because **publishing a shoot requires satisfying a schema by hand through a file
manager**, and there is no mobile path at all. The R2 folder layout is a database
schema, and Cyberduck is the query interface.

The data proves it. As of today:

| Signal | Value |
|---|---|
| Last time a photo was actually added to the catalog | 2026-06-20 (7 weeks ago) |
| Albums with a `date` set | 0 of 7 |
| Albums with a `location` set | 0 of 7 |
| Albums with a `cover` | 1 of 7 |
| Categories with a cover | 1 of 3 |
| Photos with a caption | 2 of 31 |
| Commits in repo history | 1,083 |
| Commits that changed nothing but a timestamp | ~1,033 |

Every optional step in the documented workflow has a compliance rate near zero, and the
one non-optional step (upload the files) stopped happening entirely. That is not a
discipline problem. That is a workflow that costs more than the act of publishing is
worth.

What I'd build, in order:

1. **Fix the catalog churn bug** (30 minutes). `generated` is rewritten every run, so the
   "commit only if changed" guard never fires. Every scheduled run commits and rebuilds
   the site. This is also why the cron got cut from 30 min to 6 h, which treated the
   symptom.
2. **A password-gated `/upload/` page backed by a Cloudflare Worker**, with the browser
   doing the resizing and EXIF extraction before upload. This kills the folder/naming/
   cover/manifest ceremony *and* most of the server-side pipeline at the same time.
   Free, no DNS changes, ~2 sessions.
3. **Move nameservers to Cloudflare** and put images behind `img.neilkodner.com`. This is
   the unshipped ROADMAP Phase 2, and the roadmap misdescribes it as "one dashboard
   step." It isn't — the zone isn't on Cloudflare, which is almost certainly why it's
   been sitting since June.
4. Optionally collapse the Pillow pipeline into Cloudflare Images transformations.

Full detail below. Section 6 is the auth opinion you asked for, and it disagrees with
one of your premises.

---

## 2. What I actually looked at

`CLAUDE.md`, `ROADMAP.md`, `README.md`, `scripts/build_catalog.py`,
`scripts/build_seo.py`, `scripts/upload-to-r2.sh`, `.github/workflows/update-catalog.yml`,
`js/{app,gallery,hero,photo}.js`, `css/tokens.css`, `css/style.css`, `index.html`,
`catalog.json`, and the git log. I also probed the live system:

```
$ dig +short NS neilkodner.com
dns1.registrar-servers.com.        ← Namecheap, not Cloudflare
dns2.registrar-servers.com.

$ curl -sI https://pub-….r2.dev/places/Seattle/DSC09890.jpg
HTTP/1.1 200 OK
Content-Length: 2165010
(no Cache-Control, no cf-cache-status)

$ curl -sI https://pub-….r2.dev/_thumbs/places/Seattle/DSC09890.webp
HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
(still no cf-cache-status)
```

Two things fall out of that. Derived objects got the immutable header from the Phase 2
code change, but the 2 MB originals uploaded before it did not. And **no response
carries `cf-cache-status`**, on any object, which confirms the `r2.dev` subdomain is
serving from origin every time rather than from the edge. ROADMAP finding #2 is fully
live.

---

## 3. Diagnosis

### 3.1 Why the upload workflow died

Per the README, publishing one shoot is six steps:

1. Decide flat vs. album-based — a structural choice that determines the URL shape and is
   awkward to reverse later.
2. Invent a folder name that becomes a URL slug.
3. Export from Lightroom, upload the JPEGs.
4. Rename your best frame to `cover.jpg` and upload it.
5. Hand-author a `manifest.json` with title/date/location and upload it.
6. Wait up to six hours, then reload the site to find out whether it worked.

Steps 2, 4, and 5 are metadata entry, performed through a file manager, which is the
worst available interface for metadata entry. Look at what actually landed in R2:
`aviation/Other`, `hockey/select-images`, `places/New York City`. One kebab-case slug,
one dumping ground, one Title Case folder with a space in it that has to be percent-
encoded in every URL. Those aren't curation decisions; they're what you type when the
naming decision is blocking you from finishing.

Step 5 was never done once. Which means `album.date` is `""` everywhere, which means
`album_entries.sort(key=lambda a: a["date"] or "", reverse=True)` in `build_catalog.py`
is a no-op, and `getLatestAlbums()` in `app.js` sorts by an empty string. **The homepage
"Latest Albums" strip is not showing your latest albums.** That's a live functional
regression caused purely by workflow friction — the code is correct, it's just never fed.

Step 6 is the one that kills the habit. The reward loop for posting a photo is seeing it
live. Six hours of latency with no confirmation breaks that loop completely. Instagram's
actual product insight is a sub-second publish; you don't need sub-second, but you need
"before I put my phone down."

And none of it works from a phone. The `extract_caption()` docstring in
`build_catalog.py` already handles the iOS Photos `x-default` corruption bug and
Lightroom Mobile's `dc:description`, so mobile is clearly already part of how you work —
the pipeline knows about it, the upload path doesn't.

### 3.2 The commit churn bug

`build_catalog.py` writes `"generated": datetime.now(...)` unconditionally. The workflow
then does:

```yaml
git add catalog.json sitemap.xml robots.txt index.html photography/ feed.xml
if git diff --staged --quiet; then echo "unchanged"; else git commit … fi
```

The diff is never empty, because the timestamp always moved. Result: 1,033 of 1,083
commits in this repository are the bot changing one line from one ISO timestamp to
another, each one triggering a full GitHub Pages rebuild. At the old 30-minute cadence
that was ~1,440 builds/month.

Cutting the cron to 6 h reduced this 12×, but it also raised worst-case publish latency
to six hours — it traded the thing you cared about (fast publishing) to suppress a
symptom of a one-line bug. Fix the comparison instead: serialize the new catalog, drop
`generated` from both sides, compare, and skip the write when they're equal. Then the
cron interval is free to be aggressive again, or to disappear entirely.

Note `build_seo.py` already has `_write_if_changed()`. The idea is in the codebase; it
just isn't applied to `catalog.json`.

### 3.3 Structural issues, ranked

**Images are not on a CDN.** Verified above. `r2.dev` is rate-limited by Cloudflare and
excluded from edge caching by design — it's a development convenience endpoint. Every
visitor pulls every byte from origin. This is ROADMAP Phase 2, and the roadmap calls it
"Manual (Neil, Cloudflare dashboard): connect a custom domain." That understates it: an
R2 custom domain requires the zone to be on Cloudflare, and `neilkodner.com` is on
Namecheap nameservers pointing straight at GitHub Pages' anycast IPs. The real task is a
nameserver migration, which is a different size and a different risk class than a
dashboard click. Naming it accurately is probably the difference between it shipping and
not.

**`catalog.json` is a monolith on the critical path of every page.** 28 KB for 31
photos, about 900 bytes per photo, blocking-fetched by `app.js` before anything renders.
That's fine now. At 1,000 photos it's ~900 KB on every page load, at 5,000 it's ~4.5 MB.
Not urgent, but it's a ceiling on exactly the behavior you're trying to unlock (posting
more often), so it's worth knowing where it sits.

**Git is the delivery mechanism for a mutable dataset.** Every metadata change is a
commit, a push, and a full static rebuild. Workable at this size, and the durability and
diffability are real benefits. Just be aware Cloudflare Pages caps the free plan at 500
builds/month, so if you ever move hosting there, the churn bug in 3.2 becomes a hard
blocker rather than a nuisance.

### 3.4 What's good — leave it alone

The content model is genuinely well-designed. Flat vs. album categories, `_draft-`
prefixes at any path depth, orientation-filtered hero, manifest overrides, incremental
builds that preserve hand-edited captions, `_thumbs/` derived-key contract mirrored
explicitly on both sides with the contract written down in both files. The
`ensure_resized_variants()` fast path that carries `sizes[]` forward without re-
downloading is careful work. The frontend post-Phase-1/3/5 is disciplined: lazy hero with
one-ahead preload, `aspect-ratio` reservation, `fetchpriority`, self-hosted fonts and
PhotoSwipe, justified-row grid that preserves curated order.

The model isn't the problem. The **input method for the model** is the problem. Any
proposal that changes the content model is solving the wrong thing.

The other thing worth protecting: no build step. For a solo maintainer coming back to a
project after six weeks, "open the file, edit it, push" is worth more than most
optimizations. Nothing below introduces a bundler.

---

## 4. Candidate architectures

### A — Worker upload endpoint bolted onto today's stack

Keep GitHub Pages, keep R2, keep `build_catalog.py`. Add a Cloudflare Worker on
`*.workers.dev` with three routes: `/api/login` (password → signed cookie), `/api/presign`
(returns presigned R2 `PUT` URLs), `/api/publish` (writes the manifest, fires a
`repository_dispatch` at the repo). Add a static `/upload/` page on GitHub Pages that
talks to it cross-origin.

Uploads go **browser → R2 directly** via presigned URL, never through the Worker. That
sidesteps the Worker's 100 MB request-body cap and any CPU limits entirely; the Worker
only ever handles small JSON.

The workflow gains a `repository_dispatch` trigger, so publish latency drops from ≤6 h to
roughly two minutes (checkout + pip install + list + commit + Pages build).

- **Catalog/thumbs/EXIF:** unchanged. Pillow in Actions.
- **Mobile:** solved (see §7).
- **Auth:** server-verified password, HMAC cookie (see §6).
- **Migration risk:** near zero. No DNS, no host change, no URL change, no catalog schema
  change, `catalog.json` consumers untouched, PhotoSwipe untouched.
- **Cost:** free at any plausible scale.
- **Effort:** ~2 sessions.
- **Doesn't fix:** the CDN gap, the git churn (though it makes the cron unnecessary).

### B — A, plus the browser generates the derivatives

Same as A, with one change that turns out to matter a lot. The upload page already has
the image decoded in order to show a thumbnail and to downscale it for transfer. So have
it produce all three artifacts locally — an 800 px WebP thumb, a 2560 px JPEG, and
optionally the original — and `PUT` them to the exact keys `thumb_key_for()` and
`ensure_resized_variants()` would have written.

Now `build_catalog.py` finds every derived key already present, takes its existing fast
path for all of them, downloads nothing, and runs in seconds. EXIF is parsed client-side
from the file's first ~128 KB before the canvas step (canvas strips it), and shipped as
JSON to `/api/publish`.

Crucially the Pillow path **stays in place as the fallback**, because photos that arrive
by `rclone`/Cyberduck still need it, as do the 31 already in the bucket. Nothing is
deleted; a code path just stops being hit for new uploads.

- **Cost:** free.
- **Effort:** +½ session over A.
- **Risk:** one real unknown, HEIC decoding in mobile Safari (see §7.2). Test it first.

### C — B, plus Cloudflare zone + edge transformations

Move nameservers to Cloudflare (free plan). Bind `img.neilkodner.com` to the R2 bucket as
a custom domain, add a cache rule. Enable Images transformations on that zone and serve
every image as `img.neilkodner.com/cdn-cgi/image/width=800,format=auto,quality=78/<key>`.

`format=auto` gives you AVIF where supported, which the Pillow pipeline will never do.
Derivatives stop being stored at all: no `_thumbs/`, no `_resized/`, no hero variants.
`build_catalog.py` becomes a bucket listing plus a metadata merge, and the `sizes[]`
array — which the frontend already consumes via `buildPswpSrcset()` — gets populated with
transformation URLs instead of stored object paths. Zero frontend change.

Free tier is 5,000 unique transformations per month, and you'd use about 155.

- **Migration risk:** medium, concentrated entirely in the DNS cutover. Existing
  permalink URLs, the custom domain, the catalog schema, and PhotoSwipe are all
  unaffected — only the image host changes, and it changes via a single GitHub secret
  (`R2_PUBLIC_BASE_URL`) plus the `preconnect` hints in each page `<head>`.
- **Cost:** free. See §8 for where it stops being free.
- **Effort:** +1–2 sessions over B, plus a DNS window.

### D — Fully dynamic: Worker + D1, no git in the loop

Catalog lives in D1. The Worker serves `/api/catalog` and renders album pages. Publish is
instantaneous.

I'm listing this to reject it. For 31 photos it buys you seconds of latency you already
got in A, in exchange for owning a database, losing the prerendered SEO stubs that
`build_seo.py` produces, losing "it works if Cloudflare is down," and losing the
no-build-step property. D1's free tier is generous (5 GB, 5 M row reads/day) and this
would work fine. It's just a worse trade at your scale.

**What would change my answer:** 10,000+ photos (where `catalog.json` genuinely can't be
a monolith), multiple contributors, or the multi-tenant framework direction actually
being pursued. At that point D1 is right and the migration is contained.

### E — Give up and use a hosted service

Pixieset ($8–20/mo), Format ($12–25/mo), SmugMug ($13–30/mo). Solves the mobile upload
problem completely and immediately, today, with zero engineering.

Naming it so the trade is explicit rather than implicit: you'd be paying $150–300/year to
stop maintaining something you've already built and clearly enjoy, and you'd be trading a
site with a specific visual identity for a template. Not recommended, but it is the
honest benchmark that the recommended plan should be measured against. If the plan below
takes more than four sessions to get to "I posted from my phone," that's a signal.

---

## 5. Recommendation

**Ship A → B → C in that order, and treat B as the milestone that matters.**

They're a strict prefix chain, which is the whole appeal. The upload page, the auth, the
presign flow, and the metadata form are byte-identical across all three. A→B changes only
what the browser does before uploading. B→C changes only the URLs in `catalog.json` and
deletes code. There's no throwaway work and every step is independently shippable and
independently useful.

Reasoning:

**A first, because it's free of DNS risk and it's the actual fix.** Everything that
stopped you from uploading is addressed by the upload page alone. The CDN problem is real
but it's a performance problem on a site with 31 photos and no traffic pressure; it is not
why you stopped posting. Don't let the risky infrastructure work gate the thing that fixes
the actual complaint.

**B, because client-side derivative generation is the highest-leverage idea here and it's
nearly free once you've built A.** The phone already decoded the image. Producing an
800 px WebP in a canvas costs single-digit milliseconds and about 15 KB of upload. In
exchange, the server-side pipeline stops being on the critical path of publishing, which
means publish latency becomes "how fast can GitHub Pages rebuild" rather than "how fast
can a runner download and re-encode 25 MB." It also happens to make C optional rather than
necessary, which is a good property for the phase that carries the DNS risk.

**C, when you're ready to touch DNS.** The wins are real (edge caching, AVIF, no stored
derivatives, no Pillow) but they're all performance and tidiness, none of them are
workflow. Do it deliberately on a weekend, not as a dependency of anything.

**Explicit disagreement with the framing in the brief:** the brief treats the CDN/
performance items from `ROADMAP.md` as background context and the upload page as the new
work. I'd invert the priority of the DNS piece specifically. It's been open since June
because it's mislabeled as easy; it will keep not shipping until it's rewritten as
"migrate nameservers, verify mail records, cut over." That's a scheduled maintenance task,
not a roadmap checkbox.

---

## 6. Auth — you asked for an opinion, here it is

**A client-side password check is not acceptable here, and the usual argument against it
is not the reason.**

The usual argument is "the password is visible in the JavaScript." True, but that's the
smaller problem. The real problem is structural: the thing being protected is a *write
credential for a bucket that is publicly served from your domain*. For a client-side check
to be meaningful, the client would have to hold something that lets it write to R2 —
either R2 credentials directly, or an unauthenticated presign endpoint. In both cases the
password check is decoration on top of an open write endpoint. Anyone who reads the
network tab skips your UI, calls the endpoint directly, and uploads whatever they want.

The consequence isn't a defaced hobby site. It's `neilkodner.com` serving arbitrary
content from a domain with your name on it, plus an R2 bill you didn't authorize. That's
the difference between "weak auth" and "no auth," and this would be the latter.

So: server-verified. But keep it as simple as your instinct says. Concretely, about 80
lines of Worker code, no accounts, no user table, no OAuth, no session store:

- Password lives as a Worker secret. Compare with `crypto.subtle.timingSafeEqual` against
  a SHA-256 of the submitted value. Timing attacks over the internet against a 20+
  character passphrase aren't a serious threat, but constant-time comparison is three
  lines, so there's no reason to argue about it.
- On success, set `Set-Cookie: sess=<payload>.<hmac>; HttpOnly; Secure; SameSite=Lax;
  Max-Age=2592000`. Payload is just `{"exp": <unix>}`. HMAC with a second Worker secret.
  Stateless — no KV lookup on the hot path, and rotating the signing secret logs you out
  everywhere, which is the whole revocation story you need.
- Rate-limit login: a KV counter keyed on IP, 10 attempts/hour. KV free tier is 1,000
  writes/day, which is plenty. Alternatively skip it and use a long passphrase; I'd do
  the counter since it's ten lines.

**The part that actually matters more than the password:** constrain what `/api/presign`
is willing to sign. This bounds the damage if the password ever leaks, and it's cheap:

- Content-Type must match `image/(jpeg|png|webp|avif)`.
- Key must match a strict pattern, something like
  `^[a-z0-9][a-z0-9-]{0,40}(/[a-z0-9][a-z0-9-]{0,60})?/[A-Za-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$`.
  This also has the side effect of enforcing clean slugs at the source, which would have
  prevented `places/New York City` from existing.
- Reject keys under `_thumbs/`, `_resized/` unless they're the derivative keys the
  server itself computed for this batch.
- Cap `Content-Length` (say 30 MB) and presigned URL TTL (5 minutes).

Your instinct that this doesn't need OAuth is correct. Your instinct that it can be
checked in the browser is not.

---

## 7. Mobile upload UX

This is where the feature succeeds or fails, so here's the specific engineering rather
than a description.

### 7.1 File selection

`<input type="file" accept="image/*" multiple>`. **Do not add the `capture` attribute** —
it forces the camera and removes the library picker on iOS, which is the opposite of what
you want. Plain `accept="image/*" multiple` opens the Photos picker with multi-select.

### 7.2 HEIC — the one real unknown, test this first

The iPhone camera roll stores HEIC. Safari sometimes transcodes to JPEG on upload and
sometimes doesn't, depending on the Camera → Formats setting ("High Efficiency" vs. "Most
Compatible") and on the picker path. You will receive `.heic` files. Neither R2 nor any
browser renders them.

Since you're already routing every file through `createImageBitmap()` → canvas for the
downscale, HEIC decodes for free on iOS, because Safari has the OS decoder available.
That's the theory. It's also the single highest-risk assumption in this document, it
varies by iOS version, and it is cheap to check: a ten-line test page, one HEIC from your
camera roll, five minutes. **Do this before writing anything else in Phase 1.** If it
fails, the fallback is rejecting HEIC with a clear message and having you set Camera →
Formats → Most Compatible, which is a worse but survivable outcome.

### 7.3 Downscale before upload, not after

A Q3 JPEG is 15–25 MB. On LTE that's 30–60 seconds per photo, and a 12-photo shoot is a
ten-minute upload you have to babysit. Resized to 2560 px long edge at q82 it's roughly
700 KB — 25–30× faster, and it is exactly the size `HERO_LONG_EDGE` already establishes as
the largest thing the site ever serves.

Do it in a Web Worker with `createImageBitmap` + `OffscreenCanvas` so the main thread
doesn't jank while you're scrolling the thumbnails. Both are available in Safari 16.4+.

Keep an "also upload the original" toggle, **off by default**. See open question 3 — the
lightbox's srcset currently tops out at 2000 px, so full-res originals are stored but
never served.

### 7.4 EXIF must be parsed before the canvas step

Canvas strips all metadata. Parse the APP1 segment from the first ~128 KB of the `File`
via `slice()` before decoding. There's no dependency-free way to do this well; vendor a
small EXIF reader (~10 KB) into `/vendor/`, which matches how PhotoSwipe and Space Grotesk
are already handled.

This is what makes the metadata form work: **the album date field pre-fills from
`DateTimeOriginal` of the first selected photo.** You never type a date, which is why the
date field will actually get populated this time instead of being empty in 7 of 7 albums.

### 7.5 Transport

- **`XMLHttpRequest`, not `fetch`.** `fetch` has no upload progress event in any browser;
  request-body streaming is Chrome-only and needs HTTP/2. XHR's `upload.onprogress` is
  still the only way to show real per-file progress.
- **Concurrency 2–3, not 8.** Mobile radios do worse under high parallelism, and three
  bars moving steadily reads better than twelve bars stalled.
- **Retry per file.** Files are independent, so a dropped connection costs at most one
  file. On failure, re-presign (the URL may have expired) and retry with exponential
  backoff, three attempts.
- **`navigator.wakeLock.request('screen')` while uploading**, released on completion.

### 7.6 Be honest about backgrounding

iOS Safari suspends JavaScript when you leave the tab or the screen locks. There is no
Background Fetch API in Safari. No free architecture changes this — not a Worker, not a
service worker, not a PWA.

So don't build a UI that implies resilience it doesn't have. Hold the wake lock, say
"keep this screen on" in the UI, and on resume detect which files didn't finish and offer
to continue. Combined with 700 KB uploads, a 12-photo batch takes about 20 seconds on LTE,
which is short enough that this stops being a real problem.

### 7.7 Metadata in the same screen as the files

This is the actual fix for the 0-of-7 empty dates. One form, alongside the staged
thumbnails:

- **Category** — a select populated from `catalog.json`, plus "New category…".
- **Album** — select from that category's albums, "New album…", or "No album (flat
  category)". Choosing this is what sets flat vs. album-based, so the structural decision
  becomes a dropdown instead of a folder-layout consequence.
- **Title** — free text. The slug is derived and shown live beneath it
  (`places/new-york-city`), so you can see the URL you're creating. This is what prevents
  another `USAF Thunderbirds`.
- **Date** — pre-filled from EXIF.
- **Location** — free text, remembered per category.
- **Cover** — tap a thumbnail to star it. No renaming a file to `cover.jpg`.
- **Draft** — a toggle that writes the `_draft-` prefix. The mechanism already exists and
  is good; it just needs a switch instead of a rename.

The Worker writes `manifest.json` from this. You never see JSON again.

### 7.8 Confirmation

On success, show the live album URL and make it tappable. In A that's ~2 minutes behind a
"publishing…" state; in B it's under a minute. Closing the loop is the point of the whole
exercise.

---

## 8. Cost

R2 egress is $0 at every tier, which is why R2 is the correct storage choice and nothing
below should change it.

**Today** (31 photos, ~5 GB in the bucket, low traffic): $0 in every candidate, with
large margins.

**At 5–10×** (say 300 photos):

| Line item | Free tier | At 300 photos | Cost |
|---|---|---|---|
| R2 storage, keeping full-res originals | 10 GB-mo | ~50 GB | (50−10) × $0.015 = **$0.60/mo** |
| R2 storage, 2560 px only | 10 GB-mo | ~0.2 GB | $0 |
| R2 Class A (writes, lists) | 1 M/mo | <10 k | $0 |
| R2 Class B (reads) | 10 M/mo | well under | $0 |
| R2 egress | — | any | **$0 always** |
| Workers requests | 100 k/day | ~100/upload session | $0 |
| Workers KV (rate limiting) | 1 k writes/day | ~10 | $0 |
| Cloudflare Images transformations (C only) | 5,000 unique/mo | ~1,500 | $0 |
| Cloudflare DNS | free plan | — | $0 |
| GitHub Actions | unlimited (public repo) | ~4 runs/day | $0 |
| GitHub Pages | 100 GB/mo soft bandwidth | nowhere near | $0 |

The only line that goes non-zero is storage of full-resolution originals, and it's 60
cents. Everything else has an order of magnitude of headroom.

**Where it stops being free:**

- **Storage** crosses $1/mo at roughly 400 full-res photos, $5/mo at ~2,300. Uploading
  2560 px versions instead pushes that out by roughly 30×.
- **Images transformations** (C only) cross 5,000 unique/month at around 1,000 photos
  assuming 5 variants each. Beyond that it's $0.50/1,000, so ~$5/mo at 3,000 photos. At
  that point it's worth re-comparing against just going back to stored Pillow derivatives,
  which are free forever at the cost of storage.
- **Cloudflare Pages** (if you ever move hosting) caps at 500 builds/month on free. At
  today's 4 catalog commits/day that's 120/month, fine. At the *old* 30-minute cron it was
  1,440/month, which would have broken. Fix the churn bug in §3.2 before considering
  Pages.
- **Workers paid** is $5/mo and you would not approach the free limits with a single
  photographer uploading. You'd need ~100 k requests/day.

Realistic bet: **$0/month for the next two to three years of normal use**, and under $1/month
even if you post aggressively, unless you decide to archive every full-res original in R2.

---

## 9. Generalizability

Let it influence exactly two decisions now, and nothing else.

1. **Extract site identity into `site.config.json` at the repo root.** Right now
   `CATEGORY_NAMES = {"travel": "Places"}` sits in `build_catalog.py`,
   `SITE_ORIGIN = "https://neilkodner.com"` in `build_seo.py`, and the site name is
   hardcoded in every HTML `<title>`, nav brand, and OG tag. One JSON file holding site
   name, origin, tagline, and category display-name overrides, read by both scripts, is
   about an hour of work. It's also just better code today, independent of any framework
   ambition.
2. **Keep the Worker's bucket name, key prefix, public base URL, password, and signing
   secret as environment bindings** rather than literals. This is the natural way to write
   it anyway.

That's the whole list. Specifically **do not**, in this pass: build a plugin system, add
an abstraction layer over R2, build a theme engine, introduce a tenant identifier into
paths, or make the catalog schema "extensible." Every one of those costs real complexity
now against a product that doesn't exist, and none of them are the thing that would
actually be hard later.

**What would genuinely have to change for multi-tenancy**, stated plainly so it's not a
surprise: a tenant key in every R2 path (`{tenant}/{category}/{album}/`), real
authentication replacing the shared password (accounts, email verification, password
reset — this is the big one, and it's most of the work), `catalog.json` replaced by D1
because you can't ship one JSON file per tenant to a static host, and a signup/billing
flow. Those are rewrites of *specific components*. The architecture recommended here —
static frontend, R2 storage, Worker for writes, derived metadata — survives all of them
intact. That's the only guarantee worth buying in advance, and A/B/C buy it for free.

**One disagreement with the framing.** The reason a generalized version is hard isn't
technical, it's that other photographers have different curation models — you can't know
which of your assumptions (flat vs. album, `_draft-`, cover-per-album, EXIF panel) are
universal and which are yours until you've lived with this workflow for a year without
friction. Solving your own case completely is the *prerequisite* to knowing what to
generalize, not a detour from it. Building for a hypothetical second user right now would
mean designing around guesses.

---

## 10. Upload page design

The brief asks for something that belongs to this site. The design idea worth having:
**the upload page is a live preview of the album page you're about to create.** Not an
admin panel with a drop zone.

Concretely, working from `tokens.css` and the existing `style.css` conventions:

- **Same shell.** `--color-bg: #F6F3EE`, Space Grotesk, `--max-width: 1400px`, the same
  `.site-nav`. It's a page on the site, not a separate application.
- **Field labels use the existing `.label` treatment** — `--text-xs`, `0.09em` tracking,
  uppercase, `--color-text-muted`. That class already exists and reads as editorial rather
  than as a form. Reuse it instead of inventing form styling.
- **No card.** The site has no cards anywhere; it has full-bleed images and whitespace.
  Single column, `--gutter` padding, sections separated by `--space-16` and a hairline
  `--color-border` rule.
- **The staging grid is `.album-grid`**, the same justified-row flex layout `gallery.js`
  builds, with `flex-grow` set from each file's aspect ratio. What you're staging looks
  exactly like what will publish, including the row rhythm. This is the whole idea, and
  it's free because the CSS exists.
- **Progress is a 2px `--color-accent` (#C9963A) rule that fills left-to-right beneath
  each thumbnail.** No spinner, no percentage badge, no rounded pill. Complete = the rule
  fades out and the thumbnail goes to full opacity, reusing the existing `.loaded` fade.
- **Cover selection is a small amber dot in the corner of the starred thumbnail.** Nothing
  else changes. The album page already communicates hierarchy through size and position
  rather than badges.
- **Draft state** renders at `opacity: 0.5` with a `--color-border` outline, matching how
  muted content reads elsewhere on the site.
- **One `.btn`, "Publish"**, using the existing uppercase / `0.1em`-tracking button style
  in `style.css:681`.
- **Login is a single field on an otherwise empty cream page**, with the site wordmark
  above it. No centered card, no shadow, no icon.

Things to actively avoid, since they're what this genre of page usually looks like: a
dashed drop-zone rectangle (irrelevant on mobile, where there's no drag), a sidebar,
tabbed sections, status chips with rounded backgrounds, and any accent color other than
the amber already in `tokens.css`.

---

## 11. Phased plan

Each phase is independently shippable. Ordered by impact-per-effort.

### Phase 0 — Stop the churn (30 minutes, do this regardless)

- [ ] In `build_catalog.py`, compare the newly built catalog against the existing one with
      `generated` excluded from both; skip writing the file when they're otherwise equal.
      `build_seo.py:_write_if_changed()` is the pattern to follow.
- [ ] Confirm the workflow's `git diff --staged --quiet` guard now actually fires. Watch
      for one 6-hour cycle with no commit.
- [ ] Optionally restore the cron to hourly, now that a no-op run costs nothing. Phase 2
      makes the cron mostly redundant anyway, so this is low stakes either way.

*Result: ~120 pointless commits and Pages rebuilds per month go to zero. Publish latency
becomes tunable again.*

### Phase 1 — Upload page (2 sessions, free, zero DNS risk)

- [ ] **First: the HEIC spike.** Ten-line test page, `createImageBitmap()` on a HEIC from
      your camera roll, on your actual iPhone. Everything else in this phase assumes it
      works. (§7.2)
- [ ] Worker with `/api/login`, `/api/presign`, `/api/publish`. Secrets: password hash,
      HMAC signing key, R2 credentials, GitHub PAT for `repository_dispatch`.
- [ ] Presign validation: content-type allowlist, key regex, size cap, 5-minute TTL. (§6)
- [ ] R2 bucket CORS policy allowing `PUT` from `https://neilkodner.com`.
- [ ] `/upload/` page: multi-select, client-side EXIF parse, Web Worker downscale to
      2560 px, per-file XHR progress, retry-with-re-presign, concurrency 3, wake lock.
- [ ] Metadata form per §7.7 — category/album selects from `catalog.json`, live slug
      preview, EXIF-prefilled date, tap-to-star cover, draft toggle. Worker writes
      `manifest.json`.
- [ ] `repository_dispatch` trigger on `update-catalog.yml`.
- [ ] `noindex` on `/upload/`, and keep it out of `sitemap.xml`.

*Result: you can publish a shoot from your phone in about a minute, and albums get dates,
locations, and covers because the form asks for them.*

### Phase 2 — Browser-generated derivatives (½ session)

- [ ] Extend the Worker's presign to also sign the derived keys for each file, computed
      server-side to match `thumb_key_for()` and `ensure_resized_variants()` exactly.
- [ ] Upload page generates and uploads the 800 px WebP thumb and the 2560 px JPEG
      alongside the main file.
- [ ] Ship the client-parsed EXIF and caption through `/api/publish` so
      `build_catalog.py` doesn't need to open the image.
- [ ] Verify `build_catalog.py` takes its existing fast path for these — it should require
      no change, which is a good test of the key-contract discipline already in the code.
- [ ] Leave the Pillow path intact for `rclone`/Cyberduck uploads and for the 31 existing
      photos.

*Result: no runner ever downloads a photo again. Publish latency is bounded by the Pages
rebuild.*

### Phase 3 — DNS and CDN (1 session + a cutover window)

Supersedes ROADMAP Phase 2.

- [ ] Export every DNS record from Namecheap first. **Check for MX and TXT/SPF records** —
      if mail runs on this domain, this is the step that breaks it.
- [ ] Move nameservers to Cloudflare (free plan). Verify the site and mail before
      proceeding.
- [ ] `img.neilkodner.com` → R2 custom domain. Cache rule with a long edge TTL.
- [ ] Update the `R2_PUBLIC_BASE_URL` GitHub secret; the next catalog build rewrites every
      URL. Update the `preconnect`/`dns-prefetch` hints in each page `<head>`.
- [ ] Backfill `Cache-Control` on originals uploaded before the header change — a one-off
      copy-in-place with the header set, or `rclone copyto --header-upload`. §2 shows
      `places/Seattle/DSC09890.jpg` currently has none.
- [ ] Confirm `cf-cache-status: HIT` on a second request. That header's absence is the
      current bug; its presence is the fix.

### Phase 4 — Optional: edge transformations (1–2 sessions)

Only after Phase 3. Genuinely optional — Phase 2 already removed the pipeline's cost.

- [ ] Enable Transformations on the zone.
- [ ] Point `thumbUrl()` and `sizes[]` at `/cdn-cgi/image/...` URLs. `format=auto` yields
      AVIF. No other frontend change; `buildPswpSrcset()` already consumes `sizes[]`.
- [ ] Remove derivative generation from `build_catalog.py`. It becomes list + merge.
- [ ] One-time delete of `_thumbs/` and `_resized/` from R2.
- [ ] Watch the transformation counter for a month before trusting the free tier.

### Phase 5 — Generalization hooks (1 hour)

- [ ] `site.config.json` with site name, origin, tagline, category display-name overrides.
- [ ] Read it in `build_catalog.py` (replacing `CATEGORY_NAMES`), `build_seo.py`
      (replacing `SITE_ORIGIN`), and the album-stub template.

Nothing else. See §9.

---

## 12. Relationship to `ROADMAP.md`

I didn't edit it. Here's how the two documents reconcile:

- **ROADMAP Phase 2 (custom domain + cache rule)** → becomes **Phase 3** here, with the
  DNS precondition stated. The roadmap's framing ("one dashboard step") is wrong and is
  probably why it hasn't shipped. Its second bullet (`Cache-Control` in `put_bytes()` and
  `upload-to-r2.sh`) is done, but I verified it only applies to objects written after the
  change — pre-existing originals still have no header, so there's a backfill task the
  roadmap doesn't capture.
- **ROADMAP Phase 3 (WebP thumbs, `_resized/` variants, hero resize)** → shipped and
  working, verified live. Phase 2 here makes the browser produce those same artifacts, and
  Phase 4 here would retire the generation code entirely. If you take Phase 4, mark
  ROADMAP Phase 3 "shipped, then retired" rather than deleting it — the `sizes[]` schema
  and the `thumb_key_for()` contract it established both survive.
- **ROADMAP Phases 1, 4, 5** → complete, unaffected, nothing here touches them.
- **Not in ROADMAP at all:** the `generated` churn bug (§3.2), the empty
  `date`/`location`/`cover` fields breaking the "Latest Albums" sort (§3.1), and the
  missing `Cache-Control` on pre-existing originals. Worth adding regardless of which
  architecture you pick.

---

## 13. Open questions

These need your answer before implementation, roughly in the order they'd block work.

1. **Will you move `neilkodner.com`'s nameservers from Namecheap to Cloudflare?** Phases 3
   and 4 depend entirely on it; Phases 0, 1, 2, and 5 don't touch DNS at all. Related and
   more important: **is there mail on this domain?** If there are MX records, the cutover
   needs care and a rollback plan.

2. **When you upload from your phone, what's the source?** Lightroom Mobile exports (JPEG,
   already sized, EXIF intact) or camera-roll files straight off the Q3's app (likely
   HEIC)? This determines whether §7.2 is critical path or a nice-to-have, and it's worth
   answering before the HEIC spike so you test the right file.

3. **Do you want full-resolution originals in R2 at all?** Today `sizes[]` tops out at
   2000 px and `photo.js` serves the original only on the single-photo page. Originals are
   the only thing in this whole system that will ever cost money. Three positions, all
   defensible: keep them as an off-site archive (~$0.60/mo at 300 photos), stop uploading
   them and keep Lightroom as the archive of record ($0), or keep them but move them to R2
   Infrequent Access ($0.01/GB-mo, plus retrieval). I'd default to the second, but it's a
   genuine preference call.

4. **Should the upload page be able to rename or move existing albums?** Fixing
   `hockey/select-images` and `aviation/Other` means rewriting R2 keys, which breaks the
   permalinks that `build_seo.py` has already published and sitemapped. Doable with
   redirect stubs, but it's real scope. My default is upload-only for Phase 1, with a
   separate one-time cleanup you run deliberately.

5. **Is `/upload/` on the main site acceptable, or should it live on a separate host?**
   Same origin is simpler (no CORS on the page itself, shared CSS, shared nav). A separate
   `admin.neilkodner.com` is marginally tidier but buys almost nothing given the auth is
   server-side either way. I'd put it at `/upload/` with `noindex`.

6. **Is the interim state acceptable?** After Phase 1/2 you'd have a working mobile upload
   flow while images are still served uncached from `r2.dev`. That's strictly better than
   today, but it means "the fast upload page loads slow images" for however long Phase 3
   takes. I think that's clearly fine, but you're the one who'd look at it.

7. **How aggressive should publish latency be?** Phase 2 gets you to roughly one minute,
   bounded by the Pages rebuild. Getting below that means the frontend reading album data
   from the Worker instead of `catalog.json`, which is candidate D and a much bigger
   change. Is one minute good enough? I'd expect yes, and I'd want to hear otherwise
   before designing around it.

---

## Sources

Free-tier figures verified 2026-08-09:

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) — 10 GB-mo
  storage, 1 M Class A, 10 M Class B free; $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B;
  egress always free.
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) — free:
  100 k req/day, 10 ms CPU/invocation. KV free: 100 k reads/day, 1 k writes/day, 1 GB.
  D1 free: 5 M rows read/day, 100 k written/day, 5 GB. Paid from $5/mo.
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) — 5,000
  unique transformations/month free, works with R2 as source; $0.50/1,000 beyond.
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) — 10 k
  operations/day on the free plan, 24 h retention.
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — 500
  builds/month, 20,000 files, 25 MiB per asset on free.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — 100 MB
  request body on the Free and Pro plans.
