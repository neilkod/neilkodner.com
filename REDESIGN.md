# neilkodner.com: redesign strategy and architecture blueprint

Date: 2026-09-08
Author: creative direction / IA / architecture review
Status: **strategy and design only.** No site files were modified. No implementation code
was written. This document is the input to a future implementation session.

Companion documents: [`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md) (publishing
pipeline, 2026-08-09), [`IMPLEMENTATION.md`](IMPLEMENTATION.md), [`ROADMAP.md`](ROADMAP.md).
This document sits one level above all three. Where it disagrees with them, the
disagreement is called out explicitly in §19 and §26.

---

## 1. The short version

**The new neilkodner.com should be a book, not a website.**

One continuous, curated sequence of your best photographs on the homepage, large,
uninterrupted, with your name set small above the first frame and nothing else competing
with the pictures. Below it, a plain dated index of every gallery you have published. One
subject gets its own room because it is your strongest body of work and your commercial
direction: hockey. Three items in the navigation. No categories, no albums, no archive, no
journal, no hero slideshow, no services page.

Four decisions carry most of the value:

| # | Decision | What it replaces |
|---|---|---|
| 1 | **The homepage is the portfolio.** A full-bleed stream of 24–36 photographs, statically rendered, first frame in the HTML. | 100dvh hero slideshow → category tiles → album tiles → album page → lightbox |
| 2 | **Delete the taxonomy layer from the interface.** Galleries are the only container. `subject` becomes a tag, not a page. | Categories, `flat` categories, album strips, category covers, `?cat=` |
| 3 | **Curation is one boolean per photograph.** `portfolio: true`, set from the star rating you already assign in Lightroom. | The portfolio-vs-archive problem, and the "featured" flag you were considering |
| 4 | **Hockey gets a page. Sports does not get a section.** `/hockey/` exists from day one. `/sports/` exists only if a second sport ever earns a page. | Sports → Hockey → Cycling → Other Sports, built before any of it exists |

And one uncomfortable observation that outranks all four, developed in §26:

> The site has 31 photographs and has not gained one since 20 June. Two excellent
> engineering documents have been written about it in that time and neither has shipped a
> line. If you do one thing from this document, do not do the redesign. Upload 150
> photographs with the workflow you already have, painful as it is, and then redesign
> against a real body of work.

---

## 2. What I looked at

**Repository, in full:** `index.html`, `about/index.html`, `photography/index.html`, the
five generated album stubs, `album.html`, `photo/index.html`, `404.html`,
`css/{tokens,style,print,lightbox}.css`, `js/{app,gallery,hero,photo}.js`,
`scripts/{build_catalog,build_seo,check_gps}.py`, `scripts/upload-to-r2.sh`,
`.github/workflows/update-catalog.yml`, `catalog.json`, `sitemap.xml`, `feed.xml`,
`robots.txt`, `README.md`, `ROADMAP.md`, `ARCHITECTURE_REVIEW.md`, `CLAUDE.md`, and the
git history.

**Live site:** this session's network policy blocks outbound requests to `neilkodner.com`
and to `pub-….r2.dev`, so I could not load the rendered page or re-probe R2 headers. The
site is fully static and I have every byte of its HTML, CSS and JavaScript, so the visual
critique in §5 is derived from source rather than from a screenshot. The header findings
in `ARCHITECTURE_REVIEW.md` §2 were verified there on 2026-08-09 and nothing in the repo
since has changed the code paths involved.

**Competitive research:** web search only (page fetches to third-party domains are blocked
by the same policy). Findings and sources are in §4.

---

## 3. Where the site actually stands

Everything below is measured from `catalog.json` and the git history in this working copy,
today.

### 3.1 The content

| | |
|---|---|
| Photographs published | **31** |
| Categories | 3 (Aviation, Hockey, Places) |
| Albums | 5 |
| Hero images | 23 |
| Albums with a `date` | **0 of 5** |
| Albums with a `location` | **0 of 5** |
| Albums with a `cover` | 1 of 5 |
| Photos with a caption | 2 of 31 |
| Largest album | Hockey / "Select Images", 20 photos |
| Smallest album | Places / "Seattle", 1 photo |
| Album titled "Other" | Aviation / Other, 3 photos |

Two-thirds of your published work is hockey. One album is called "Other" and one is called
"Select Images". Your busiest container holds twenty pictures and your emptiest holds one.

There are **23 hero images and 31 gallery images**. Nearly as much of the site's content
budget is spent on a decorative slideshow as on the actual body of work.

### 3.2 The commit history

Every one of the last 50 commits is `chore: update catalog [skip ci]`, and every one of
them changes exactly one line of `catalog.json`:

```
d607139  2026-09-07   catalog.json | 2 +-
c4b5cc2  2026-09-07   catalog.json | 2 +-
6cc8c40  2026-09-07   catalog.json | 2 +-
…
```

`build_catalog.py:749` writes `"generated": datetime.now(...)` unconditionally, so the
workflow's `git diff --staged --quiet` guard at `update-catalog.yml` never fires. This is
exactly the bug `ARCHITECTURE_REVIEW.md` §3.2 identified as a 30-minute fix and placed at
Phase 0, "do this regardless". It was written a month ago. It is still live. Four commits
and four full GitHub Pages rebuilds happen every day to change one ISO timestamp into
another.

### 3.3 Two live functional bugs worth knowing before you redesign

**Shared photograph links have no social preview.** `photo/index.html` ships no
`og:image` tag at all. `js/photo.js:93` calls `setMeta('og:image', imgUrl)` after
`catalog.json` loads. Social scrapers do not run JavaScript. So the copy-link button in
the lightbox, which is the exact mechanism your "Instagram post → see the full gallery →
neilkodner.com" plan depends on, produces links that render as a bare grey box in iMessage,
Slack, WhatsApp and X. `ROADMAP.md` Phase 4 fixed this for album pages by pre-rendering
static stubs. Photo pages were left as "optional/future". They are not optional if the
site is meant to be the canonical home of work distributed through Instagram.

**"Latest Albums" is not showing your latest albums.** `getLatestAlbums()` in `app.js`
sorts on `album.date`, which is `""` in 5 of 5 albums, so `localeCompare` compares empty
strings and the sort is a no-op. The homepage strip shows albums in bucket-listing order.
Identified in `ARCHITECTURE_REVIEW.md` §3.1, still live.

Both bugs disappear in the design below, the first because photo pages become static stubs
and the second because the concept of an "album tile strip" is deleted.

---

## 4. Competitive research

Page fetches were blocked, so this rests on search results plus published descriptions.
Sources are listed at the end of this section. The value here is in the patterns, not in
the individual sites.

### 4.1 Sports and hockey, and your actual local competition

This is the most important research finding in the document, and it is not a design
finding.

**Dean Tait / Hockey Shots** ([hockeyshots.net](https://hockeyshots.net), established
2004, acquired by Tait in 2017) photographs the San Jose Sharks and San Jose Barracuda,
the PWHL Isobel Cup, and **youth hockey teams across Northern California** as a family
business with his wife. He is the credited photographer for
[San Jose Hockey Now](https://sanjosehockeynow.com/san-jose-sharks-dean-tait-hockey-shots-top-10-pictures/)
and runs [workshops](https://www.sportshots.media/workshops/). He is doing precisely the
thing you describe wanting to do, in your city, and has been doing it for twenty years.

Alongside him: **[ICON Sports Photos](https://iconsportsphotos.com/)** (San Rafael, Bay
Area youth sports including ice hockey, league contracts), **Xtreme Sports Photos** (San
Jose, live sports plus athlete portraits, via
[Peerspace](https://www.peerspace.com/resources/sports-photographers-san-jose/)), and
**[YSPN](https://www.yspn.com/hockey)**, a national network placing photographers at
league games at roughly $12 per player.

**What this means for you.** The generic search terms ("hockey photographer san jose") are
owned by incumbents with twenty years of domain age and local citations. You will not rank
for them in year one, and building landing pages aimed at them would be the SEO farm you
said you did not want. What is winnable is specific: the name of an actual game, at an
actual rink, on an actual date. See §20.

It also means the differentiator cannot be "I photograph hockey." It has to be the
pictures. Which is good, because the pictures are the thing you control.

**Structural pattern across sports photographers.** The successful ones split into two
distinct products.

| Product | Purpose | Example |
|---|---|---|
| **Portfolio site** | Proves capability. Small, curated, editorial. | Brad Mangin's [manginphotography.net](https://manginphotography.net/), a hand-built HTML portfolio |
| **Delivery / sales platform** | Where the money is. Per-event, per-team, per-athlete galleries, password-gated, purchasable. | Mangin's [PhotoShelter archive](https://brad.photoshelter.com/), 50,000+ images, with Galleries / Lightbox / Cart / Search |

Mangin, a Bay Area sports photographer with a 75,000-image archive donated to the Baseball
Hall of Fame, keeps these on **two separate systems**. He did not build a shopping cart
into his portfolio.

The youth-sports business research is emphatic on the same split. Sales platforms are
described as combining "fast bulk processing, athlete-level photo discovery, mobile
galleries, protected previews, flexible selling options and privacy controls"
([Lenzeit](https://www.lenzeit.com/blog/best-sports-photo-sales-software-youth-sports-photographers)),
with delivery windows of 3 to 48 hours
([Hanlon](https://www.hanlonphotography.ca/booking/sports/),
[GTA Sports](https://gtasportsphotography.com/hockey-team-sports-photography)).

**What you should borrow:** the split itself. Your portfolio site proves you can shoot
hockey. When a paying client appears, their gallery lives somewhere else. Do not build
per-athlete search, download purchase, or password gating into a static site. See §14.4.

### 4.2 Portfolio curation: how many photographs

Consistent across every source: **15 to 30 images per body of work**, 20 to 40 total for a
portfolio. "A tight, curated gallery of your strongest 15 to 30 images per category beats
a sprawling archive that buries your best work." Viewers spend three to five minutes.
([GoPickle](https://gopickle.ai/blogs/how-many-photos-should-a-photographer-show-in-a-portfolio),
[Pixpa](https://www.pixpa.com/blog/best-photography-portfolio-websites))

**What you should borrow:** the number is small and it is a hard constraint, not a target.
The homepage edit in §12 is capped at 36 frames. When it exceeds that, something comes out.

### 4.3 Minimalist portfolios: the upper limit of simplicity

The recurring pattern is single-column, full-width, minimal or absent navigation, subdued
neutral palette, generous whitespace, and typography doing the personality work. Menus cut
to three items. "Full-screen images allowing each photo to speak for itself."
([Minimalio](https://minimalio.org/photographer-portfolio-website-7-minimalist-examples/),
[htmlBurger](https://htmlburger.com/blog/minimalist-portfolio-website/),
[Pixpa](https://www.pixpa.com/blog/best-photography-portfolio-websites))

**What you should borrow:** the single column and the three-item menu. **What you should
not borrow:** the trend articles' enthusiasm for smooth-scroll animation, parallax, and
"soft gradients"
([Pixieset](https://blog.pixieset.com/blog/website-design-trends/)). Every one of those
puts motion between the viewer and the photograph.

### 4.4 What has gone stale

The 2026 trend writing is candid about template sameness: "template-based tools and
no-code builders made it easy for anyone to build a site that looks decent, but the
downside is that a lot of websites now look almost identical"
([Envato](https://elements.envato.com/learn/web-design-trends)). The full-viewport hero
image with the photographer's name centered over it is the single most reproduced move in
the genre, present in effectively every Squarespace and Pixieset photography template.

Your site currently has one. See §5.2 and §13.

**Sources:**
[Lenzeit sports photo sales software](https://www.lenzeit.com/blog/best-sports-photo-sales-software-youth-sports-photographers) ·
[Hanlon Photography sports booking](https://www.hanlonphotography.ca/booking/sports/) ·
[GTA Sports Photography hockey services](https://gtasportsphotography.com/hockey-team-sports-photography) ·
[Hockey Shots / San Jose Hockey Now](https://sanjosehockeynow.com/hockey-shots-san-jose-hockey-now-sponsor/) ·
[Sport Shots workshops](https://www.sportshots.media/workshops/) ·
[ICON Sports Photos](https://iconsportsphotos.com/) ·
[YSPN hockey](https://www.yspn.com/hockey) ·
[Peerspace: sports photographers in San Jose](https://www.peerspace.com/resources/sports-photographers-san-jose/) ·
[Mangin Photography Archive](https://manginphotography.net/) ·
[Brad Mangin on PhotoShelter](https://brad.photoshelter.com/) ·
[Freestyle Photography hockey](https://www.freestylephotography.com/hockey/) ·
[Bruce Bennett Studios](https://www.brucebennettstudios.com/hockeys-greatest-photos) ·
[GoPickle: how many photos in a portfolio](https://gopickle.ai/blogs/how-many-photos-should-a-photographer-show-in-a-portfolio) ·
[Pixpa: best photography portfolio websites](https://www.pixpa.com/blog/best-photography-portfolio-websites) ·
[Minimalio: 7 minimalist examples](https://minimalio.org/photographer-portfolio-website-7-minimalist-examples/) ·
[htmlBurger: minimalist portfolios](https://htmlburger.com/blog/minimalist-portfolio-website/) ·
[Format: photography website checklist](https://www.format.com/magazine/resources/photography/photography-website-checklist) ·
[Zenfolio: sports portfolio examples](https://zenfolio.com/sports-photography/best-portfolio-website-examples/) ·
[Pixieset: website design trends](https://blog.pixieset.com/blog/website-design-trends/) ·
[Envato: web design trends](https://elements.envato.com/learn/web-design-trends)

---

## 5. Critique of the current site

The engineering here is good. `ARCHITECTURE_REVIEW.md` §3.4 is right about that and I will
not repeat it. This section is about the product and the design, which are a different
question.

### 5.1 Brand

The wordmark is **"Photography by Neil Kodner"**. A wordmark that has to explain what it
is has already lost. Nobody writes "Photography by Nadav Kander" on their site. They write
their name and let the pictures explain the rest. It is also long enough that
`style.css:171` collapses it to an amber **"NK"** monogram below 600px, which is a
workaround for a problem the wordmark created. Two people on earth know what NK means.

The About page says:

> "This site is a living archive of what I've shot. **No prints for sale, no client work
> — just the photos.**"

That sentence closes the exact door this whole redesign is trying to open. It is the first
thing a hockey organizer would read on your About page.

Personality: there is a warm cream ground, an amber accent, and a geometric sans. Those
are decisions, and they read as considered. What they do not read as is *yours*. Nothing
on the site could not be a Squarespace template with different photographs in it. The
Airbnb line on the About page is the only sentence with a person behind it.

Commercial credibility for sports work: none, and correctly none, because there is no
sports business yet. That is fine. What is not fine is that the site actively states the
opposite of the direction you want.

### 5.2 Visual design

**Typography.** Space Grotesk for everything. It is a well-drawn face and it is wrong
here. It is a display grotesque with deliberate quirks (the flat-topped `t`, the angled
terminals, the tight geometric bowls) that were drawn to give tech brands a bit of edge,
and it has been used to do exactly that for six years. It carries a strong association
with startups, developer tools, and crypto. On a photography site it fights the pictures
for personality and loses the association battle. Using one family for the wordmark, the
headings, the body, the nav, the labels and the EXIF table also means the type system has
no tonal range. Everything speaks in the same voice at different sizes.

**Color.** `--color-bg: #F6F3EE` is a warm cream. This is the one purely technical
objection in this section, and it is the most consequential. A warm ground shifts the
perceived color of every photograph placed on it. Simultaneous contrast is real and it
runs in the direction that hurts you most: hockey is shot on blue-white ice under
mixed arena light, aviation is shot against blue sky. A warm ground pushes both toward
green and makes neutral whites look dingy. Photographers and galleries hang work on
neutral grounds for this reason. The amber accent `#C9963A` compounds it by introducing a
saturated warm hue at the image layer, on tile hover borders and on active nav links.

**Whitespace and rhythm.** Generous and well-tuned at the section level (`--space-24`
between sections). The problem is what fills the space: three category tiles and four
album tiles, on a site with five galleries. The rhythm is designed for a site with
volume it does not have.

**Image scale.** This is the largest visual failure. The justified-row grid sets
`flex-basis: ${ar * 240}px`, producing rows roughly 240–320px tall on a desktop viewport.
A hockey action frame at 280px tall is a thumbnail. It is not possible to see whether the
puck is on the stick. Category tiles are `aspect-ratio: 3/4` and album covers are `3/2`,
both of which crop your photographs to fit a container rather than sizing the container to
the photograph.

**The hero.** `100dvh`, a stack of absolutely positioned slides cross-fading over two
seconds, a radial scrim at 42% opacity, and your name at weight 700 with a **three-layer
text-shadow** (`0 1px 3px`, `0 4px 16px`, `0 8px 40px`). The comment in `style.css` is
honest about what is happening: "the scrim handles macro contrast, the shadow handles
letterform crispness." That is a lot of careful engineering spent undoing the damage
caused by putting text on top of a photograph. The right move is to stop putting text on
top of the photograph.

It also costs a full screen. On an iPhone, the first thing a visitor sees is one
photograph they cannot look at properly because your name is written across the middle of
it, and they must scroll past a full viewport to reach a grid of three container tiles.

**Navigation.** Fixed, 64px, frosted glass with a 12px backdrop blur. Two problems. It
permanently occupies 64px of every screen including phones, and the backdrop blur means it
is smearing whatever photograph passes behind it. A blurred rectangle sliding over your
work is a cost with no benefit on a site with three links.

**Hover states.** `transform: scale(1.02)` plus `filter: brightness(1.15)` on every tile,
plus an amber 2px border. Scaling a photograph on hover makes it momentarily soft
(non-integer scaling resamples). Brightening it by 15% is showing the viewer a
misrepresentation of your edit. You spent time in Lightroom setting those tones.

**Mobile.** `.albums-strip` goes to `1fr 1fr` below 480px, so album covers become roughly
170px wide. `.category-grid` goes single-column at 3:4, which is good. The gallery grid
mostly lands one photo per row by accident of aspect ratio rather than by design, and
every image is inset by `--gutter` (up to 2.5rem), so photographs never touch the edge of
the screen. On a phone, edge-to-edge is the only way to give a photograph real size.

**Motion.** Two-second cross-fades on the hero, a 1.8s ease-out entrance animation on the
hero text, 0.3s transitions on hover, 0.4s fade-in on image load. None of it is offensive.
All of it is time during which the viewer is watching the interface instead of the picture.

### 5.3 Photography presentation

This is the section that matters, so here are the direct answers.

| Question | Answer |
|---|---|
| Are the photographs large enough? | **No.** Grid rows land near 240–320px tall. They should be 450–550px on desktop and full-width on mobile. |
| Does the interface disappear? | **No.** Fixed frosted nav, tile borders, hover scaling, hover brightening, an amber accent, and a 200px EXIF panel in the lightbox. |
| Is the ordering meaningful? | **Within a gallery, yes** (the justified-row grid preserving Lightroom order was a good fix, ROADMAP finding #7). **Across the site, no.** Categories are alphabetical, "Latest Albums" is broken. |
| Does the site encourage continued looking? | **No.** After the hero, the visitor's next action is choosing a container, not looking at a photograph. Every click costs a decision. |
| Does the gallery feel editorial? | **No.** It feels like a catalog. Uniform row heights, uniform gaps, no variation in scale, no opening frame. |
| Does it make mediocre images too visible? | **Yes, structurally.** "Select Images" (20 photos) and "Other" (3 photos) sit as equal peers in the same grid. A four-photo album of leftovers gets the same visual weight as your best work. |
| Do exceptional images get room to breathe? | **No.** There is no mechanism for it. Every photograph in a gallery is rendered at the same row height as its neighbors. |
| Are metadata and captions helping? | **Captions, when present, yes.** 2 of 31 have them. **EXIF, no.** See below. |
| How should sports differ from travel? | Sports is a sequence with a narrative arc. Travel is a set. The rendering should differ. Today it does not. |

**On EXIF.** The lightbox reserves 200px at the bottom of every photograph to display
Camera / Lens / Focal length / Aperture / Shutter / ISO. That is 200px taken from the
photograph, on every slide, for information that serves one visitor type: another
photographer, occasionally, briefly. It tells a hockey organizer nothing. It tells a
friend nothing. It is the most visible thing on the site that exists because the pipeline
happened to be able to produce it.

### 5.4 Information architecture

Current model:

```
Home ──► Photography ──► ?cat=hockey ──► /photography/hockey/select-images/ ──► lightbox
  │         (3 tiles)      (1 tile)              (20 photos)                      ──► /photo/?cat=&album=&photo=
  └──► Latest Albums (4 tiles, unsorted) ────────────┘
```

**Four clicks from the homepage to a photograph**, three of which are spent choosing a
container. Two of the three intermediate screens contain a single meaningful choice.

The organizational concepts in play are: hero, category, flat category, album, album
cover, category cover, latest albums, photo, photo permalink, draft prefix, manifest. That
is eleven concepts for 31 photographs.

Every one of them has a cost that is paid on every page: a decision for the visitor, a
field for you, a branch in `build_catalog.py`, a rendering function in `app.js`, and a
block of CSS.

---

## 6. First principles: what should neilkodner.com be?

Start by discarding the framing. The question is not "what is the better version of this
website." The question is what a person should experience.

**Three things a photographer's website has to do, in order:**

1. Show a photograph, at size, immediately. Before any navigation, any name, any
   explanation.
2. Make the second photograph effortless to reach. Ideally by scrolling.
3. Answer "who is this and where are they" without interrupting 1 and 2.

Everything else is optional. Categories are optional. Albums are optional. An archive is
optional. Search is optional. A services page is optional.

**The governing constraint is that you have 31 photographs.** Any structure with more than
one level of hierarchy will be mostly empty, and empty structure is worse than no
structure, because a container that holds one thing tells the visitor the site is
abandoned. "Places → Seattle → 1 photograph" is currently a real path on your site.

**The governing principle, stated as a rule you can apply later:**

> A subject earns a top-level page when it has **30 or more portfolio-grade frames** and
> you intend to keep shooting it. Until then it lives in Galleries.

That rule is what stops the taxonomy from growing back. Hockey passes it today (20 photos
and rising, and it is the plan). Aviation does not (7). Cycling does not (0). Apply the
rule, do not negotiate with it.

**What the site should feel like.** A photobook. Not a publication and not a journal. A
publication implies issues, a cadence, and writing. You have written two captions in 31
photographs, which is the honest signal about how much writing you want to do. A "Journal"
section would be the emptiest thing on the site within a month. What a book gives you that
a portfolio template does not is *pacing*: one picture at a time, sequence carrying
meaning, the reader moving forward without deciding anything. That is achievable with a
scroll and no interface at all.

---

## 7. Information architecture

### 7.1 The options, evaluated

| Option | Structure | Verdict |
|---|---|---|
| **A** | Home / Work / About / Contact | Close. Fails because "Work" duplicates the homepage, and because it gives hockey no home, which forfeits the commercial direction. |
| **B** | Home / Sports / Photography / About / Contact | **Rejected.** Splits your work into "the sports" and "the rest", which is a business-unit split, not a viewer's split. It also means every non-sport photograph lives under a heading that means "everything else". |
| **C** | Home / Portfolio / Journal / About / Contact | **Rejected.** "Journal" requires writing you have shown no appetite for. An empty journal is worse than no journal. |
| **D** | Home / Sports / Archive / About / Contact | **Rejected.** "Archive" is the wrong public concept at any scale below several thousand images, and arguably at any scale. See §8. |
| **E** | Home / Hockey / Galleries / About | **Selected.** |

### 7.2 The recommendation

```
Neil Kodner                        Hockey   Galleries   About
```

Four things, one of which is the wordmark. Three links.

| Path | Purpose | What is on it |
|---|---|---|
| `/` | The edit. Prove the work is good in under one second. | 24–36 photographs, full-bleed, no captions, no dates. One quiet hockey block partway down. A dated gallery index at the bottom. |
| `/hockey/` | The specialty. Serve visitors C and D. | One opening frame, one honest paragraph, 14–18 hockey photographs, a plain description of what game coverage looks like, the hockey gallery list, contact. |
| `/galleries/` | Discovery and chronology. Serve visitor B. | Reverse-chronological index of every published gallery, with covers. |
| `/galleries/<slug>/` | One body of work. | Opening frame full-bleed, then justified rows. Title, date, venue. |
| `/galleries/<slug>/<photo>/` | One photograph. Serve visitor E and image search. | The photograph, large. Caption. Gallery link. EXIF below the fold. |
| `/about/` | Who and where. Serve visitor A and close the loop for C and D. | A photograph of you, four short paragraphs, email, Instagram, location. |

### 7.3 Why there is no Contact page

A contact page on a one-person site contains an email address and some whitespace. It
exists to fill a navigation slot. Removing it and placing contact where the intent
actually forms is strictly better:

- Bottom of `/hockey/`, where the organizer has just finished looking at hockey pictures.
- Bottom of `/about/`, where a visitor has just read who you are.
- Footer of every page, one line.

If a form is ever wanted, it belongs at the bottom of `/hockey/`, not on a page of its own.

### 7.4 Why "Sports" does not exist

You asked whether Sports should be a section with Hockey, Cycling and Other Sports beneath
it. No. That is an organization chart for a business that has not started, and it is the
same "flexibility as liability" mistake you correctly diagnosed in the content model,
repeated one layer up.

`/hockey/` is a page. If cycling ever reaches 30 portfolio frames, `/cycling/` becomes a
sibling page. If you ever have three sports pages and the nav is crowded, *then* `/sports/`
becomes their parent and the two existing URLs get redirect stubs. That migration costs
about thirty minutes and it happens once, if ever. Building the parent now costs a
navigation item, an index page, and a permanent extra click, starting today.

### 7.5 The five visitors, checked against this IA

| Visitor | First screen | Path to what they need | Clicks |
|---|---|---|---|
| **A** Friend or family | A photograph, full width | Scroll | **0** |
| **B** Photographer | A photograph | Scroll the edit, then Galleries for depth | **0–1** |
| **C** Hockey organizer | A photograph, and "Hockey" in the nav | `/hockey/` → pictures → email address on the same page | **1** |
| **D** Sports client | Same as C | Same as C | **1** |
| **E** Arrives from Google on a photo page | The photograph, at size | Wordmark or "Neil Kodner, Los Gatos" line under the picture → home | **0–1** |

Visitor E deserves specific attention because it is the case the current site handles
worst. A `/photo/?cat=hockey&album=select-images&photo=DSC04243.jpg` URL landed on from a
search result gives no indication of whose site it is beyond a nav bar. In the new design,
every photo page carries the photograph, the gallery it belongs to, and a single line
identifying you and where you are. That one line is also the local-SEO signal.

---

## 8. Portfolio, archive, journal, recent: the decision

You suspected this would be the most important design decision. It is, and the answer is
smaller than you expect.

**You need exactly two concepts: the edit, and the record.**

| Concept | Where it lives | How it is populated |
|---|---|---|
| **The edit** | The homepage | Photographs with `portfolio: true` |
| **The record** | `/galleries/` | Every gallery you have published, newest first |

That is the whole system. One boolean separates them, and one photograph appears in both
places at once with no duplication.

**What is not needed:**

| Rejected concept | Why |
|---|---|
| **Archive** | A public archive of 1,700 photographs with 200 good ones makes the 200 harder to find. Nobody has ever browsed a photographer's archive except the photographer. R2 is your archive. Lightroom is your archive. The website is the edit. |
| **Journal** | Requires writing. See §6. |
| **Recent Work** | `/galleries/` is already reverse-chronological. "Recent" is a sort order, not a page. |
| **Stories** | A story is a gallery with a good title and good sequencing. It does not need a separate type. |
| **Featured flag** | You asked whether one is useful. No. The homepage edit is chosen by `portfolio`, and `/galleries/` is chronological. Nothing needs featuring on top of that. |

**The four functions you asked me to separate without creating four products:**

| Function | Mechanism | Cost |
|---|---|---|
| **Storage** | R2 bucket, plus Lightroom as the master | Already exists |
| **Publication** | A gallery. Title, date, photographs. | Already exists (renamed from "album") |
| **Curation** | `portfolio: true` on a photograph | **One boolean** |
| **Discovery** | `/galleries/`, the sitemap, per-photo pages, the Atom feed | Already exists |

One extra field buys the entire separation. That is the answer.

**Scale check.** With 500 hockey, 200 cycling, 300 aviation, 500 travel and 200 personal
photographs, the homepage shows 30 of them. `/galleries/` shows maybe 60 dated rows, which
is one scrollable page. `/hockey/` shows 18 and lists the hockey galleries. Nothing in this
structure breaks at 1,700 photographs, and nothing in it needed a search box, a tag
system, or a filter UI to get there.

---

## 9. Sitemap

```
/                                       The edit. 24–36 photographs.
│                                       First frame rendered statically in the HTML.
│
├── /hockey/                            The specialty. Portfolio + capability + contact.
│
├── /galleries/                         Reverse-chronological index of all galleries.
│   │
│   └── /galleries/<slug>/              One gallery.
│       │                               e.g. /galleries/jr-sharks-vs-oakland-2026-01-14/
│       │
│       └── /galleries/<slug>/<stem>/   One photograph.
│                                       e.g. …/jr-sharks-vs-oakland-2026-01-14/dsc04243/
│
├── /about/                             Who, where, contact.
│
├── /publish/                           Private. noindex. Not in sitemap or nav.
│
├── /feed.xml                           Atom, latest galleries.
├── /sitemap.xml                        Generated, with image entries.
├── /robots.txt                         Generated.
└── /404.html                           Links home, shows one photograph.

Redirect stubs (meta-refresh + rel=canonical, generated):
  /photography/                       → /galleries/
  /photography/<cat>/<album>/         → /galleries/<new-slug>/
  /photo/                             → /galleries/
  /album.html                         → /galleries/
```

**Notes on URL choices.**

`/galleries/<slug>/<stem>/` rather than a separate `/p/` namespace, so a photograph's URL
contains its gallery. A visitor can delete the last path segment and land somewhere
sensible, and search engines get a real hierarchy.

Gallery slugs carry the event and the date: `jr-sharks-vs-oakland-2026-01-14`, not
`select-images`. The date in the slug is deliberate. It makes slugs unique forever without
a counter, it makes the URL self-describing when pasted into a text message, and it is the
single highest-value SEO decision available to you (§20).

No `/sports/`. No `/aviation/`. No `/places/`. Those are `subject` values, not paths.

---

## 10. Visual direction

Three directions were developed. One is selected.

### Direction 1: "Paper" *(selected)*

A near-neutral paper ground, one editorial serif carrying all the personality, photographs
at full width with nothing on top of them, and a small tracked sans used only for
metadata at 13px and below.

| | |
|---|---|
| **Personality** | Quiet, considered, printed. The site of someone who looks at photographs carefully. |
| **Typography** | Newsreader (variable serif, SIL OFL, self-hosted) for display, titles and prose. System sans for labels only, uppercase, tracked, never above 13px. |
| **Color** | `#FAFAF9` ground, `#121212` ink, `#6B6B68` muted, `#E4E3DF` rules. **No accent color.** |
| **Navigation** | Static, scrolls away, 13px tracked caps, three links. |
| **Image treatment** | Full-bleed on mobile. Full-bleed opening frames. Justified rows at 450–550px on desktop. No crops to fixed aspect ratios. No hover effects. |
| **Strengths** | Neutral ground means photographs render honestly. Serif gives voice without decoration. Ages slowly. Reads as a book. Works equally for hockey and travel. |
| **Weaknesses** | Requires good photographs, because there is nothing else to look at. Less immediately "sporty" than a hockey organizer might expect. |
| **Principles from** | Photobook and gallery-catalogue conventions. The minimalist-portfolio pattern in §4.3. Mangin's hand-built HTML portfolio, which is plain and works. |

### Direction 2: "Rink" *(rejected)*

Near-black ground, photographs glowing out of it, a tight condensed sans, high contrast,
broadcast energy.

| | |
|---|---|
| **Strengths** | Photographs look punchier on dark. Reads as sports immediately. Matches the arena. |
| **Weaknesses** | Dark grounds make photographs look better than they are, which is a trap for a photographer editing their own work. Hostile to the aviation and travel photographs, which are bright and open. It is also its own cliché, and it makes text-heavy pages (About) unpleasant. Two grounds means two color-managed environments. |
| **Verdict** | Rejected as a site-wide direction. The lightbox is already dark and stays dark. That is the correct amount of dark. |

### Direction 3: "Wire" *(rejected, one element borrowed)*

Photo-desk editorial: a strong grotesque, dense grid, dateline-style metadata, captions
carrying real weight, images sized by their news value.

| | |
|---|---|
| **Strengths** | Excellent for sports storytelling. Captions become content. Variation in image scale is native to the form. |
| **Weaknesses** | Requires captions, and you write two per thirty-one photographs. Without them it collapses into a plain grid. Also risks looking like a news site template. |
| **Borrowed** | The **dateline**. Every gallery header reads `SAN JOSE · 14 JANUARY 2026` in tracked caps. It costs nothing, it is honest, and it does local SEO work. |

### 10.1 The selected system, specified

**Type.**

| Role | Family | Size | Weight / style | Tracking |
|---|---|---|---|---|
| Display (page title) | Newsreader | `clamp(2rem, 4.5vw, 3.25rem)` | 400 | `-0.015em` |
| Title (gallery name) | Newsreader | `clamp(1.375rem, 2.4vw, 1.75rem)` | 400 | `-0.01em` |
| Body | Newsreader | `1.0625rem` / 1.65 | 400 | 0 |
| Caption | Newsreader italic | `0.9375rem` / 1.5 | 400 | 0 |
| Label / nav / dateline | system sans | `0.8125rem` | 500, uppercase | `0.12em` |

Two families, one downloaded file. The sans is `ui-sans-serif, -apple-system, "Segoe UI",
Roboto, sans-serif` and it costs zero bytes. It is only ever used uppercase, tracked, at
13px or smaller, where cross-platform differences are invisible.

**Hard rule: the sans never appears above 13px and never appears in sentence case.** That
rule is what keeps a free system font from looking like a default.

Newsreader ships as a variable woff2 with an optical-size axis, is SIL OFL, and
self-hosts exactly the way Space Grotesk does today. One `@font-face`, one preload, no
build step. Space Grotesk's two woff2 files are deleted.

**Color.**

```css
--paper:      #FAFAF9;   /* ground. Neutral with a 1% warm cast, no more. */
--ink:        #121212;   /* text */
--ink-muted:  #6B6B68;   /* metadata, dateline, secondary */
--rule:       #E4E3DF;   /* hairlines */
--field:      #F1F0EE;   /* image placeholder before load */
```

No accent color. Links are `--ink` with a 1px underline at `0.22em` offset. The focus ring
is a 2px `--ink` outline at 3px offset. Active nav item is `--ink` while the others are
`--ink-muted`.

Removing the amber is deliberate. An accent hue at the image layer competes with the
photographs, and warm amber against warm cream was fighting the blue-white of ice and sky
in the two subjects you shoot most.

`color-scheme: light` only. No dark mode. A photography site with two grounds has two sets
of perceptual conditions for the same photograph. Pick one, make it neutral, and let the
lightbox be the dark room.

**Space.**

The rhythm carries the book feel, so the contrast between the two scales matters more than
the values.

```css
--gap-in-row:    4px;                        /* between photos in a justified row */
--gap-rows:      4px;                        /* between rows in a gallery */
--gap-stream:    clamp(3rem, 8vw, 7rem);     /* between compositions on the homepage */
--gap-section:   clamp(4rem, 10vw, 9rem);    /* between sections */
--measure:       62ch;                       /* prose */
--gutter:        clamp(0rem, 4vw, 3rem);     /* 0 on phones. Photographs touch the edge. */
--frame-max:     1680px;
```

`--gutter` resolving to `0` at small viewports is the single most valuable line in the
mobile design.

**Motion.** The complete specification:

```css
img { opacity: 0; transition: opacity 200ms ease; }
img.loaded { opacity: 1; }
@media (prefers-reduced-motion: reduce) { img { transition: none; } }
```

No transforms. No scale on hover. No brightness on hover. No scroll animation. No parallax.
No cross-fades. No entrance animations.

**Hover.** Photographs do not respond to hover. The cursor changes to a pointer. That is
the affordance. Text links underline.

---

## 11. Gallery design decisions

Direct answers to §11 of the brief.

| Question | Decision |
|---|---|
| Images per gallery | **Hockey game: 22–30.** It is a sequence and needs room to breathe. **Everything else: 8–15.** A three-photo gallery is fine. A three-photo *album called "Other"* is not. |
| Justified rows | **Yes, on desktop.** The existing flex implementation is correct and preserves curated order. Raise `flex-basis` from `ar * 240` to `ar * 460`. |
| Masonry | **No.** Masonry reorders reading sequence into columns, which is the exact bug ROADMAP finding #7 fixed. Do not reintroduce it. |
| Strict grid | **No.** Fixed aspect ratios crop your photographs to fit a container. |
| Full-screen presentation | **Only in the lightbox.** The page itself scrolls. |
| Opening frame | **Yes. The first photograph of every gallery renders full-bleed, up to 85vh.** This is a rendering rule, not a data field. It gives every gallery an opening without asking you for anything. |
| How images open | Click or tap opens PhotoSwipe. Keep it. |
| Captions | **Shown in the lightbox when present, and on the photo page.** Never in the grid. Two of thirty-one photographs have one, and a grid where 6% of items have text under them looks broken. |
| EXIF | **Removed from the lightbox. Retained in the catalog. Shown on the photo page, below the photograph.** This returns 200px of vertical space to every photograph on every slide. |
| Image titles | **No.** Filenames are not titles and you will not write real ones. |
| Keyboard navigation | **Yes.** PhotoSwipe provides arrows and Escape free. Keep. |
| Mobile behavior | **One photograph per row, edge to edge, in sequence.** No justified rows below 700px. Lightbox retained for pinch-zoom only. |
| Sharing | **Yes.** Keep the copy-link button. Point it at the static photo page (§20). |
| Individual photo URLs | **Yes, as static pages.** This fixes the missing-og:image bug and is how image search finds you. |
| Google-indexable | **Yes, everything except `/publish/`.** |

**On hockey sequence.** You raised warmup → faceoff → play → collision → goal →
celebration → bench → aftermath. That arc is real and it should absolutely shape a game
gallery. It is a Lightroom problem, not a website problem. Order the export, and the site
preserves the order. If you want explicit control, use a Lightroom filename template with
a sequence prefix (`001_`, `002_`) and alphabetical ordering does the rest. Do not build a
sequence editor.

**The one field I would defer, and name so you recognize it later.** A `full: true` flag
on a photograph, promoting it to a full-bleed break in the middle of a justified gallery.
It is the single thing that would make a game gallery read as a story rather than a
contact sheet. It is also a field you would set on maybe two photographs per gallery, and
the "first frame is full-bleed" rule already delivers 80% of the value for free. **Defer
it.** Build the gallery renderer so adding it later is a five-line change.

---

## 12. Wireframes

Desktop first, mobile behavior noted per page. `▓` is photograph, `·` is paper.

### 12.1 Homepage `/`

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │  ← 28px paper
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │  ← 13px caps, tracked
│                                                                        │     static, scrolls away
│  ────────────────────────────────────────────────────────────────────  │  ← 1px --rule
│                                                                        │
│  Photographs from the South Bay. Mostly hockey.                        │  ← Newsreader 17px
│                                                                        │     --ink-muted, one line
├────────────────────────────────────────────────────────────────────────┤  ← no rule here
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓  frame 01, full-bleed, max 85vh   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← in the HTML,
│▓▓▓▓▓▓▓▓▓▓▓▓▓  no text on it, no caption        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     fetchpriority=high
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                                        │
│                          ·  --gap-stream  ·                            │  ← 48–112px
│                                                                        │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
│  ▓▓▓▓▓▓ frame 02 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓ frame 03 ▓▓▓▓▓▓▓                │  ← justified row,
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │     ~520px tall
│                                                                        │
│                          ·  --gap-stream  ·                            │
│                                                                        │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ frame 04, full-bleed ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                                        │
│              …  frames 05–12, alternating rhythm  …                    │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  HOCKEY                                                                │  ← 13px caps
│  I photograph hockey around the South Bay. Youth, junior and adult      │  ← Newsreader 17px
│  league games in San Jose, Los Gatos and Fremont.                       │     max 62ch
│  See the hockey work →                                                 │  ← underlined link
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│              …  frames 13–32, same rhythm  …                           │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  RECENT GALLERIES                                                      │  ← 13px caps
│  ────────────────────────────────────────────────────────────────────  │
│  Jr. Sharks vs. Oakland Bears        San Jose      14 Jan 2026    28 → │  ← Newsreader 19px
│  ────────────────────────────────────────────────────────────────────  │     row height 64px
│  Winter Classic Tournament           Fremont       22 Dec 2025    31 → │
│  ────────────────────────────────────────────────────────────────────  │
│  USAF Thunderbirds                   Salinas       12 Oct 2025     4 → │
│  ────────────────────────────────────────────────────────────────────  │
│  All galleries →                                                       │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  Neil Kodner · Los Gatos, California                                   │
│  nkodner@gmail.com · Instagram · Feed                                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Content order and why.** The photograph comes before the sentence, and the sentence comes
before everything else. There is no hero, no name over an image, no category grid, and no
cover-tile strip. The single hockey interruption sits after roughly twelve frames, at the
point where a visitor has decided the work is worth their time. Putting it above that point
turns the homepage into a sales page. Putting it below the fold entirely means visitor C
never finds it.

**The gallery index is a typographic list, not a grid of tiles.** Cover tiles compete with
the photographs above them and they oblige you to choose a cover for every gallery. A
dated list reads as an index, which is what it is, and it looks correct with three rows.
Covers appear on `/galleries/`, where browsing is the job.

**Mobile.** Nav on one line at 12px (three items fit at 390px). Every frame full width, edge
to edge, stacked, no pairs. `--gap-stream` compresses to 48px. The gallery index rows go
two-line: title on top, `San Jose · 14 Jan 2026 · 28` beneath in 13px muted.

### 12.2 `/hockey/`

```
┌────────────────────────────────────────────────────────────────────────┐
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │
│  ────────────────────────────────────────────────────────────────────  │
├────────────────────────────────────────────────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓  one hockey frame. The best one. Full-bleed, 80vh.  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Hockey                                                                │  ← Newsreader 48px
│                                                                        │
│  I shoot hockey around the South Bay. Youth, junior and adult          │  ← 17px, 62ch
│  league, mostly in San Jose, Los Gatos and Fremont. Dark rinks,        │
│  fast glass, no flash.                                                 │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│     14–18 hockey photographs. Justified rows, ~500px.                  │
│     Deliberately mixed: action, a face, the bench, the crowd,          │
│     a detail, a celebration. Not eighteen action frames.               │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  WORKING WITH ME                                                       │  ← 13px caps
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  Game coverage      One or two periods, or the full game. Edited       │  ← two-column on
│                     gallery within 48 hours.                           │     desktop, stacked
│                                                                        │     on mobile.
│  Tournaments        Multi-day, with a separate gallery per team.       │     Newsreader 17px.
│                                                                        │     NO PRICES.
│  Team sessions      Portraits and the full roster, on or off ice.      │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  GAMES                                                                 │
│  ────────────────────────────────────────────────────────────────────  │
│  Jr. Sharks vs. Oakland Bears        San Jose      14 Jan 2026    28 → │
│  Winter Classic Tournament           Fremont       22 Dec 2025    31 → │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Get in touch                                                          │  ← Newsreader 28px
│  nkodner@gmail.com                                                     │  ← 19px, underlined
│  Los Gatos, California                                                 │  ← 13px caps muted
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**"Working with me" describes capability, not packages, and carries no prices.** Reasoning
in §14.3.

### 12.3 `/galleries/`

```
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  Galleries                                                             │  ← Newsreader 48px
│  Everything published, newest first.                                   │  ← 17px muted
│                                                                        │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │  ← covers at the
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │     cover's own
│  └────────────────────┘ └────────────────────┘ └────────────────────┘  │     aspect ratio,
│  Jr. Sharks vs.         Winter Classic         USAF Thunderbirds       │     not cropped
│  Oakland Bears                                                         │
│  SAN JOSE · 14 JAN 2026 FREMONT · 22 DEC 2025  SALINAS · 12 OCT 2025   │  ← 13px caps muted
│                                                                        │
│              …  three per row, continuing  …                           │
```

Three per row on desktop, two at tablet, **one per row on mobile with the cover full
width**. Covers keep their real aspect ratio. Rows align on the caption baseline, not on
image height. That is the one place a small amount of ragged edge is correct, because it
means no photograph got cropped to fit a box.

### 12.4 `/galleries/<slug>/`

```
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │
│  ────────────────────────────────────────────────────────────────────  │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← photo 1,
│▓▓▓▓▓▓▓▓▓  opening frame, full-bleed, max 85vh  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     always full-bleed
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                                        │
│  Jr. Sharks vs. Oakland Bears                                          │  ← Newsreader 40px
│  SAN JOSE · 14 JANUARY 2026 · 28 PHOTOGRAPHS                           │  ← 13px caps, the
│                                                                        │     borrowed dateline
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                     │
│  ▓▓▓ photo 2 ▓▓▓  ▓ photo 3 ▓  ▓▓▓▓ photo 4 ▓▓▓▓▓▓                     │  ← justified rows,
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                     │     4px gaps,
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                     │     ~460–520px tall
│  ▓▓▓▓▓▓ photo 5 ▓▓▓▓▓▓▓  ▓▓▓▓▓▓ photo 6 ▓▓▓▓▓▓▓▓                      │
│              …  through photo 28  …                                    │
│                                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│  ← Winter Classic Tournament            USAF Thunderbirds →            │  ← prev/next gallery
│                                                                        │     by date
```

**Mobile.** Every photograph full width, edge to edge, one per row, 4px between them. The
title and dateline sit between photo 1 and photo 2. No breadcrumb (the wordmark and the
prev/next links are enough).

### 12.5 `/galleries/<slug>/<stem>/`

```
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                 │  ← contained, max
│     ▓▓▓▓▓▓  the photograph. max 88vh, centered.  ▓▓▓▓                  │     88vh so it is
│     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                 │     whole on screen
│                                                                        │
│     Caption, when there is one.                                        │  ← Newsreader italic
│     FROM JR. SHARKS VS. OAKLAND BEARS · SAN JOSE · 14 JAN 2026 →       │  ← 13px caps, link
│                                                                        │
│     ← previous            back to gallery            next →            │
│                                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│     Sony α7 IV · 70–200mm f/2.8 · 135mm · f/2.8 · 1/1000s · ISO 6400   │  ← 13px muted,
│                                                                        │     BELOW the fold,
│     Photographs by Neil Kodner, Los Gatos, California.                 │     one line
│                                                                        │
```

This is where EXIF lives. One line, below the photograph, for the one visitor in fifty who
wants it. The "Photographs by Neil Kodner, Los Gatos, California" line is for visitor E
landing here from Google, and it is the local-SEO signal.

### 12.6 `/about/`

```
│  NEIL KODNER                             HOCKEY   GALLERIES   ABOUT    │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  ┌──────────────────────────┐                                          │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   Neil Kodner                            │  ← Newsreader 48px
│  │▓▓ an actual photograph ▓▓│                                          │
│  │▓▓ of you. rectangular. ▓▓│   I photograph hockey, aeroplanes and    │  ← 17px, 62ch
│  │▓▓ not a circle. not a  ▓▓│   whatever is in front of me, mostly     │
│  │▓▓ headshot. shot by a  ▓▓│   around Los Gatos and San Jose.         │
│  │▓▓ friend at a rink.    ▓▓│                                          │
│  └──────────────────────────┘   [ three or four short paragraphs ]     │
│                                                                        │
│                                 I take hockey assignments. Games,      │  ← the sentence that
│                                 tournaments, team sessions. Get in     │     replaces "no
│                                 touch and we'll work it out.           │     client work"
│                                                                        │
│                                 nkodner@gmail.com                      │
│                                 Instagram · LinkedIn                   │
│                                                                        │
```

Single column below 900px, photograph first. **Delete the empty circular avatar div.** An
empty circle is worse than nothing, and a circular crop of a person on a photography site
reads as a LinkedIn profile.

### 12.7 Future `/hockey/services/`

Not built now. Designed so it slots in without moving anything:

```
/hockey/                    unchanged, except "Working with me" becomes a link
/hockey/services/           rates, turnaround, what is included, FAQ, inquiry form
/hockey/<client>/           NOT THIS. Client galleries live off-site. See §14.4.
```

The trigger to build it: **the third paid booking**, not the first. Before that, the
answers are different every time and a page would be wrong more often than right.

---

## 13. The hero: what deleting it buys

This is the largest single deletion in the plan, so it gets its own section.

**What it is today.** A `100dvh` section, 23 curated hero images in `_hero/`, a
`_resized/hero/` derivative set at 2560px, orientation filtering so portrait frames do not
get used on landscape screens, a lazy one-ahead preload scheme, a two-second cross-fade, a
radial scrim at 42% opacity, your name at weight 700 with a three-layer text-shadow, and a
1.8-second entrance animation. Plus the `og:image` injection machinery in `build_seo.py`
that picks a hero and rewrites a marker block in `index.html` on every catalog build.

**Five reasons it goes.**

1. **It is the genre's most reproduced move.** Full-viewport photograph, photographer's
   name centered on top. It is the default in every Squarespace, Format and Pixieset
   photography template. It cannot make you memorable because it is what everyone does.
2. **It costs a full screen before any work is visible.** On a phone, the entire first
   viewport is one photograph you cannot read properly plus your name.
3. **Text on a photograph always damages the photograph.** The scrim and the three-layer
   shadow in `style.css` are evidence of this, not a solution to it. They are careful work
   spent partially undoing a self-inflicted problem.
4. **It is a parallel content set with its own pipeline.** 23 hero images against 31
   gallery images. `_hero/`, `_resized/hero/`, `make_hero()`, `HERO_LONG_EDGE`, orientation
   metadata, `hero.js`, and roughly 90 lines of CSS exist to serve a decoration.
5. **It is on the critical path for the wrong reason.** The homepage LCP today is a hero
   image fetched by JavaScript after `catalog.json` resolves. That is HTML → JS → fetch
   catalog → parse → fetch image → decode. Four hops before the first pixel of a
   photograph.

**What replaces it.** The first photograph in the edit, full-bleed, up to 85vh, with
nothing on top of it. Your name sits above it at 15px in the nav, and one sentence sits
above it at 17px.

**What that deletes, concretely:**

| Deleted | Approximate size |
|---|---|
| `js/hero.js` | 100 lines |
| Hero CSS block in `style.css` | ~95 lines |
| `make_hero()`, `HERO_LONG_EDGE`, `HERO_QUALITY` in `build_catalog.py` | ~30 lines |
| Hero handling in `parse_bucket()` and the `hero[]` catalog array | ~25 lines |
| `og_image_url()` / `update_og_image()` marker rewriting in `build_seo.py` | ~55 lines |
| `_hero/` and `_resized/hero/` in R2 | 46 objects |
| Hero entries in `catalog.json` | 23 records |

**What it gains.** The `og:image` for the homepage becomes the first portfolio photograph,
which is a one-line lookup rather than a marker-comment rewrite. The LCP image goes into
`index.html` as a real `<img>` with `fetchpriority="high"` and a matching
`<link rel="preload">`, both written by `build_seo.py` at build time. That takes the
homepage from four hops to one.

**Render the first screen statically. Hydrate the rest.** No framework required.
`build_seo.py` already writes into marker comments, which is exactly the mechanism.

---

## 14. Hockey and the commercial path

### 14.1 Positioning

You asked whether hockey should be prominent. **Yes, and it should be prominent for a
different reason than the one you gave.**

Your reason is that hockey is the commercial plan. That is a business reason, and business
reasons produce sales pages. The better reason: **hockey is your strongest and largest
body of work** (20 of 31 published photographs) **and hockey photography is visibly hard.**
Dark rink, mixed light, glass in the way, subjects moving at 20mph in unpredictable
directions. Anyone who has tried it knows. Anyone who has not can still tell the
difference between a sharp, well-lit, well-timed hockey frame and a blurry one.

That means the hockey page can be entirely photographs and still do commercial work.
Competence is legible in the pictures. It does not need to be asserted in copy.

If the hockey work were not your best work, promoting it would be a mistake regardless of
the business plan. Check that honestly before committing.

### 14.2 Structure

**One page: `/hockey/`.** Not a section, not a tree. Within it, no sub-organization by
team, player, event type or client. Games appear as a dated list, which is the only
organizing principle a game gallery needs, because a game is defined by who played and
when.

You asked whether hockey should be organized by sport, event, client/team, story, or a
hybrid. The answer at your scale is **event**, expressed as `title + date + venue`, and
that is not a schema decision. It is a gallery title. `Jr. Sharks vs. Oakland Bears, San
Jose, 14 January 2026` contains the team, the event and the location in one string a human
wrote.

When you have 40 hockey galleries and a parent asks "where are the Bears games", the answer
is a filter on `/hockey/`, added then, as a row of tracked-caps team names above the list.
That is a 20-line change to a page that already exists. Do not build it now.

### 14.3 Services and pricing: not yet, and here is why

You have photographed zero paid hockey games. A services page with rates, packages and an
inquiry form on a site with no client work reads as a business that has not started, and
that reads as inexperience. The credibility research is consistent on what a services page
needs to work: testimonials, named leagues or schools, published work, examples of how
galleries are delivered ([Format](https://www.format.com/magazine/resources/photography/photography-website-checklist),
[Zenfolio](https://zenfolio.com/sports-photography/best-portfolio-website-examples/)). You
have none of those yet, and a services page without them is a page arguing for itself.

**A hockey page with eighteen excellent frames, a plain description of what coverage looks
like, and an email address converts better than a pricing table.** The organizer's question
is "can this person shoot my tournament", and eighteen frames answer it.

The "Working with me" block in the §12.2 wireframe is the right amount: three lines
describing capability and turnaround, no numbers, no packages, no form. It tells the
organizer what to ask for. Pricing happens in the email, where it should, because your
first three jobs will be priced differently from each other while you find out what the
work actually costs you.

**Build `/hockey/services/` after the third booking.** By then you will know the answers.

### 14.4 Client delivery galleries: buy, do not build

This is the strongest architectural recommendation in the document.

When the first paid job arrives, the client needs a gallery. That gallery needs
password protection, per-athlete discovery (a parent finding number 14 among 400 frames),
watermarked previews, high-resolution download purchase, print fulfillment, and sales tax
handling. The research on youth sports sales platforms describes exactly this set
([Lenzeit](https://www.lenzeit.com/blog/best-sports-photo-sales-software-youth-sports-photographers)),
and it is a different product from a portfolio in every respect.

**Do not build any of it on this site.** Not on GitHub Pages, not in a Worker, not in R2.
It would be months of work to reproduce a product that costs $96 to $240 a year, and it
would drag a database, a payment processor, an auth system with real accounts, and tax
compliance into a static site whose entire virtue is that it has none of those things.

Pixieset, CloudSpot and PhotoShelter all do this. Brad Mangin, a Bay Area sports
photographer with a 75,000-image archive, keeps his portfolio and his sales archive on two
separate systems for the same reason.

**The integration is one link.** `/hockey/` gets a line reading "Client galleries →"
pointing at your Pixieset subdomain. That is the whole integration, and it means the
commercial machinery can arrive in an afternoon whenever it is needed, with zero changes to
the architecture designed here.

### 14.5 The funnel

```
Instagram post ─┐
Google search ──┼──► /  or  /hockey/  ──► look at photographs ──► email
Word of mouth ──┘                                                   │
                                                                    ▼
                                             (later)  Pixieset client gallery
```

Two steps. No form, no funnel page, no lead magnet, no "book now" button. For a
one-person operation at this stage an email address converts better than a form, and a
form on a static site needs a backend you do not otherwise need.

The architecture supports growing this without moving anything: `/hockey/services/` slots
in beneath `/hockey/`, and client galleries live off-site behind one link.

---

## 15. Content model

### 15.1 The shape

The catalog splits into an index plus one file per gallery. Reasoning in §18.

**`index.json`**, fetched by the homepage, `/galleries/` and `/hockey/`.

```json
{
  "base": "https://img.neilkodner.com",
  "galleries": [
    {
      "slug": "jr-sharks-vs-oakland-bears-2026-01-14",
      "title": "Jr. Sharks vs. Oakland Bears",
      "date": "2026-01-14",
      "subject": "hockey",
      "venue": "San Jose",
      "cover": "jr-sharks-vs-oakland-bears-2026-01-14/DSC04243.jpg",
      "count": 28
    }
  ],
  "portfolio": [
    {
      "src": "jr-sharks-vs-oakland-bears-2026-01-14/DSC04243.jpg",
      "w": 3000, "h": 2000,
      "sizes": [ { "w": 1200, "path": "_r/1200/…" }, { "w": 2400, "path": "_r/2400/…" } ],
      "alt": "A Jr. Sharks forward turns behind the net."
    }
  ]
}
```

**`galleries/<slug>.json`**, fetched only by that gallery's page.

```json
{
  "slug": "jr-sharks-vs-oakland-bears-2026-01-14",
  "title": "Jr. Sharks vs. Oakland Bears",
  "date": "2026-01-14",
  "subject": "hockey",
  "venue": "San Jose",
  "note": "",
  "photos": [
    {
      "file": "DSC04243.jpg",
      "w": 3000, "h": 2000,
      "caption": "",
      "portfolio": true,
      "sizes": [ { "w": 1200, "path": "…" }, { "w": 2400, "path": "…" } ],
      "exif": { "camera": "…", "lens": "…", "focal_length": "…",
                "aperture": "…", "shutter_speed": "…", "iso": "…" }
    }
  ]
}
```

### 15.2 Field classification

| Field | Class | Notes |
|---|---|---|
| `slug` | **Required, derived** | From title + date. Never typed. |
| `title` | **Required, typed** | The only thing you have to type. |
| `date` | **Required, automatic** | From EXIF `DateTimeOriginal` of the first photograph. |
| `photos[].file` | **Required, automatic** | |
| `photos[].w/h` | **Required, automatic, internal** | Layout reservation. |
| `subject` | Optional, one tap | A tag. Drives which page a gallery appears on. **Not a container, not a URL, not a page.** |
| `venue` | Optional, remembered | From IPTC Sublocation/City if present, otherwise remembered per subject. Feeds the dateline and local SEO. |
| `cover` | Optional, defaulted | Defaults to the first `portfolio` photo, else photo 1. One tap to override. |
| `note` | Optional, rarely used | One or two sentences under the gallery title. Expect it empty. |
| `photos[].caption` | Optional | From IPTC `Caption-Abstract` / XMP `dc:description`. Expect most empty. That is fine. |
| `photos[].portfolio` | **Optional, the important one** | From XMP star rating. Lifts a photograph into the homepage edit. |
| `photos[].sizes[]` | Internal | The srcset contract. Unchanged from today. |
| `photos[].exif` | **Internal, shown only on the photo page** | |
| `published` | Internal | Replaces the `_draft-` prefix. |

**Public metadata** (what a visitor ever sees): gallery title, date, venue, photo caption,
gallery note, and EXIF on the photo page. Six things, four of which are usually empty.

**Internal metadata**: everything else. The catalog stays as rich as it is. The interface
stops exposing it. That is §14 of your brief, answered: the backend is flexible and the
website is simple.

### 15.3 What is removed from today's model, and why

| Removed | Reason |
|---|---|
| `categories[]` as a container with its own page, cover, and URL | Three containers for five galleries. Becomes a `subject` string on the gallery. |
| `flat` boolean | Models "a category I did not want to name a gallery inside". Naming is a text field now, so the case disappears. |
| `album` as a distinct concept from category | There is one container: the gallery. |
| `location` as a first-class album field | Empty in 5 of 5. Becomes optional `venue`, auto-filled. |
| `hero[]` | See §13. |
| `_draft-` folder prefix | Publishing by renaming an R2 key rewrites every derived key and would break permalinks. A `published` flag does not. |
| `featured` (proposed, never built) | Nothing needs it. See §8. |

### 15.4 Fields deliberately not added

You asked me not to create fields because they might someday be useful, so here is the
list I considered and rejected, with the trigger that would change my mind.

| Not added | Would add when |
|---|---|
| `full: true` on a photograph (full-bleed break mid-gallery) | You have shipped six game galleries and the contact-sheet feel bothers you. Five-line renderer change. |
| `tags[]` on photographs | You want cross-gallery collections ("all goal celebrations"). Needs 500+ photographs first. |
| `team`, `player`, `jersey` | A paying client asks. And when they do, the answer is Pixieset, not a schema change. |
| `client`, `private`, `password` | Never on this site. See §14.4. |
| `order` on photographs | Array order is order. Lightroom is the sequencing tool. |
| `series` / `project` grouping above gallery | You have a body of work spanning multiple shoots that reads as one thing. Realistically years away. |

---

## 16. Publishing workflow

The `ARCHITECTURE_REVIEW.md` diagnosis is right and its Phase 1 + Phase 2 design (a
password-gated `/upload/` page, a Worker doing auth and presigning, the browser generating
derivatives and parsing EXIF, direct browser-to-R2 uploads, `repository_dispatch` to cut
latency) is the correct mechanism. `IMPLEMENTATION.md` has the details. **Do not redesign
that.** This section covers only what the new content model changes about it, plus the one
idea I would add.

### 16.1 The ideal session, step by step

You photographed a Jr. Sharks game this afternoon. You are home. You have 25 keepers.

| Step | What you do | What happens |
|---|---|---|
| 1 | In Lightroom Classic, star your best five **as you always do** | Nothing site-related |
| 2 | Export with the existing preset (JPEG q90, 3000px, all metadata) | ~25 files on disk |
| 3 | Open `neilkodner.com/publish/` | Already signed in, 30-day cookie |
| 4 | Add photographs, pick all 25 | They appear in the same justified grid the gallery will use. Date pre-fills from EXIF. Five of them already show a portfolio dot, read from the XMP rating. |
| 5 | Type `Jr. Sharks vs. Oakland Bears` | Slug renders live: `jr-sharks-vs-oakland-bears-2026-01-14` |
| 6 | Tap `Hockey` in a row of subject chips | `subject: "hockey"` |
| 7 | Tap one frame to set the cover (optional, it already defaulted) | Small dot moves |
| 8 | Publish | Browser resizes to 2400px + an 800px WebP thumb in a Web Worker, uploads direct to R2 via presigned PUTs at concurrency 3, posts the gallery JSON to the Worker, Worker fires `repository_dispatch` |
| 9 | Wait ~60–90 seconds | The page shows the live URL, tappable |

**Total typed characters: about 30.** Everything else is a tap or automatic.

### 16.2 The one idea I would add: curate where you already curate

The architecture review's central insight is that asking for the date at the moment of
upload is what makes the date get filled in. Apply the same logic to curation.

**You already rate photographs in Lightroom.** With "All Metadata" enabled on export,
Lightroom Classic writes `xmp:Rating` into the JPEG. The upload page parses XMP alongside
EXIF and sets `portfolio: true` on anything rated 5 (or 4+, your threshold), with a manual
override by tapping.

That means the homepage edit maintains itself out of a habit you already have, at the
moment of maximum context, using an interface you already like. Zero additional taps.

**Verify this before relying on it**, the same way the review says to spike HEIC first: one
5-star photograph, exported with the real preset, checked for `xmp:Rating` in the file. Ten
minutes. If Lightroom does not carry the rating through, fall back to tapping frames on the
upload page, which is the design you would have had anyway.

### 16.3 The nine operations you listed

The publish page has two modes on one screen: **new gallery** and **existing gallery**. The
existing mode is the same form with the photographs staged from `galleries/<slug>.json`
instead of from a file picker. That single decision covers all nine.

| Operation | How | Phase |
|---|---|---|
| Add photographs to an existing gallery | Open the gallery, add files, publish | 1 |
| Correct a caption | Open the gallery, tap a photograph, edit the caption field | 2 |
| Change a cover | Open the gallery, tap a photograph | 1 |
| Unpublish a gallery | Toggle `published` off | 1 |
| Delete a photograph | Tap, confirm. Worker deletes the R2 keys. Lightroom holds the master. | 2 |
| Change a gallery title | Edit the field. **Slug does not change.** A stub redirect is not needed because the URL never moved. | 1 |
| Rearrange photographs | **Not supported in phase 1.** Re-export from Lightroom with a sequence prefix. Drag-reorder arrives in phase 2 on desktop only. | 2 |
| Mark a gallery featured | Not a thing. See §8. | — |
| Mark a photograph portfolio-worthy | Tap it. Or star it in Lightroom before export. | 1 |

**Slug is immutable once published.** Titles change freely, slugs never do. That is what
keeps permalinks and search results valid forever, and it costs nothing because nobody
reads slugs.

### 16.4 Mobile

Build the publish page responsive, because it costs nothing and the layout is a single
column of a grid and a form. Do not contort the design around the phone. Reasoning in §26,
item 8.

The one case where mobile publishing genuinely matters is the hockey business: a gallery
posted from the rink parking lot two hours after a game is a real competitive advantage
against a 48-hour turnaround. Build for that case specifically, and accept that the
portfolio edit happens at a desk.

---

## 17. Lightroom

Photography starts in Lightroom, so the site should take as much as it can from what you
already do there and ask for nothing else.

| Lightroom field | Written to | Becomes | Typing saved |
|---|---|---|---|
| Capture time | EXIF `DateTimeOriginal` | Gallery `date`, slug suffix | The date field |
| Star rating | XMP `xmp:Rating` | `photos[].portfolio` | The entire curation pass |
| Caption | IPTC `Caption-Abstract` / XMP `dc:description` | `photos[].caption` | Captions, when you write them |
| Sublocation / City | IPTC | `venue` | The venue field |
| Keywords | IPTC | Pre-selects `subject` | One tap |
| Orientation, dimensions | EXIF | `w`, `h` | — |
| Camera, lens, exposure | EXIF | `exif{}` (internal, photo page only) | — |
| Filename sequence | — | Gallery order | The whole reordering problem |

**Two Lightroom-side habits worth adopting, both one-time setup:**

1. **A metadata preset per rink.** "Tech CU Arena", "Sharks Ice", "Solar4America". Applied
   on import, it fills Sublocation, and the venue field on the site fills itself. This is
   also your local-SEO input (§20), arriving for free.
2. **An export filename template with a sequence number** (`{sequence#001}_{filename}`)
   for game galleries where the arc matters. Alphabetical ordering then reproduces your
   Lightroom sequence exactly, and the site never needs a reordering UI.

`build_catalog.py`'s `extract_caption()` already handles the iOS Photos `x-default`
corruption and Lightroom Mobile's `dc:description`. That is careful work, it is exactly the
right kind of work, and it should be preserved verbatim through any rewrite.

**Keep "Remove Location Info" enabled on export.** `check_gps.py` exists to audit this and
should stay.

---

## 18. Technical architecture

The product direction is settled, so here is the stack that serves it. Short version:
**keep almost everything, change the shape of one file, add one Worker, delete a pipeline.**

### 18.1 The stack

| Layer | Choice | Verdict |
|---|---|---|
| Hosting | GitHub Pages | **Keep.** Free, no build step, works if Cloudflare is down. |
| Storage | Cloudflare R2 | **Keep.** Zero egress is why this whole design is affordable. |
| CDN | `img.neilkodner.com` via Cloudflare | **Add.** Now a prerequisite, not a tidy-up. See §19.3. |
| Catalog | `index.json` + `galleries/<slug>.json`, generated | **Rewrite the shape, keep the mechanism.** |
| Catalog build | Python + boto3 + Pillow in GitHub Actions | **Keep, simplify.** |
| Static page generation | `build_seo.py` | **Keep and extend.** It already solves the hard part. |
| Frontend | Static HTML, vanilla ES modules, plain CSS | **Keep.** |
| Lightbox | PhotoSwipe v5, vendored | **Keep, simplify.** |
| Fonts | Self-hosted woff2 | **Keep the mechanism, change the font.** |
| Publish API | Cloudflare Worker | **Add.** ~200 lines, per `IMPLEMENTATION.md`. |
| Analytics | Cloudflare Web Analytics | **Add** (§23). |
| Client delivery | Pixieset or CloudSpot | **Buy** (§14.4). |

### 18.2 What is explicitly rejected

| Rejected | Why |
|---|---|
| **React / Next / Astro / any framework** | The whole site is five page templates. A framework's build step costs more than it saves for a solo maintainer returning after six weeks. `CLAUDE.md` names "no build step" as a property of this project and it is the right property. |
| **A bundler** | Four ES modules loaded natively. Nothing to bundle. |
| **Tailwind** | The design has one type family, five colors and six spacing values. A utility framework would be larger than the CSS it replaces. |
| **D1 or any database** | `ARCHITECTURE_REVIEW.md` §4D rejects it correctly. §18.4 below states the condition that would change the answer. |
| **A CMS** | The publish page is the CMS. It has one content type. |
| **A contact form backend** | An email address converts better and costs nothing. |
| **Client-side password checks** | `ARCHITECTURE_REVIEW.md` §6 settles this and is right. |

### 18.3 The one structural change: split the catalog

Today `catalog.json` is 28KB for 31 photographs and it is blocking-fetched by `app.js`
before anything renders. That is about 900 bytes per photograph, on every page.

| Photographs | `catalog.json` today | Consequence |
|---|---|---|
| 31 | 28 KB | Fine |
| 100 | ~90 KB | Fine |
| 1,000 | ~900 KB | **Broken.** Nearly a megabyte of JSON before the first pixel, on every page. |
| 5,000 | ~4.5 MB | Unusable |

The fix is cheap and should happen now, while there are five galleries, rather than at
two hundred:

```
index.json               galleries[] metadata + portfolio[] photos     ~200 B / gallery
                                                                       + ~400 B / portfolio photo
galleries/<slug>.json    that gallery's photos only                    ~700 B / photo
```

At 1,000 galleries (roughly 25,000 photographs) `index.json` is about 200KB plus the
portfolio block, which is capped at 36 entries by design. **The ceiling disappears
permanently**, and a gallery page fetches exactly one gallery.

It is roughly 40 lines of Python and a small change to the three frontend fetch sites. It
is the cheapest permanent fix in this document.

### 18.4 Where this architecture stops working

| Trigger | Response |
|---|---|
| 10,000+ photographs **and** you want cross-gallery search | Move the catalog to D1 behind the Worker. The frontend keeps reading JSON, the Worker generates it. |
| A second person publishes | Real accounts replace the shared password. Worker + KV, still no database. |
| Client galleries with purchase | **Do not change this architecture.** Buy Pixieset. |
| Video | Different problem, different storage economics, revisit from scratch. |
| Static file count above ~20,000 | Only matters if you move to Cloudflare Pages, which caps there. GitHub Pages does not. At 25 photos per gallery, 20,000 files is ~800 galleries. |

None of these are close. Do not build for any of them.

---

## 19. Image architecture, performance, and where I disagree with the prior documents

### 19.1 The strategy by scale

| Scale | Derivatives | Catalog | Storage | Cost |
|---|---|---|---|---|
| **100 photos** | Browser-generated at upload: 800px WebP thumb + 2400px JPEG. Pillow stays as the fallback for bulk uploads. | `index.json` + per-gallery | ~0.15 GB | $0 |
| **1,000 photos** | Same, plus `format=auto` edge transforms for AVIF | Same, unchanged | ~1.5 GB | $0 |
| **5,000 photos** | Edge transforms only. Retire stored derivatives and delete `_thumbs/`, `_r/`. | Same | ~7 GB | ~$0–5/mo (transform overage) |
| **10,000+ photos** | Edge transforms. Consider event-driven catalog updates instead of a full bucket listing on every run. | Consider D1 | ~15 GB | ~$5–10/mo |

**Full-resolution originals: do not store them.** This answers open question 3 in the
architecture review, and it agrees with its default. Lightroom is the archive of record.
Originals are the only line item in the entire system that ever costs money, and the site
tops out at 2400px, so a stored original is a file nobody ever fetches. If a paying client
ever needs a print file, you export it from Lightroom that day.

**Formats.** WebP thumbs and JPEG large from the browser, because Safari cannot encode
AVIF in a canvas. AVIF arrives from Cloudflare's `format=auto` once the zone is migrated,
which is the right place for it: no encoder to maintain, no storage, no fallback logic.

**Sizes.** The largest derivative moves from 2000px to **2400px** because the redesign
displays photographs much larger. A full-bleed frame on a 1440px logical viewport at 2×
DPR wants ~2400px. Keep 1200px as the middle step. Both feed the existing `sizes[]` array
and `buildPswpSrcset()` needs no change.

**Loading discipline** (mostly already correct, keep it):

- First photograph: in the HTML, `fetchpriority="high"`, matching `<link rel="preload">`.
- Everything else: `loading="lazy"`, `decoding="async"`.
- `aspect-ratio` on every `<img>` from `w`/`h` so nothing shifts. Already done.
- `preconnect` to the image host. Already done, update the hostname after the DNS move.

### 19.2 What the redesign costs in bytes

Being honest about this: **the redesign increases per-page image bytes substantially.**
Today's grid rows are 240–320px tall and thumbnails are 800px WebP. The new design shows
full-bleed frames and 460–520px rows, which at 2× DPR means 1600–2400px JPEGs.

A full-bleed 2400px JPEG at q82 is roughly 600KB to 1MB. The homepage's first paint pulls
one of them.

### 19.3 The disagreement: DNS is now a prerequisite

`ARCHITECTURE_REVIEW.md` §5 says: *"C, when you're ready to touch DNS. The wins are real
but they're all performance and tidiness, none of them are workflow. Do it deliberately on
a weekend, not as a dependency of anything."*

That was correct for the site as it exists. It is not correct for the site this document
describes.

Images are currently served from `pub-….r2.dev`, which Cloudflare rate-limits and excludes
from edge caching by design. The review verified no `cf-cache-status` header on any object,
meaning every visitor pulls every byte from origin. At 800px thumbnails that is a mild
performance problem on a site with no traffic. **At a 1MB full-bleed LCP image from an
uncached origin, it is a two-to-four second first paint on LTE**, on a site whose entire
proposition is that the first photograph appears immediately.

**Recommendation: the nameserver migration to Cloudflare moves ahead of the visual
redesign.** It is Neil-only work (a coding session cannot do it), it takes a scheduled
window, and it should run in parallel with the early implementation phases so it lands
before anything visual ships. See the two-track roadmap in §28.

The review is right that the roadmap mislabels it. `ROADMAP.md` Phase 2 calls it "one
dashboard step". The zone is on Namecheap nameservers pointing at GitHub Pages, so an R2
custom domain requires moving the nameservers first. **Check MX and TXT/SPF records before
touching anything.** Calling it "migrate nameservers, verify mail, cut over" is probably
the difference between it shipping and not.

### 19.4 The other disagreement: catalog shape

The review says *"any proposal that changes the content model is solving the wrong thing"*
(§3.4) and it is right about the *semantics* of the model, which are well designed. §18.3
changes the *file layout*, not the semantics: the same records, split across files. That
is a different claim and it does not contradict the review. Stated here so the two
documents are not read as being in conflict.

---

## 20. SEO

Photography and user experience come first, so most of this is free consequences of design
decisions already made.

### 20.1 Realistic targets

Per §4.1, the generic local terms are held by twenty-year incumbents. Setting expectations
honestly:

| Query | Winnable | When |
|---|---|---|
| `neil kodner photography`, `neil kodner hockey` | **Yes, trivially** | Immediately. And this is the query that matters, because it is what someone types after a referral. |
| `jr sharks vs oakland bears photos`, `<team> hockey photos 2026`, `<rink name> hockey photos` | **Yes** | Per gallery, within weeks. Nobody targets these. |
| Image search on individual photographs | **Yes** | Gradually, and this is how strangers actually find photographers. |
| `hockey photographer san jose` | **No, not for years** | Requires domain age, citations, reviews and volume you do not have. |
| `sports photographer san jose` | **No** | Broader and more contested. |

### 20.2 The whole plan

**1. Name galleries after real events.** `Jr. Sharks vs. Oakland Bears, San Jose, 14
January 2026` beats `Select Images` by an enormous margin. It costs nothing, because the
publish form asks for a title anyway. **This is the entire SEO strategy.** Everything below
is supporting detail.

**2. Static pages for everything.** Galleries and individual photographs get real HTML
with real `<title>`, `<meta name="description">`, `<link rel="canonical">` and og tags,
generated by `build_seo.py`. It already does this for galleries. Extend it to photographs.

**3. Structured data.**

| Page | Schema |
|---|---|
| `/` | `Person` + `ImageGallery` |
| `/hockey/` | `ProfessionalService` with `areaServed` covering San Jose, Los Gatos, Fremont, Santa Clara County. **Use `areaServed`, not a street address.** Do not invent a storefront. |
| `/galleries/<slug>/` | `ImageGallery`, plus `SportsEvent` when `subject == "hockey"` |
| `/galleries/<slug>/<stem>/` | `ImageObject` with `contentUrl`, `creator`, `dateCreated`, `contentLocation` |
| `/about/` | `Person` with `sameAs` to Instagram and LinkedIn |

**4. Semantic HTML.** One `<h1>` per page matching the title. `<figure>`/`<figcaption>`
for captioned photographs. `<time datetime>` on dates. `<nav>`, `<main>`, `<footer>`.
Mostly already correct.

**5. Alt text.** Caption when present, otherwise `"<gallery title>, photograph N"`. The
current fallback in `gallery.js` is already this and it is the right compromise. Do not
generate elaborate fake alt text.

**6. Sitemap.** Already generated with image entries. Extend to photo pages. Keep
`/publish/` out of it and `noindex` on it.

**7. The identity line on every photo page.** "Photographs by Neil Kodner, Los Gatos,
California." One line, in the HTML, on every one of what will eventually be thousands of
pages. That is the local signal, and it is honest because it is true.

**What not to do:** no `hockey-photographer-san-jose` landing page, no location-permutation
pages, no keyword-stuffed alt text, no blog written for search engines. You said not to
build an SEO farm and the advice is to hold that line, because the returns on those tactics
against established local incumbents are close to zero anyway.

---

## 21. Social sharing

The relationship you want is: **Instagram distributes, the website is canonical.** That
works if two things are true.

**1. Every shared link renders a preview.** This is currently broken for individual
photographs (§3.3) and it is broken on the exact path your plan depends on. Every page
gets static og tags with a real absolute `og:image`:

| Page | `og:image` |
|---|---|
| `/` | First portfolio photograph, 1200px derivative |
| `/hockey/` | The opening hockey frame |
| `/galleries/<slug>/` | The gallery cover, 1200px |
| `/galleries/<slug>/<stem>/` | **That photograph** |
| `/about/` | Your portrait |

Use the 1200px derivative rather than the original. Some scrapers cap at a few megabytes
and silently drop anything larger, which is a second reason preview images fail.

**2. The URL is short enough to paste in an Instagram bio.**
`neilkodner.com/galleries/jr-sharks-vs-oakland-bears-2026-01-14/` is long but readable and
self-describing, which matters more in an iMessage than in a bio. For the bio, use
`neilkodner.com`.

**The loop, concretely:**

```
Shoot game  →  publish gallery  →  post 3 frames to Instagram
                                    caption ends: "Full gallery at neilkodner.com"
                                    →  visitor lands on the gallery
                                    →  scrolls 28 photographs
                                    →  clicks the wordmark
                                    →  sees the edit
```

Instagram gets volume. The site gets the edit. Do not try to match Instagram's cadence on
the site. Reasoning in §26, item 4.

**Keep the copy-link button** in the lightbox and point it at the static photo page rather
than at the current `/photo/?cat=&album=&photo=` query URL. Same gesture, working preview,
better URL.

---

## 22. Mobile

Assume more than half of visitors arrive on an iPhone, and that the hockey organizer is one
of them, standing in a rink lobby.

| Element | Decision |
|---|---|
| **Navigation** | Three links plus the wordmark, one line, 12px tracked caps. Fits at 390px. **No hamburger, ever.** A hamburger for three links is a tap tax that hides the one thing (`HOCKEY`) a commercial visitor is looking for. |
| **Nav position** | **Static, scrolls away.** The current fixed frosted nav takes 64px of every screen permanently and blurs the photograph passing behind it. |
| **Photographs** | **Edge to edge.** `--gutter` resolves to `0` below 700px. This is the single biggest mobile improvement available. |
| **Gallery layout** | One photograph per row. No justified rows below 700px. |
| **Homepage stream** | One per row, `--gap-stream` compressed to 48px. |
| **Type** | Body 17px. Labels 13px, not 12px, because 12px tracked caps on a phone is at the legibility floor. |
| **Touch targets** | Gallery index rows 64px tall. Links in prose get 12px of vertical padding. |
| **Lightbox** | Retained, primarily for pinch-zoom. Photographs are already full width in the page, so tapping is a detail gesture rather than a size gesture. |
| **Loading** | First photograph preloaded and in the HTML. Everything else lazy. |
| **Orientation** | Portrait frames get `max-height: 85vh` so they never exceed one screen. Landscape frames run full width. |
| **Bandwidth** | The 1200px derivative serves most phones. srcset picks it. |
| **Hover** | Already correctly gated behind `@media (hover: hover)`. Keep that discipline. |
| **Publishing** | Responsive, one column. See §16.4. |

**The mobile homepage, top to bottom:** nav (44px), one sentence (28px), photograph
(85vh). A visitor sees a real photograph at real size within the first screen and a half,
with no slideshow, no name overlay and no tiles.

---

## 23. Analytics

**Recommendation: Cloudflare Web Analytics. One script tag, free, no cookies, no consent
banner, no personal data.**

It arrives free once the zone moves to Cloudflare, which §19.3 makes a prerequisite anyway.

Three questions worth answering and nothing more:

1. Is anyone visiting?
2. Where did they come from (Instagram, Google, direct)?
3. Which galleries get looked at?

**Not Google Analytics.** It needs a consent banner in practice, adds around 45KB to a site
whose entire design is about the first photograph appearing fast, and gives you session
data you have no use for. A consent banner over your homepage photograph would undo a
meaningful share of this redesign.

Nothing at all is also a defensible answer. It is your site.

---

## 24. What I would remove

Ranked by value of removal.

| # | Remove | Why |
|---|---|---|
| 1 | **The hero slideshow**, `_hero/`, `_resized/hero/`, `hero.js`, hero CSS, `make_hero()`, `HERO_LONG_EDGE`, orientation filtering, the og:image marker rewriting | A screen of decoration before any work. 23 hero images against 31 gallery images. Requires a scrim and a three-layer text-shadow to undo damage it causes. Full detail in §13. |
| 2 | **Categories as a navigable layer**: `/photography/`, `?cat=`, category tiles, category covers, `renderCategoryGrid()` | Three containers for five galleries. Two clicks between the visitor and a photograph, both spent choosing a box. |
| 3 | **The `flat` boolean** | Models "a category I did not want to name a gallery inside". The publish form makes naming free. |
| 4 | **The lightbox EXIF panel** | Steals 200px from every photograph on every slide to tell most visitors nothing. Data stays in the catalog, moves to the photo page. |
| 5 | **`/photo/?cat=&album=&photo=` query permalinks** | Ugly to share, and the og:image is set by JavaScript, so every shared link has a blank preview today. Replaced by static pages. |
| 6 | **The fixed frosted-glass nav** | 64px of permanent occlusion plus a 12px blur smearing whatever photograph passes behind it. |
| 7 | **Hover `scale(1.02)` and `brightness(1.15)` on every tile** | Non-integer scaling resamples the image and makes it momentarily soft. Brightening by 15% shows a misrepresentation of your edit. |
| 8 | **The amber accent** (`#C9963A`) on hover borders and active nav | Introduces a saturated warm hue at the image layer. Compounded by the warm cream ground against blue-white ice and sky. |
| 9 | **The warm cream ground** (`#F6F3EE`) | Simultaneous contrast shifts the perceived color of every photograph. Neutral is why galleries use neutral. |
| 10 | **Space Grotesk** | Wrong voice, strong tech-brand association, and doing all six type roles alone leaves the system with no tonal range. |
| 11 | **"Photography by Neil Kodner"** as the wordmark, and the **"NK" amber monogram** | A wordmark that explains itself has lost. The monogram solves a problem the long wordmark created. |
| 12 | **"No prints for sale, no client work"** on the About page | Explicitly closes the door the redesign opens. |
| 13 | **The empty circular avatar div** on About | An empty circle is worse than nothing, and a circular crop reads as a LinkedIn profile. |
| 14 | **`location` as a first-class album field** | Empty in 5 of 5. Becomes optional `venue`, auto-filled from IPTC. |
| 15 | **The `_draft-` folder prefix** | Publishing by renaming an R2 key rewrites every derived key. A `published` flag does not. |
| 16 | **A `featured` flag** (proposed, never built) | `/galleries/` is chronological and the homepage is the edit. Nothing needs featuring on top of that. |
| 17 | **Full-resolution originals in R2** | The only line item that ever costs money, for files the site never serves. |
| 18 | **`album.html`** redirect shim | Serves URLs nobody bookmarked. The pretty URLs shipped months ago. |
| 19 | **The 6-hour cron** | Exists only to suppress the churn bug. Replaced by `repository_dispatch`. |
| 20 | **Album cover tiles on the homepage** | Cover tiles compete with the photographs above them and oblige you to pick a cover for every gallery. A dated list is the honest form for an index. |
| 21 | **`prompts/` in the repository root** (20 files, 104KB) | A build log of how the site was made, not documentation of what it is. It is the largest directory in the repo. Move it to `docs/history/` or a branch if you want to keep it. |

**What I am explicitly not removing**, because it earns its place: the justified-row grid,
`aspect-ratio` reservation, lazy loading discipline, the `thumb_key_for()` derived-key
contract, incremental catalog builds preserving hand-edited captions, `extract_caption()`'s
iOS and Lightroom Mobile handling, self-hosted fonts and PhotoSwipe, `print.css`, the
skip-link, the `@media (hover: hover)` gating, `check_gps.py`, and the Atom feed.

---

## 25. Subsystem verdicts

Every major existing subsystem, classified.

### Infrastructure

| Subsystem | Verdict | Reason |
|---|---|---|
| Cloudflare R2 storage | **KEEP** | Zero egress. The economics of this entire design depend on it. |
| GitHub Pages hosting | **KEEP** | Free, no build step, survives a Cloudflare outage. |
| GitHub Actions catalog build | **KEEP, SIMPLIFY** | Add `repository_dispatch`, fix the churn guard, drop or lengthen the cron. |
| `scripts/upload-to-r2.sh` (rclone) | **KEEP** | The Worker does not replace rclone for a 500-photograph backfill. |
| `scripts/check_gps.py` | **KEEP** | On-demand, correct privacy hygiene, costs nothing. |
| Namecheap DNS → GitHub Pages | **REWRITE** | Migrate nameservers to Cloudflare. Prerequisite, see §19.3. |
| `pub-….r2.dev` image origin | **REWRITE** | → `img.neilkodner.com` with a cache rule. |
| Cloudflare Worker publish API | **ADD** | ~200 lines, per `IMPLEMENTATION.md`. |
| Cloudflare Images transformations | **DEFER** | After the DNS move. Optional. Gets you AVIF. |
| D1 / any database | **REJECT** | Revisit at 10,000 photographs plus a search requirement. |
| Client delivery platform | **DEFER, then BUY** | Pixieset or CloudSpot. Never build. §14.4. |

### Catalog pipeline

| Subsystem | Verdict | Reason |
|---|---|---|
| Bucket scan + incremental merge in `build_catalog.py` | **KEEP** | Preserving hand-edited captions across rebuilds is careful, correct work. |
| `thumb_key_for()` derived-key contract | **KEEP** | Mirrored on both sides with the contract written down in both files. The best-engineered thing in the repository. |
| `ensure_resized_variants()` fast path | **KEEP** | Carries `sizes[]` forward without re-downloading. Enables browser-generated derivatives with no change. |
| `extract_exif()` / `extract_caption()` | **KEEP verbatim** | The iOS `x-default` and Lightroom Mobile `dc:description` handling is hard-won. Preserve it through any rewrite. |
| `make_thumbnail()` / `make_resized()` | **KEEP, RETUNE** | Largest variant 2000px → 2400px. |
| `make_hero()` / hero pipeline | **REMOVE** | §13. |
| `catalog.json` monolith | **REWRITE** | → `index.json` + `galleries/<slug>.json`. §18.3. |
| Category / album / `flat` parsing in `parse_bucket()` | **REWRITE** | One container: the gallery. `subject` becomes a string. |
| `manifest.json` override mechanism | **REWRITE** | Becomes `gallery.json`, written by the Worker, never hand-authored. |
| `_draft-` prefix handling | **REMOVE** | Replaced by `published`. |
| `"generated"` timestamp write | **FIX FIRST** | The churn bug. `build_seo.py:_write_if_changed()` is the pattern. |

### Static generation

| Subsystem | Verdict | Reason |
|---|---|---|
| `build_seo.py` album stub generation | **KEEP, EXTEND** | Already solves the og:image problem correctly. Extend to photo pages and the static homepage LCP image. |
| `sitemap.xml` generation with image entries | **KEEP, EXTEND** | Add photo pages. |
| `robots.txt` generation | **KEEP** | |
| `feed.xml` (Atom) generation | **KEEP** | Fits the independent-of-Instagram goal, costs nothing, deterministic. |
| `og_image_url()` / `update_og_image()` marker rewriting | **SIMPLIFY** | Becomes a one-line lookup once the hero is gone. |
| `slugify()` contract shared across three files | **KEEP** | Good discipline. Extend it to the date suffix. |

### Frontend

| Subsystem | Verdict | Reason |
|---|---|---|
| Static HTML + vanilla ES modules, no build | **KEEP** | Named in `CLAUDE.md` as a project property. It is the right property. |
| `js/gallery.js` justified-row grid | **KEEP, RETUNE** | `flex-basis: ar * 240` → `ar * 460`. Single column below 700px. Full-bleed first frame. |
| `js/gallery.js` `buildPswpSrcset()` | **KEEP** | Correct as written. |
| PhotoSwipe v5, vendored | **KEEP, SIMPLIFY** | Drop the EXIF panel and `paddingFn`'s 200px branch. Keep share, keyboard, pinch. |
| PhotoSwipe share button | **KEEP, REPOINT** | At the static photo page. |
| `js/app.js` catalog fetch + URL helpers | **KEEP, ADAPT** | To the split catalog. |
| `js/app.js` `renderCategoryGrid()` / `makeAlbumTile()` / `renderLatestAlbums()` / `renderAlbumGrid()` | **REMOVE** | The containers go. |
| `js/hero.js` | **REMOVE** | §13. |
| `js/photo.js` + `/photo/` | **REWRITE** | Static `/galleries/<slug>/<stem>/` pages. |
| `album.html` redirect shim | **REMOVE** | |
| `css/tokens.css` | **REWRITE** | New palette, new type, new spacing. Same mechanism. |
| `css/style.css` (893 lines) | **REWRITE** | Roughly 60% renders components being deleted. Expect ~400 lines after. |
| `css/lightbox.css` | **SIMPLIFY** | The EXIF table styles go. |
| `css/print.css` | **KEEP** | Costs nothing, nice touch. |
| Space Grotesk woff2 (2 files, 48KB) | **REMOVE** | → Newsreader variable. |
| Skip-link, focus ring, `@media (hover: hover)` gating, `aspect-ratio` reservation, `loading`/`decoding`/`fetchpriority` | **KEEP** | All correct. Carry forward. |

### Content

| Subsystem | Verdict | Reason |
|---|---|---|
| The 20 hockey photographs | **KEEP** | Your strongest body of work. Reslug and retitle. |
| The 23 hero images | **REVIEW** | Fold the best into the portfolio edit. Delete the rest from R2. They are currently doing decorative work. |
| Aviation / Other (3 photos) | **MERGE or DELETE** | An album called "Other" should not exist. |
| Places / Seattle (1 photo) | **MERGE** | A one-photograph gallery is not a gallery. Fold into a broader travel gallery or into the edit. |
| `hockey/select-images` slug | **REWRITE** | Rename the R2 keys, generate a redirect stub. §27. |
| `aviation/Other`, `places/New York City` (space in key) | **REWRITE** | Same. Percent-encoded spaces in URLs are a permanent tax. |
| `README.md` upload workflow section | **REWRITE** | Describes the Cyberduck ceremony that stopped happening. |
| `ROADMAP.md` | **KEEP as history** | Phases 1, 3, 4, 5 shipped. Mark Phase 3 "shipped, then partly retired". |
| `ARCHITECTURE_REVIEW.md` / `IMPLEMENTATION.md` | **KEEP** | Still the correct plan for the publishing pipeline. §16 amends, does not replace. |
| `prompts/` (20 files, 104KB) | **ARCHIVE** | Move out of the repository root. |

---

## 26. Where I think you are wrong

You asked for this section and asked me to be candid, so here it is in order of how much
it would change what you do.

### 1. The problem is not the architecture. The problem is that there are 31 photographs.

Since 20 June, this repository has gained approximately 300 automated commits and zero
photographs. In that window two genuinely excellent engineering documents were written
about the site. `ARCHITECTURE_REVIEW.md` Phase 0 is a thirty-minute bug fix labelled "do
this regardless" and it has not shipped in the month since it was written. Phase 1 has not
started.

You are now commissioning a third document.

I do not think this is a discipline failure and I do not think the previous documents were
wrong. I think engineering is the comfortable work here and publishing is the uncomfortable
work, and the site keeps getting architected because architecting it is more enjoyable than
editing photographs and admitting some of them are not good enough.

**The most valuable thing in this document is this paragraph.** Before a single line of the
redesign is implemented, upload 150 photographs using the Cyberduck workflow you already
have. It is a bad workflow and it will take an afternoon. Then the redesign gets designed
against a real body of work instead of against five galleries, one of which is called
"Other" and one of which contains a single photograph from Seattle.

### 2. "The site is too flexible" is half right, and the half you have wrong matters.

Your content model is not too flexible. It is barely used. Five galleries exercise perhaps
a third of what `build_catalog.py` supports.

The problem is not that categories, albums and flat categories exist in the data. The
problem is that **they are the primary objects in the interface**. A visitor's first three
actions on your site are all container selection. You are diagnosing a data-model problem
that is actually a presentation problem, which is why the fix in this document is almost
entirely frontend: hide the taxonomy, keep the machinery.

### 3. The archive instinct is wrong, and it is the instinct most worth resisting.

You want the site to be a meaningful permanent archive. I understand the appeal and I think
it will make the site worse.

A public archive of 1,700 photographs containing 200 good ones does not make the 200 easier
to find. It makes them harder to find, and it changes what the site is: a visitor who
opens "Archive" and hits the third-best frame from a game you shot in 2027 has just formed
their opinion of your photography on a picture you would never have shown them.

Nobody has ever browsed a photographer's archive except the photographer. R2 is your
archive. Lightroom is your archive. The website is the edit, and the edit is the product.

### 4. You are conflating "independent of Instagram" with "replace Instagram".

Those are different goals and only one of them is good.

Independence means the canonical copy lives on a domain you own, in a format you control,
which nobody can algorithmically bury. That is achieved by publishing galleries and
linking to them.

Replacing Instagram means matching its cadence, and that is a trap. Instagram rewards
volume and punishes restraint. A portfolio does the opposite. If the site becomes a place
you post to daily, it becomes Instagram with worse distribution and no audience.

**Post everything to Instagram. Publish the edit to the site. End every Instagram caption
with the gallery link.** Instagram becomes the top of the funnel, which is the only thing
it is good at.

### 5. Metadata matters far less than you think, and your own data says so.

Two of thirty-one photographs have captions. Zero of five galleries have a date or a
location. The site is not meaningfully worse for it.

The lesson from that compliance data is not "make metadata easier to enter". It is **"most
of it was never needed"**. Three fields have ever earned their place: title, date, and a
caption on the rare occasion there is something to say. Everything else should be automatic
or absent.

The EXIF panel is the clearest case. It occupies 200px under every photograph in the
lightbox and it exists because the pipeline happened to be able to produce it.

### 6. Hockey should be prominent, and your stated reason is the weaker one.

You want hockey prominent because it is the commercial plan. Business reasons produce sales
pages, and a sales page is what a visitor will smell.

Hockey should be prominent because it is two-thirds of your published work and it is your
best work. That is a reason a viewer can verify by looking. Lead with the pictures and the
commercial benefit follows. Lead with the business and the pictures start to look like
evidence in an argument.

Worth checking honestly: if the hockey work were not your best work, promoting it would be
a mistake no matter what the business plan says.

### 7. The commercial machinery you want to prepare for would actively hurt you now.

A services page, a pricing table and an inquiry form on a site with zero client work read
as a business that has not started, which reads as inexperience.

Eighteen excellent hockey frames and an email address read as a photographer who is good.
The second converts better. Build the services page after the third booking, when you know
the answers.

### 8. Your mobile publishing goal may be optimizing for the weakest case.

You edit in Lightroom Classic on a Mac. The photographs you are proud of come from a real
edit at a desk. Designing the entire publishing system around the phone risks optimizing
for the case that produces the weakest work.

Build the publish page responsive, because a single column of a grid and a form costs
nothing to make responsive. Do not contort the design around the phone.

The exception is real and worth naming: **for the hockey business, mobile publishing is a
genuine advantage.** A gallery live two hours after the final whistle beats a 48-hour
turnaround. Build for that case specifically.

### 9. "Simple on the surface, powerful underneath" is right, and you have been building
the second half.

The machinery is good. The derived-key contract, the incremental merge, the caption
preservation across rebuilds, the orientation filtering, the srcset pipeline. It is careful,
well-commented work and it is the reason this redesign is mostly deletion.

The surface has not been kept simple, because every capability underneath acquired a
control on top of it. Categories exist in the pipeline, so there is a category grid. EXIF
is parsed, so there is an EXIF panel. Heroes are resized and orientation-filtered, so there
is a slideshow. Drafts have a prefix mechanism, so there is a draft concept.

**The discipline this redesign asks for is not building less machinery. It is refusing to
surface the machinery you build.**

### 10. One thing you are right about that is worth stating.

Your instinct that a static site with R2 and a small Worker is enough is correct, and you
should hold it against pressure. No framework, no database, no CMS, no build step. Two
prior reviews reached the same conclusion independently and so does this one. The
architecture is not the problem and it does not need replacing.

---

## 27. Migration strategy

### 27.1 URL changes and redirects

Five album URLs are live, in `sitemap.xml`, and have been indexed for months. They must not
404.

| Old | New | Mechanism |
|---|---|---|
| `/photography/hockey/select-images/` | `/galleries/<new-hockey-slug>/` | Generated stub |
| `/photography/aviation/usaf-thunderbirds/` | `/galleries/usaf-thunderbirds-<date>/` | Generated stub |
| `/photography/aviation/other/` | Merged or deleted | Stub → `/galleries/` |
| `/photography/places/new-york-city/` | `/galleries/new-york-city-<date>/` | Generated stub |
| `/photography/places/seattle/` | Merged | Stub → target gallery |
| `/photography/` | `/galleries/` | Static stub |
| `/photo/` | `/galleries/` | Static stub |
| `/album.html` | `/galleries/` | Static stub |

GitHub Pages has no redirect configuration, so each stub is an HTML file containing
`<link rel="canonical" href="…">`, `<meta http-equiv="refresh" content="0; url=…">` and a
visible one-line link for anyone with JavaScript and meta-refresh disabled. Search engines
treat canonical plus instant refresh as a redirect. Eight files, generated by
`build_seo.py` from a small hard-coded map, which can be deleted in a year.

### 27.2 R2 key renames

`hockey/select-images`, `aviation/Other` and `places/New York City` should all be renamed.
The space in `New York City` is percent-encoded in every URL forever, and `Other` and
`Select Images` are not titles.

This answers `ARCHITECTURE_REVIEW.md` open question 4 with a scoped yes: **do the rename
once, deliberately, as part of this migration, and not as a feature of the publish page.**
The cost is five redirect stubs and a `rclone move`. The publish page stays upload-only.

Procedure: `rclone move` the originals to the new prefix, delete the old `_thumbs/` and
`_resized/` entries, let the catalog build regenerate derivatives, verify, then commit the
redirect stubs.

### 27.3 Catalog compatibility

Emit both `catalog.json` (old shape) and `index.json` + `galleries/*.json` for one release.
The old frontend keeps working while the new pages are built. Delete `catalog.json` in the
release that removes the last consumer.

### 27.4 What must not break

| Invariant | Why |
|---|---|
| `thumb_key_for()` ↔ `thumbUrl()` contract | Any drift silently breaks every thumbnail. Change both files in the same commit or neither. |
| `slugify()` shared across `app.js`, `build_seo.py` and the Worker | Same reason. Gallery slugs are permanent. |
| `sizes[]` schema | `buildPswpSrcset()` reads it. Add widths, never rename keys. |
| Hand-edited captions | The incremental merge preserves them. Any catalog rewrite must preserve that behaviour or two captions are lost. Verify explicitly. |
| Published gallery slugs | Immutable once live. Titles change, slugs never do. |

---

## 28. Implementation roadmap

Two tracks. Track **N** is work only you can do. Track **S** is work a coding session can
do. They run in parallel and Track S phase 3 must not ship to production before Track N
phase N2 completes.

```
Track N  ──[N1 shoot & upload]──[N2 DNS → Cloudflare]──[N3 R2 CORS + Worker secrets]──
Track S  ──[S0 unblock]──[S1 catalog]──[S2 design system]──[S3 shell+home]──[S4 galleries]──
                                                              ▲
                                              must not ship before N2
         ──[S5 hockey]──[S6 about+SEO]──[S7 publish page]──[S8 edge transforms]
```

### Track N: only Neil can do these

**N1. Shoot and publish 150 photographs. Start today.**
Use the Cyberduck workflow. It is bad. Do it anyway. Every design decision below improves
with a real body of work behind it, and §26 item 1 explains why this outranks everything
else in this document.

**N2. Migrate nameservers to Cloudflare, bind `img.neilkodner.com`.**
Export every DNS record from Namecheap first. **Check MX and TXT/SPF before touching
anything.** Move nameservers, verify the site and mail, then bind the R2 bucket as a custom
domain with a long-TTL cache rule. Update the `R2_PUBLIC_BASE_URL` secret. Confirm
`cf-cache-status: HIT` on a second request. Backfill `Cache-Control` on originals uploaded
before that header was added.
*Blocks: S3 shipping to production. Enables: Web Analytics, AVIF, S8.*

**N3. R2 CORS policy and Worker secrets.** Prerequisite for S7.

**N4. Two ten-minute spikes, before S7 is designed in detail.**
(a) HEIC through `createImageBitmap()` on your actual iPhone, per `ARCHITECTURE_REVIEW.md`
§7.2. (b) Does a 5-star Lightroom Classic export carry `xmp:Rating` into the JPEG, per §16.2.

### Track S: implementation phases

---

**S0. Unblock. Half a session. Ships alone, immediately, before any redesign.**

| | |
|---|---|
| **Changes** | `scripts/build_catalog.py`, `.github/workflows/update-catalog.yml` |
| **Work** | Compare the new catalog against the existing one with `generated` excluded from both, skip the write when otherwise equal. Follow `build_seo.py:_write_if_changed()`. |
| **Test** | Watch one full cron cycle produce no commit. |
| **Deletes** | Nothing |
| **Back-compat** | Total |

Independently valuable and unrelated to the redesign. Do it first.

---

**S1. Content model and catalog split. One session.**

| | |
|---|---|
| **Changes** | `scripts/build_catalog.py` (major), `scripts/build_seo.py`, `js/app.js` |
| **New** | `index.json`, `galleries/<slug>.json` |
| **Work** | One container: the gallery. `subject` as a string. Add `portfolio`, `published`, `venue`. Remove `flat`, `hero[]`, `_draft-`, `location`. Largest derivative 2000 → 2400px. |
| **Migration** | Emit `catalog.json` in parallel for one release. |
| **Test** | Diff every rendered gallery before and after. **Verify the two hand-edited captions survive.** |
| **Must not break** | `thumb_key_for()` contract, `sizes[]` schema, `slugify()` agreement |
| **Deletes** | `make_hero()`, `HERO_LONG_EDGE`, `HERO_QUALITY`, hero parsing, `_draft-` handling |

---

**S2. Design system. Half a session. No visible change.**

| | |
|---|---|
| **Changes** | `css/tokens.css` (rewrite) |
| **New** | `fonts/newsreader-*.woff2` |
| **Work** | Palette, type scale, spacing, motion rule per §10.1. Nothing else. |
| **Deletes** | `fonts/space-grotesk-*.woff2` (after S3) |
| **Test** | Existing pages still render. They will look wrong. That is expected. |

Resist building a style guide page. It is speculative code that gets deleted.

---

**S3. Shell and homepage. One to two sessions. The visible turn.**

| | |
|---|---|
| **Changes** | `index.html`, `css/style.css` (major), `scripts/build_seo.py` |
| **Deletes** | `js/hero.js`, hero CSS, category CSS, album-tile CSS, `renderCategoryGrid()`, `makeAlbumTile()`, `renderLatestAlbums()`, `renderAlbumGrid()`, `og_image_url()` marker rewriting, `_hero/` and `_resized/hero/` from R2 |
| **Work** | New nav and footer. Portfolio stream from `index.json.portfolio[]`. `build_seo.py` writes the first photograph into `index.html` as a real `<img fetchpriority="high">` with a matching preload and the `og:image`. Gallery index as a typographic list. |
| **Depends on** | S1, S2, **N2 before production** |
| **Test** | LCP under 1.5s on simulated LTE. First photograph present with JavaScript disabled. |

---

**S4. Galleries. Two sessions. The biggest phase.**

| | |
|---|---|
| **Changes** | `js/gallery.js`, `scripts/build_seo.py`, `css/lightbox.css` |
| **New** | `/galleries/index.html`, generated `/galleries/<slug>/`, generated `/galleries/<slug>/<stem>/`, eight redirect stubs |
| **Deletes** | `photography/`, `album.html`, `photo/`, `js/photo.js` |
| **Work** | Retune justified rows to `ar * 460`. Single column below 700px. Full-bleed first frame. Static photo pages with real og tags. Strip the PhotoSwipe EXIF panel and its `paddingFn` branch. Repoint the share button. |
| **Migration** | Redirect stubs before deleting `photography/`. |
| **Test** | Every old URL resolves. Every photo page has a scrapeable `og:image`. Keyboard navigation intact. Pinch-zoom intact. Lightroom order preserved. |

---

**S5. Hockey. One session.**

| | |
|---|---|
| **New** | `/hockey/index.html` |
| **Work** | Opening frame, positioning paragraph, 14–18 frames filtered on `subject == "hockey"`, "Working with me" block (no prices), hockey gallery list, contact. `ProfessionalService` JSON-LD with `areaServed`. |
| **Depends on** | S4 |
| **Test** | Rich Results Test passes. Reachable in one tap from the homepage on a phone. |

---

**S6. About, SEO, social. One session.**

| | |
|---|---|
| **Changes** | `about/index.html`, `scripts/build_seo.py`, `404.html`, `feed.xml` |
| **Work** | Rewrite About (photograph of Neil, remove the empty avatar div, **remove "no prints for sale, no client work"**, add the assignments sentence). Structured data per §20. Static og on every page. Sitemap extended to photo pages. `404.html` shows one photograph and links home. |
| **Test** | Paste one URL of each type into iMessage and Slack. Every one renders a preview. |

---

**S7. Publish page and Worker. Two to three sessions. The largest engineering phase.**

Follow `ARCHITECTURE_REVIEW.md` §7 and `IMPLEMENTATION.md` for the mechanics. They are
correct and should not be redesigned. What changes for the new model:

| | |
|---|---|
| **New** | `worker/` (`/api/login`, `/api/presign`, `/api/publish`), `/publish/index.html`, a vendored EXIF+XMP reader |
| **Changes** | `.github/workflows/update-catalog.yml` (add `repository_dispatch`, drop or lengthen the cron) |
| **Deltas from the review** | Form asks for **title + subject chip**, not category/album/flat. Writes `galleries/<slug>.json`, not `manifest.json`. Reads `xmp:Rating` and pre-sets `portfolio` (§16.2). Largest derivative 2400px. `published` toggle replaces the `_draft-` rename. Slug carries the date. |
| **Depends on** | N3, N4 |
| **Test** | Publish 25 photographs from an iPhone on LTE in under 3 minutes end to end. Presign validation rejects a bad key, a bad content type, and an oversized file. |
| **Then** | Rewrite the README upload section. Delete the Cyberduck ceremony. |

---

**S8. Edge transformations. One session. Optional.**

| | |
|---|---|
| **Work** | Enable Transformations on the zone. Point `thumbUrl()` and `sizes[]` at `/cdn-cgi/image/...` with `format=auto` for AVIF. `buildPswpSrcset()` needs no change. Remove derivative generation from `build_catalog.py`. Delete `_thumbs/` and `_r/` from R2. |
| **Depends on** | N2 |
| **Watch** | The transformation counter for one month before trusting the free tier. |

---

**S9. Publish page editing mode. One session. After S7 has been used for a month.**

Existing-gallery mode: caption editing, photograph deletion, drag-reorder on desktop.
Build it after you know which of the nine operations in §16.3 you actually reach for.

### Effort summary

| Track S phase | Sessions | Ships alone |
|---|---|---|
| S0 Unblock | 0.5 | Yes, immediately |
| S1 Content model | 1 | Yes, invisible |
| S2 Design system | 0.5 | Yes, invisible |
| S3 Shell + homepage | 1–2 | Yes |
| S4 Galleries | 2 | Yes |
| S5 Hockey | 1 | Yes |
| S6 About + SEO | 1 | Yes |
| S7 Publish + Worker | 2–3 | Yes |
| S8 Edge transforms | 1 | Optional |
| S9 Edit mode | 1 | Optional |
| **Total** | **11–13** | |

Every phase is independently shippable and independently useful. There is no phase whose
value depends on a later phase landing.

---

## 29. Open questions

Answer these before implementation starts. Roughly in the order they block work.

1. **Is the hockey work genuinely your best work?** Everything in §14 rests on yes. If the
   aviation work is stronger, the homepage edit changes and `/hockey/` becomes a quieter
   page. Only you can answer this, and answering it honestly is worth more than any
   decision in this document.

2. **Will you delete the hero images, or fold the best of them into the edit?** There are
   23. Some are presumably good enough for the portfolio. My default: review all 23,
   promote the good ones into the edit, delete the rest from R2.

3. **Will you shoot a portrait of yourself for the About page?** The empty circular avatar
   has been a placeholder since launch. A photograph of you at a rink, taken by a friend,
   is worth more than a headshot and costs one text message.

4. **Newsreader, or something else?** §10 picks it and gives the reasoning. It is a real
   aesthetic decision and it is yours to overrule. If you overrule it, the constraint that
   matters is: one editorial serif with an italic, variable weight, self-hostable, SIL OFL.

5. **Are you willing to give up the EXIF panel?** It is the change most likely to feel like
   a loss, and it is the one I am most confident about.

6. **Is there mail on `neilkodner.com`?** If there are MX records, N2 needs a rollback plan.
   Carried forward unanswered from `ARCHITECTURE_REVIEW.md` §13.1.

7. **Instagram handle?** It is referenced throughout §21 and it is not in the repository
   anywhere. The footer and About page need it.

8. **What is the real turnaround you would promise for a hockey gallery?** The §12.2
   wireframe says 48 hours because that is the market norm from the research. Say a number
   you would actually hit, or say none.

9. **`prompts/`: keep in the repository, move to `docs/history/`, or drop?** It is the
   largest directory in the repo and it documents how the site was made rather than what it
   is.

---

## Appendix: the design in one screen

```
WHAT IT IS          A book of photographs with a hockey chapter and an email address.

NAVIGATION          Neil Kodner        Hockey   Galleries   About

HOMEPAGE            One sentence. Then 24–36 photographs, full-bleed, no captions,
                    no dates, no tiles. One quiet hockey block a third of the way
                    down. A dated gallery list at the bottom.

CURATION            portfolio: true, set from your Lightroom star rating.

CONTAINERS          One. The gallery.

TAXONOMY            A `subject` string. Never a page, never a URL, never a click.

TYPE                Newsreader for everything editorial.
                    System sans for labels, uppercase, tracked, never above 13px.

COLOR               #FAFAF9 paper. #121212 ink. No accent.

MOTION              A 200ms fade when an image loads. Nothing else.

DELETED             Hero slideshow. Categories. Albums. Album tiles. EXIF panel.
                    Fixed nav. Hover effects. The amber. Space Grotesk. Cream.
                    Query-string permalinks. Draft prefixes. Featured flags.

KEPT                R2. GitHub Pages. No build step. Vanilla JS. PhotoSwipe.
                    Justified rows. The derived-key contract. Incremental builds.
                    The caption preservation. The privacy hygiene.

ADDED               A Worker. A publish page. A split catalog. A CDN. A photograph
                    of Neil. And one boolean.

FIRST ACTION        Not any of the above. Upload 150 photographs.
```
