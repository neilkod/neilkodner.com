# neilkodner.com

Photography portfolio of Neil Kodner. A static site built with [Eleventy](https://www.11ty.dev/)
and deployed to GitHub Pages by GitHub Actions on every push to `main`.

The design rationale, research and roadmap are in [`docs/redesign/`](docs/redesign/index.html).
The previous R2 + catalog setup is documented in [`docs/archive/`](docs/archive/).

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
| `src/_data/site.yml` | Name, email, social links, navigation |
| `src/_data/galleries/*.yml` | Photo order, captions, alt text |
| `src/index.njk` | Homepage (its photos are chosen in this file) |
| `src/about.njk`, `src/contact.njk` | About and Contact text |
| `src/css/site.css` | All styles. Colours and spacing are tokens at the top |
| `src/_includes/` | Page shell, gallery layout, assignment band |
| `src/_data/redirects.yml` | Old URLs that forward to new pages |
| `eleventy.config.js` | Image sizes, plate numbering, GPS check |
