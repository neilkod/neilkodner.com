# Archive: the previous site (2026, before the redesign)

**Everything in this folder describes a design and architecture that no longer exists.**
Do not follow it. The current site is documented in the [main README](../../README.md),
and the design it follows is in [`docs/redesign/`](../redesign/).

The old site rendered every page in the browser from a `catalog.json` file. A scheduled
GitHub Action scanned a Cloudflare R2 bucket, made thumbnails with Python, and committed the
catalog back to the repo. It had a hero slideshow, category tiles, album pages and a PhotoSwipe
lightbox, set in Space Grotesk on a warm cream background.

The November 2026 redesign replaced all of it with an Eleventy site built from photos stored in
the repository. The catalog workflow, the R2 scripts and the frontend code were deleted.

| File | What it was |
|---|---|
| `README-r2-catalog.md` | The old README: R2 bucket layout, catalog pipeline, upload steps |
| `ROADMAP.md` | June 2026 performance and SEO plan for the old site |
| `ARCHITECTURE_REVIEW.md` | August 2026 review of the publishing workflow, proposing an upload portal on Cloudflare Workers (never built) |
| `IMPLEMENTATION.md` | Task-by-task spec for that review (never built) |
| `prompts/` | The prompts used to build the old site, in order |

The R2 bucket still exists as a backup but the site no longer reads from it.
