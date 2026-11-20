# Prompt: Architecture Review & Redesign Proposal for neilkodner.com

Copy everything below into a fresh session with Opus 5 that has read access to this
repository (a Claude Code session opened in this directory is ideal, since it can read
files directly rather than working from the summary below).

---

## Your role

Assume whichever of the following personas is most relevant at each point in your
analysis, and be explicit when you're switching hats:

- **A staff-level software architect** with deep experience in JAMstack/static-site
  infrastructure, serverless platforms (Cloudflare Workers/Pages, Vercel, Netlify,
  Deno Deploy, Supabase), and object storage (S3-compatible, R2). You've designed
  systems for solo developers and small teams where operational simplicity and cost
  matter more than scale.
- **A senior product/UX designer** who specializes in photography portfolio and
  creative-work sites. You know the genre well — SmugMug, Pixieset, Format, Adobe
  Portfolio, Squarespace portfolios, and countless photographer-built sites — and you
  know what separates a site that feels considered from one that feels like a template.
- **A mobile web engineer** focused specifically on file-upload UX: multi-select from
  a phone camera roll, upload progress/resilience on flaky connections, background
  upload behavior, and the failure modes that make people abandon an upload flow.
- **A pragmatic security reviewer** with a focus on lightweight auth for small
  personal tools — someone who can tell the difference between "fine for this use
  case" and "actually insecure," without over-engineering.
- **A cost-conscious infrastructure advisor** who knows the free-tier limits of the
  relevant platforms cold (Cloudflare Workers/Pages/R2/D1/KV, GitHub Pages/Actions,
  Vercel, Netlify, Supabase) and can say precisely when a given design starts costing
  real money.

You're being asked for this range of perspectives because the person you're advising
is a competent generalist engineer, not a specialist in any of these areas — he wants
a second opinion that's actually expert, not a summary of his own idea reflected back.

---

## Background

This site is `neilkodner.com`, a photography portfolio belonging to Neil Kodner, a
photographer who shoots Sony Alpha and Leica Q3, processes in Lightroom Classic on a
Mac. Below is a snapshot of the current architecture. **Treat this as a starting
orientation, not ground truth** — read the actual repository (`CLAUDE.md`,
`ROADMAP.md`, source files, recent `git log`) before forming conclusions, since this
summary may drift from reality.

**Current stack (as of this writing):**
- Static site: plain HTML5/CSS3/ES6 modules, no framework, no build step, no
  npm/bundler. PhotoSwipe v5 (CDN) for the lightbox.
- Hosting: GitHub Pages, deployed on push to `main`.
- Storage: Cloudflare R2 (S3-compatible) holds full-res photos and generated thumbs.
- Catalog pipeline: a GitHub Action runs on a cron schedule (recently reduced from
  every 30 minutes to every 6 hours), executing `scripts/build_catalog.py` (Python +
  boto3 + Pillow) — it scans R2, generates thumbnails, extracts EXIF and captions, and
  writes a single `catalog.json` that the client fetches and renders from.
- Content model: top-level R2 folders are categories; a folder of photos directly is a
  "flat" category, a folder of sub-folders is "album-based." A `_draft-` filename/folder
  prefix hides content from the site. `_hero/` drives an orientation-aware slideshow.
- **Upload workflow (the actual pain point):** Neil uploads via an S3-compatible
  desktop client (Cyberduck) directly into R2 folders. There is no web UI for this —
  it's a raw file-manager-style interaction with bucket paths.
- A prior audit (see `ROADMAP.md`) already identified several performance/infra gaps:
  the hero slideshow eagerly loads all originals, images are served from an uncached
  `r2.dev` subdomain instead of a proper CDN domain, thumbnails are undersized for
  retina, `photo.sizes[]` srcset support exists in code but the pipeline never
  populates it, and OG tags are set client-side so social link previews don't render.

**The actual problem prompting this review:** Neil finds the folder-based upload
workflow tedious enough that he has largely stopped uploading new photos. The site's
core value proposition — regularly showing new work — is failing not because of a
technical defect but because of workflow friction. This review should treat that as
the primary problem to solve, not a secondary feature request.

---

## Constraints and requirements

- **Cost ceiling: free, or very low cost.** State explicit dollar figures for any
  option that isn't strictly free, and be precise about the usage level at which free
  tiers of any service you propose (Cloudflare Workers/Pages/R2/D1/KV, GitHub
  Actions/Pages, Vercel, Netlify, Supabase, etc.) would start charging.
- **Fully open to changing the stack.** GitHub Pages, the static-JS-only approach, and
  the current R2-plus-cron pipeline are not sacred. If a different host or a small
  amount of backend/serverless code produces a meaningfully better result while
  staying cheap, propose it. Don't anchor on "minimal diff from current state" as a
  goal in itself.
- **Primary new capability: an interactive, mobile-first upload page.** Neil needs to
  be able to upload photos from his phone (not just Mac/desktop) through an actual web
  UI — file/photo picker, multi-select, progress feedback, resilience to flaky mobile
  connections — replacing the current S3-client-into-folders workflow. This is the
  feature that needs to exist for the friction problem to actually go away.
- **Auth: password-based, deliberately simple.** Neil wants a straightforward
  shared-password gate on the upload page rather than OAuth or anything with account
  management overhead. Evaluate whether a naive client-side password check is
  acceptable here or whether it needs to be a server/edge-verified check with a signed
  session — give a real opinion, not just "it depends."
- **Design for eventual generalizability, but don't build it now.** Neil would
  eventually like this to be usable by other, non-technical photographers as a
  reusable framework — not a one-off personal hack. Factor this into your architecture
  recommendation (e.g., prefer config-driven category/album definitions over
  hardcoded assumptions, keep branding/theming separable) but do not scope-creep the
  current recommendation into building a multi-tenant product. Call out clearly what
  would need to change later if that direction were pursued, and keep it out of the
  phased plan itself unless it's nearly free to accommodate now.
- **Preserve what's actually working.** The curation model (flat vs. album
  categories, `_draft-` hiding, orientation-aware hero, EXIF/caption display, clean
  permalink pages with prev/next) reflects real design decisions, not accidents.
  Any alternative architecture needs to preserve this functionality or offer a
  clearly better equivalent — not silently drop it.
- **Respect the existing visual identity.** The site has a deliberate aesthetic: warm
  cream background (`#F6F3EE`), dark warm text (`#1C1916`), amber/gold accent
  (`#C9963A`), Space Grotesk typeface, 1400px max content width. Any UI you propose
  (especially the new upload page) should feel like it belongs to this site, not like
  a bolted-on admin panel.
- **Do not default to generic "AI-generated" visual or verbal patterns.** This
  applies in two places:
  1. **Any UI/design recommendations** — avoid the current wave of template-feeling
     aesthetics: purple/violet gradients, glassmorphism, generic centered hero cards
     with a big rounded CTA button, Inter-everywhere sameness, soft-shadow-on-everything.
     If you propose visual changes, ground them in photography-portfolio and editorial
     design conventions, not generic SaaS-landing-page conventions.
  2. **Your own writing.** Write this document like a senior engineer's design doc or
     RFC — direct, specific, opinionated where warranted. Avoid AI-tell phrasing:
     no "In conclusion," no "it's not just X, it's Y," no reflexive rule-of-three
     lists, no excessive bolding of key terms, no em-dash-heavy sentence rhythm, no
     marketing-voice enthusiasm. Say what you actually think, including where the
     current design is fine as-is and doesn't need touching.

---

## What to do

1. **Read before concluding.** Read `CLAUDE.md`, `ROADMAP.md`, and the actual source
   (`app.js`, `gallery.js`, `hero.js`, `photo.js`, `tokens.css`, `style.css`,
   `scripts/build_catalog.py`, `.github/workflows/update-catalog.yml`). Check recent
   `git log` for signal about what's already been tried or flagged (e.g. the cron
   interval was just reduced from 30 min to 6 h — understand why, and whether your
   proposal makes that whole mechanism unnecessary). Don't rely solely on the
   background summary above.
2. **Diagnose the current architecture.** What's genuinely well-suited to a
   zero-budget photo portfolio, and what's accumulating friction? Be specific about
   *why* the upload workflow became painful enough to stop usage — is it the S3 client
   itself, the lack of a mobile path, the folder/naming conventions, the delay before
   photos appear live, something else?
3. **Propose 2–4 candidate architectures**, spanning a real range — e.g. something
   close to today's stack with a serverless upload endpoint bolted on, something that
   replaces the cron-based catalog rebuild with event-driven updates, and something
   that changes the hosting platform entirely. For each: what it is, how the upload
   flow and catalog/thumbnail/EXIF pipeline would work, mobile upload UX specifics,
   auth approach, migration effort and risk (custom domain, existing permalink URLs
   for SEO, PhotoSwipe integration, `catalog.json` consumers), and realistic cost at
   current scale and at 5–10x scale.
4. **Recommend one** (or an explicit hybrid), with your reasoning. Disagree with any
   part of Neil's framing above if you think it's wrong — e.g. if you think
   password-only auth is a mistake, or generalizability shouldn't influence the
   near-term design at all, say so plainly.
5. **Produce a phased implementation plan**, in the same spirit as the existing
   `ROADMAP.md` (checkbox phases, ordered by impact-per-effort, each phase
   independently shippable). This is a planning document only — do not write
   implementation code in this pass.
6. **Close with open questions** — decisions that genuinely need Neil's input before
   implementation starts (e.g. willingness to touch DNS, tolerance for a specific
   migration risk, whether an interim hybrid state is acceptable).

## Output

Write your findings to a new file, `ARCHITECTURE_REVIEW.md`, at the repo root.
Do not edit `ROADMAP.md` or any other existing file — this is a read-only analysis
pass. If your recommendation subsumes or supersedes items already in `ROADMAP.md`,
say so explicitly in your document rather than editing it directly, so Neil can decide
how to reconcile the two.
