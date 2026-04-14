# Prompt 01 — Initial Concept

I want to build a personal photography portfolio website. Here are my constraints and goals:

- **No frameworks or build tools.** Plain HTML, CSS, and vanilla JavaScript only. I want to understand everything in the codebase.
- **Images hosted on Cloudflare R2**, not in the git repo. The site should fetch and display images from R2 at runtime.
- **Deployed on GitHub Pages** from a public GitHub repo.
- **No CMS, no server.** I want to upload photos from my iPad using an S3-compatible file manager app and have the site update automatically — no git commands required after initial setup.
- **Automated catalog generation.** A GitHub Action should scan my R2 bucket on a schedule, generate thumbnails, and produce a `catalog.json` file that the site reads to know what photos and albums exist.

The photography categories I expect to have are: aviation, hockey, birds, and places (travel).

Please design the overall architecture — the folder layout for R2, the structure of `catalog.json`, the GitHub Action approach, and the site file structure. Don't write any code yet. I want to agree on the design before we start building.
