# nynkezwart.com — Webflow to Astro migration

Context for anyone (including Claude) picking this up. Content is migrated
(step 1 done); no Astro project yet.

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

- **Astro** (v5/v6), MIT licensed. Content Collections for the CMS layer.
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
- `content.config.ts` sits in the repo root until step 3 moves it to `src/`.
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

## Build order

1. ~~Run `migrate.py`, confirm all 179 assets downloaded, commit.~~ Done.
2. Cancel Webflow.
3. `npm create astro@latest`, drop in `content.config.ts`, get the content
   collections validating.
4. Layout + footer from `src/data/footer.json`.
5. Project page template. Frontmatter carries metadata, cover, gallery and the
   side-by-side `methodPair`; the Markdown body carries method text, the
   full-width image and the conclusion, already in the right order.
6. Category page template, themed by the category's `colour`.
7. Home page.
8. Deploy to GitHub Pages, add `CNAME`, point DNS, verify old URLs resolve.

Content editing after launch is undecided: either Markdown directly in Git, or
Sveltia CMS for a visual admin panel that commits to the repo. Doesn't block
anything — decide once the site is up.
