# neilkodner.com

Photography portfolio of Neil Kodner, live at [neilkodner.com](https://neilkodner.com).
A static site built with [Eleventy](https://www.11ty.dev/) and deployed to GitHub Pages by
GitHub Actions on every push to `main`. No server, no database, no scheduled jobs.

## The site

| Page | What |
|---|---|
| `/` | Opening hockey photograph, a one-line introduction, previews of Hockey, Street and Elsewhere, and the assignment contact |
| `/hockey/` | The main portfolio: 12 photographs, hand-sequenced, with datelined captions |
| `/street/` | Street and travel together: 13 photographs, slower pacing, place and date only |
| `/elsewhere/` | Aviation, birds and the coast. Linked from home and the footer, not the main navigation |
| `/about/`, `/contact/` | Short biography with a facts list, and the email address |

Navigation is Hockey, Street, About, Contact. The design (called "Dateline") uses a grey
ground tuned for white ice, Newsreader for text and Schibsted Grotesk for captions and
navigation. The full rationale, research and design system are in
[`docs/redesign/`](docs/redesign/), along with the [original brief](docs/redesign/brief.md)
and a list of where the build differs from the proposal.

The previous site (R2 bucket, `catalog.json`, slideshow, lightbox) and its documentation were
removed. They survive in git history: commit
[`8869580`](https://github.com/neilkod/neilkodner.com/tree/8869580) is the last version of the
old site, with its README, ROADMAP, architecture review and build prompts.

## Publishing photos

1. **Export from Lightroom Classic.** JPEG, sRGB, long edge 3000 px, quality 88,
   output sharpening Screen / Standard, metadata "Copyright & Contact Info Only",
   **Remove Location Info** on.
2. **Put the file in the gallery folder**: `src/photos/hockey/`, `src/photos/street/`
   or `src/photos/elsewhere/`. Lowercase file names.
3. **Add it to the gallery file** in `src/_data/galleries/` (`hockey.yml`, `street.yml`,
   `elsewhere.yml`). Order in the file is the order on the page:

   ```yaml
   - row: full            # full | wide | upright | pair | coda
     file: hockey/dsc04395.jpg
     alt: What is in the picture, in plain words.
     caption: One plain sentence. (Hockey only; Street and Elsewhere use dateline alone.)
     dateline: San Jose. January 2026.
   ```

   `wide` takes `side: left` or `side: right`. `upright` takes `side: center` or
   `side: right`. A `pair` has `photos:` with two `file`/`alt` entries and one caption.
   The comment at the top of `hockey.yml` explains each row type.
4. **Commit and push to `main`.** The site updates in about two minutes.

The build stops with an error if a photo has no alt text, if a file is missing, or if a
photo still carries GPS location data.

## Working locally

```sh
npm install
npm start          # http://localhost:8080, rebuilds on save
npm run build      # writes _site/
```

The first build takes a few minutes because it makes AVIF and JPEG copies of every photo at
several widths. Later builds reuse them.

## Where things are

| Path | What |
|---|---|
| `src/_data/site.yml` | Name, email, LinkedIn link, navigation |
| `src/_data/galleries/*.yml` | Photo order, captions, alt text |
| `src/index.njk` | Homepage (its photos are chosen in this file) |
| `src/about.njk`, `src/contact.njk` | About and Contact text |
| `src/css/site.css` | All styles. Colours and spacing are tokens at the top |
| `src/_includes/` | Page shell, gallery layout, assignment band |
| `src/_data/redirects.yml` | Old URLs that forward to new pages |
| `eleventy.config.js` | Image sizes, plate numbering, GPS check |
| `.github/workflows/deploy.yml` | Build and deploy on push to `main` |

## Deployment

In the repository's Settings → Pages, Source must be set to **GitHub Actions**. Each push to
`main` runs `deploy.yml`, which builds the site and publishes `_site/`. Resized images are
cached between runs, so a deploy without new photos takes about two minutes end to end.

## Open items

- The launch photos are 2000 px placeholders copied from the old R2 bucket. Replace them with
  3000 px Lightroom exports.
- `confirm:` notes in `src/_data/galleries/*.yml` list facts still to check (mostly venues and
  opponents). They never appear on the site.
- `src/about.njk` has a TODO for a sentence about hockey background.
- The old R2 bucket and its four repository secrets can be deleted once the bucket is no longer
  needed as a backup.
