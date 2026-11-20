# Redesign (November 2026)

- [`brief.md`](brief.md): the brief Neil wrote for the redesign.
- `index.html`: the proposal it produced. Download the folder and open it in a browser
  (GitHub shows it as source). It covers the assessment of the old site, visual research,
  three art directions, the recommended "Dateline" direction, the design system, wireframes
  built with the real photographs, the technical plan, the keep/remove list, the roadmap,
  content needed, and the launch checklist.

## Status

The Dateline design is built and live at [neilkodner.com](https://neilkodner.com), deployed
20 November 2026. How to publish and where things live is in the [main README](../../README.md).

### Where the build differs from the proposal

| Proposal | What shipped |
|---|---|
| Footer and Contact list Instagram and LinkedIn | LinkedIn only. Instagram is left out on purpose. |
| Captions with example dates ("January 2026") | Dates are the real capture dates read from the original files. Venues appear only where they are visible in the frame. Anything unknown is a `confirm:` note in the gallery file. |
| Street lists London as unconfirmed | Confirmed from the "Old Street" sign in L1002033 (Northern line). |
| Final photos as 3000 px Lightroom exports | Launch photos are the 2000 px copies from the old R2 bucket, used as placeholders. |
| About with a portrait and a sentence on hockey background | No portrait yet. The hockey background sentence is a TODO in `src/about.njk`. |
| Fonts under 130 KB total | 167 KB total, almost all of it Newsreader (variable, two axes). |
| A domain email such as neil@neilkodner.com | Not set up. The site uses the existing Gmail address. |

### Still to do

- Replace placeholder photos with final Lightroom exports.
- Resolve the `confirm:` notes in `src/_data/galleries/*.yml` (mainly venues and opponents).
- Add the hockey background sentence to About.
- Delete the R2 bucket and its four repository secrets once it is no longer needed as a backup.
