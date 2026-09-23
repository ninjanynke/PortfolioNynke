# nynkezwart.com — Webflow to Astro migration

Context for anyone (including Claude) picking this up. Steps 1 and 3 are done:
content is migrated and validates in Astro. No templates yet.

## Goal

Replace the Webflow-hosted portfolio at nynkezwart.com with a static Astro site
in this repo, served from GitHub Pages on the same domain. Webflow's CMS
subscription goes away; content becomes Markdown in Git. Target cost: the
domain registration and nothing else.

A redesign is likely but not decided. Design direction will be explored
separately in Claude Design. Until then, treat the existing layout as the
reference, and keep content and presentation separated so a reskin doesn't
mean touching the content files.

## Stack

- **Astro** 7 (7.3.4 at setup), MIT licensed. Content Collections for the CMS layer.
- Markdown + frontmatter for content, validated by `src/content.config.ts`.
- **GitHub Pages** for hosting, custom domain, free HTTPS.
- No CSS framework chosen yet. No JS framework needed — the site is documents.

Chosen after ruling out: Next.js (too heavy, needs React), React Native (mobile
app framework, not for websites), a hand-rolled Python generator (viable, but
Astro's build-time image optimization is worth the dependency for ~180 images).

The owner is wary of anything that could start charging money. Prefer
dependencies that are MIT/permissive and locally installed over hosted
services. Astro outputs plain HTML, so the escape hatch is real — say so rather
than over-promising if this comes up.

## The site being replaced

- Home: intro plus four persona links.
- Four category pages at `/site-categories/<slug>`: intro text, two
  "Highlights", a list of other projects, prev/next arrows cycling categories.
  Slugs: `program-outline`, `design-outline`, `naai-outline`, `flower-outline`.
  Each has a background colour used as the page theme.
- 34 project pages at `/projects/<slug>`.
- `/aboutme` — static, not in the CMS. Copy by hand.
- CV as a PDF: `webflow-assets-2026-09-23/CV - Nynke Zwart - 2024.pdf`. Only the
  latest CV goes in the repo; the 2021–2023 versions stay in the local zip.

**Keep the URL paths identical.** They're on a CV and on LinkedIn.

## Migration

Done 2026-09-23. `migrate.py` turned the six Webflow CSV exports into
`src/content/{projects,categories}/*.md` and `src/data/footer.json`, with each
image next to the Markdown that uses it (`src/content/projects/<slug>/images/`,
referenced as `./<slug>/images/foo.jpg`). All 189 image references resolve; no
Webflow CDN URLs remain. See `README.md` for usage and the field mapping.

- `assets/webflow/` is a flat backup of all 179 CDN files, taken before the
  content run. It is **gitignored and local only**. `migrate.py` copies from it
  instead of downloading, so the script still works after Webflow is gone.
  Delete it once the Astro build validates (step 3).
- `asset-manifest.tsv` lists each CDN URL and where it landed.
  `download-assets.sh` is a curl-only fallback that refills `assets/webflow/`
  (it only works while Webflow's CDN is still up).
- Python deps live in `.venv/` (`requests`, plus `pyyaml` for checking).

## Known issues in the source content

- `tikkie` is a draft with no category set. Invisible on the live site. Decide:
  finish or delete.
- The Etsy footer entry has no URL and is skipped.
- `design-outline` is the only category with a Lottie animation, and its URL
  points at a **different Webflow project** (site ID `5f36f3d3…`, not
  `5f3a5425…`). That file (`5f708f871837f3269e6b940f_render.json`) is backed
  up and is the same size as `design_walkingtext.json` (26,703 bytes); it is the
  only asset from the second project. The four `*_walkingtext.json` Lotties
  are in `webflow-assets-2026-09-23/`.
- Several live pages render broken: the WaterRower project shows "No pictures
  found", its conclusion is empty, and some image links resolve to `#`. Fix
  during the rebuild rather than reproducing the breakage.
- Footer says © 2021. About me says "27 years old" and is stale. CV is 2024.
- Videos are YouTube behind Embedly wrappers. `migrate.py` extracts the video
  ID; use a plain iframe or `lite-youtube-embed`.
- Reference collections (types, tags, skills) were flattened to strings —
  they held only a name and a slug. 8 types, 21 tags, 59 skills.

## Rebuild approach (decided 2026-09-23)

- **Pixel-perfect copy** of the live site first; redesign comes later.
- **Clean rebuild, not a copy of Webflow's markup.** Take exact values (fonts,
  colours, sizes, spacing, breakpoints 991/767/479) from Webflow's stylesheet
  into CSS custom properties, and write semantic Astro components. Don't paste
  Webflow's generated class soup or depend on webflow.js.
- **Match the animations closely.** From webflow.js's interaction data there
  are only: logo cross-fade on hover (500 ms, home tiles), tag fade on hover
  (500 ms), white title fade on scroll into/out of view (100 ms), and the
  Lottie walking text on category pages (`lottie-web`, MIT).
- **Fonts bundled** via Fontsource (OFL), not loaded from Google. Used:
  Montserrat 200/400/500/600/700 and Esteban 400. Bitter is loaded by the old
  site but used in only one rule; check before bundling it.
- **Order:** shared layout + footer → project page → category page → home →
  about me. Per template: build, compare against the reference, list the
  differences, get sign-off, then ask before committing.

## Reference capture

`reference/` is the archive of the live site, so the rebuild has a reference
after Webflow is cancelled. `node scripts/capture-reference.mjs [paths…]`
(re)creates it with Playwright driving the local Chrome:

- `shots/<1280|900|600|375>/<page>.png`: full-page screenshots, one width
  per breakpoint range. 39 pages (tikkie is a draft, so not live).
  **Local only** (gitignored, 87 MB), on the owner's laptop. They can only
  be recreated while the live site is up, so don't cancel Webflow without
  deciding where they'll be kept.
- `html/`: raw HTML of each page.
- `webflow/`: the site stylesheet and `webflow.js` (holds the interaction
  definitions under `Webflow.require('ix2').init(...)`).
- `assets/`: files placed directly on pages, outside the CMS: logo, quote
  mark, arrows, Lotties.

The live site is published from Webflow project `5f36f3d3…`; the CMS images
sit on `5f3a5425…`.

pixelmatch + pngjs are installed for pixel-diffing the rebuild against
`shots/`.

## Build order

1. ~~Run `migrate.py`, confirm all 179 assets downloaded, commit.~~ Done.
2. Cancel Webflow. **On hold** until the rebuild matches the old site's look and
   feel; Webflow is the reference until then.
3. ~~`npm create astro@latest`, drop in `content.config.ts`, get the content
   collections validating.~~ Done: 34 projects, 4 categories, all 170 images
   processed by `astro build` without warnings.
4. Layout + footer from `src/data/footer.json`.
5. Project page template. Frontmatter carries metadata, cover, gallery and the
   side-by-side `methodPair`; the Markdown body carries method text, the
   full-width image and the conclusion, already in the right order.
   **GIFs:** 22 project images are GIFs, and `<Image>` converts them to a
   single-frame WebP. Render GIFs with a plain `<img src={img.src}>` (or
   `format="gif"`) so they keep animating.
6. Category page template, themed by the category's `colour`.
7. Home page.
8. Deploy to GitHub Pages, add `CNAME`, point DNS, verify old URLs resolve.

Content editing after launch is undecided: either Markdown directly in Git, or
Sveltia CMS for a visual admin panel that commits to the repo. Doesn't block
anything — decide once the site is up.
