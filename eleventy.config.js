import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import Image from "@11ty/eleventy-img";
import exifr from "exifr";

const PHOTOS = "src/photos";
const OUT_IMG = "_site/img/";
const URL_IMG = "/img/";

// Widths are capped at each master's own width (no upscaling).
const WIDTHS = [480, 800, 1200, 1600, 2200, 3000, "auto"];
const THUMB_WIDTHS = [240, 480];

// Grid-aware `sizes` per row type. Desktop starts at 1100px (12 columns,
// content max 1520px, side margin ~4.4vw). Tablet 700–1099 (8 columns).
const SIZES = {
  full: "(min-width: 1100px) min(1520px, 91vw), 100vw",
  wide: "(min-width: 1100px) min(1140px, 68vw), 100vw",
  upright: "(min-width: 1100px) min(500px, 30vw), (min-width: 700px) 60vw, 92vw",
  coda: "(min-width: 1100px) min(1010px, 61vw), 100vw",
  opener: "(min-width: 1100px) min(1010px, 61vw), 100vw",
  preview: "(min-width: 1100px) 34vw, 100vw",
  small: "(min-width: 700px) 30vw, 92vw",
};

function imageOptions(widths) {
  return {
    widths,
    formats: ["avif", "jpeg"],
    outputDir: OUT_IMG,
    urlPath: URL_IMG,
    sharpAvifOptions: { quality: 60, effort: 3 },
    sharpJpegOptions: { quality: 80, mozjpeg: true, progressive: true },
    filenameFormat(id, src, width, format) {
      const name = path.basename(src, path.extname(src));
      return `${name}-${id}-${width}.${format}`;
    },
  };
}

async function processPhoto(file, widths = WIDTHS) {
  const src = path.join(PHOTOS, file);
  if (!fs.existsSync(src)) throw new Error(`Photo not found: ${src}`);
  return Image(src, imageOptions(widths));
}

const ratioOf = (meta) => {
  const j = meta.jpeg[meta.jpeg.length - 1];
  return j.width / j.height;
};

function pictureHtml(meta, { alt, sizes, eager = false, cls = "" }) {
  if (alt === undefined || alt === null || String(alt).trim() === "") {
    throw new Error("Every photo needs alt text.");
  }
  return Image.generateHTML(meta, {
    alt,
    sizes,
    loading: eager ? "eager" : "lazy",
    decoding: eager ? "sync" : "async",
    ...(eager ? { fetchpriority: "high" } : {}),
    ...(cls ? { class: cls } : {}),
  });
}

// Number plates: single photos get "07", pairs get "04–05". Anchor id = first number.
function numberPlates(plates) {
  let n = 0;
  const pad = (x) => String(x).padStart(2, "0");
  return (plates || []).map((p) => {
    const photos = (p.photos || [{ file: p.file, alt: p.alt }]).map((ph) => ({
      ...ph,
      r: ratio(ph.file),
    }));
    const total = photos.reduce((s, ph) => s + ph.r, 0);
    photos.forEach((ph) => (ph.share = ph.r / total));
    const first = n + 1;
    n += photos.length;
    const label = photos.length > 1 ? `${pad(first)}–${pad(n)}` : pad(first);
    return { ...p, photos, r: photos[0].r, num: label, anchor: String(first) };
  });
}

// Width / height of a master, read synchronously from the file header.
function ratio(file) {
  const src = path.join(PHOTOS, file);
  if (!fs.existsSync(src)) throw new Error(`Photo not found: ${src}`);
  const s = Image.statsSync(src, { widths: [null], formats: ["jpeg"] }).jpeg[0];
  return +(s.width / s.height).toFixed(4);
}

// Image files are kept between builds as a cache. Delete any that no page
// references any more (a replaced or removed photo), so they don't get deployed.
function pruneImages(outDir) {
  const imgDir = path.join(outDir, "img");
  if (!fs.existsSync(imgDir)) return;
  const html = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".html")) html.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(outDir);
  const all = html.join("\n");
  for (const f of fs.readdirSync(imgDir)) {
    if (!all.includes(`/img/${f}`)) fs.unlinkSync(path.join(imgDir, f));
  }
}

// Fail the build if any master still carries GPS coordinates.
async function checkGps() {
  const bad = [];
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
    );
  for (const f of walk(PHOTOS).filter((f) => /\.jpe?g$/i.test(f))) {
    const gps = await exifr.gps(f).catch(() => null);
    if (gps && gps.latitude != null) bad.push(f);
  }
  if (bad.length) {
    throw new Error(
      `GPS location found in:\n  ${bad.join("\n  ")}\nRe-export with "Remove Location Info" on.`
    );
  }
}

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  eleventyConfig.addPassthroughCopy({
    "src/fonts": "fonts",
    "src/css": "css",
    "src/js": "js",
    "src/favicon.svg": "favicon.svg",
    CNAME: "CNAME",
  });
  eleventyConfig.addWatchTarget("src/css/");

  eleventyConfig.on("eleventy.before", checkGps);

  eleventyConfig.addFilter("numberPlates", numberPlates);
  eleventyConfig.addFilter("ratio", ratio);
  eleventyConfig.addFilter("plateCount", (plates) =>
    (plates || []).reduce((s, p) => s + (p.photos ? p.photos.length : 1), 0)
  );

  // {% photo "hockey/x.jpg", "alt", "full" %}  -> <picture>
  eleventyConfig.addAsyncShortcode("photo", async (file, alt, sizeKey = "full", eager = false) => {
    const meta = await processPhoto(file);
    const r = ratioOf(meta).toFixed(4);
    return `<div class="ph" style="--r:${r}">${pictureHtml(meta, {
      alt,
      sizes: SIZES[sizeKey] || sizeKey,
      eager,
    })}</div>`;
  });

  // Pair item: flex-grow equal to aspect ratio gives both photos the same height.
  eleventyConfig.addAsyncShortcode("pairPhoto", async (file, alt, share) => {
    const meta = await processPhoto(file);
    const r = ratioOf(meta);
    const pct = Math.round((share || 0.5) * 91);
    return `<div class="pair-item ${r >= 1 ? "is-h" : "is-v"}" style="--r:${r.toFixed(4)};flex-grow:${r.toFixed(4)}">${pictureHtml(meta, {
      alt,
      sizes: `(min-width: 700px) ${pct}vw, 100vw`,
    })}</div>`;
  });

  // Index thumbnail at a fixed height.
  eleventyConfig.addAsyncShortcode("thumb", async (file, alt) => {
    const meta = await processPhoto(file, THUMB_WIDTHS);
    const r = ratioOf(meta);
    const w = Math.round(96 * r);
    return pictureHtml(meta, { alt, sizes: `${w}px` });
  });

  // Art-directed opener: one photo for phones, another for wider screens.
  eleventyConfig.addAsyncShortcode("opener", async (wideFile, wideAlt, phoneFile) => {
    const wide = await processPhoto(wideFile);
    const phone = await processPhoto(phoneFile);
    const srcset = (m, fmt) => m[fmt].map((e) => `${e.url} ${e.width}w`).join(", ");
    const big = (m) => m.jpeg[m.jpeg.length - 1];
    const pw = big(phone);
    const ww = big(wide);
    const phoneSizes = "92vw";
    return `<div class="ph" style="--r:${(ww.width / ww.height).toFixed(4)}"><picture>
  <source media="(max-width: 699px)" type="image/avif" srcset="${srcset(phone, "avif")}" sizes="${phoneSizes}" width="${pw.width}" height="${pw.height}">
  <source media="(max-width: 699px)" type="image/jpeg" srcset="${srcset(phone, "jpeg")}" sizes="${phoneSizes}" width="${pw.width}" height="${pw.height}">
  <source type="image/avif" srcset="${srcset(wide, "avif")}" sizes="${SIZES.opener}">
  <img src="${ww.url}" srcset="${srcset(wide, "jpeg")}" sizes="${SIZES.opener}" width="${ww.width}" height="${ww.height}" alt="${wideAlt.replace(/"/g, "&quot;")}" loading="eager" fetchpriority="high" decoding="sync">
</picture></div>`;
  });

  // Open Graph image: 1200 x 630 crop of a page's lead photo. The filter returns
  // the URL right away; the files are written before the build finishes.
  const ogJobs = new Map();
  eleventyConfig.addFilter("ogImage", (file) => {
    const name = path.basename(file, path.extname(file));
    if (!ogJobs.has(file)) {
      ogJobs.set(
        file,
        Image(path.join(PHOTOS, file), {
          widths: [1200],
          formats: ["jpeg"],
          outputDir: OUT_IMG,
          urlPath: URL_IMG,
          sharpJpegOptions: { quality: 82, mozjpeg: true },
          transform: (sharp) => sharp.resize(1200, 630, { fit: "cover", position: "attention" }),
          filenameFormat: () => `og-${name}.jpg`,
        })
      );
    }
    return `${URL_IMG}og-${name}.jpg`;
  });
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    await Promise.all(ogJobs.values());
    pruneImages(dir.output);
  });

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
