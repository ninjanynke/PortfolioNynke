# nynkezwart.com — Webflow to Astro migration

Context for anyone (including Claude) picking this up. Content is migrated and
validates in Astro; layout, home, about me and category pages are built (see
"Build order" below). Next: the project page template.

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
  Rendered by Sätteri (Astro 7's Markdown engine, `@astrojs/markdown-satteri`)
  with **smart punctuation off**, so quotes render exactly as typed, like on
  Webflow.
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
- ~~Several live pages render broken~~: checked 2026-09-23, **they don't**.
  "No pictures found." is Webflow's hidden empty-state text (in all 33 project
  pages, never visible); `href="#"` links are Webflow lightboxes (clicking an
  image opens it large, so the rebuild needs a lightbox too); 16 projects
  simply have no conclusion, which is fine: sections without content are
  hidden. YouTube embeds load late, so they show as blank space in
  `reference/shots/`; they work on the live site.
- Footer says © 2021: show the current year (2026) instead. About me says
  "27 years old": Nynke is 30 now (2026). CV is 2024. Layout is pixel-perfect;
  stale text like this is fixed rather than copied.
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
- **Order** (changed 2026-09-23): shared layout + footer → home → about me →
  category page → project page. Per template: build, compare against the reference, list the
  differences, get sign-off, then ask before committing.

## Deliberate changes from the live site

Pixel-perfect is the default; these differ on purpose (owner's decision):

- **Home tiles, active state everywhere.** Live only turns tiles white and
  fills the logo on hover from 768px up. Now one active look at every width
  (white fade 300 ms, shadow, logo cross-fade 500 ms, coloured title),
  triggered by hover where the device can hover, and on touch screens or
  windows under 768px by the tile crossing the middle of the viewport, but
  only while the visitor is scrolling: nothing is active on page load, and
  the tile goes back to rest after 2 s without scrolling (`IDLE_MS` in
  `src/scripts/scroll-activate.ts`).
  Note: the live reference shots at 600/375 show the top logos filled,
  because the capture scrolled and triggered the live site's own effect.
- **Home tile logos always the same size.** Live stretches the filled logo
  wider than the outline between 380–479px and 740–780px.
- **"Other projects" cards, active state everywhere**, same idea as the
  home tiles: tags fade in (500 ms) and the white veil clears (200 ms),
  triggered by hover where the device can hover, and by scrolling on touch
  screens and windows under 768px (shared `scroll-activate.ts`). Live only
  did this from 992px up; below that it showed the type tag permanently
  (768–991) or never showed tags or the veil (≤767), so reference shots at
  900/600/375 differ there. The Highlights cards get their hover shadow the
  same way.
- **Wrapped card tags split into one pill per line**, flush right, lines
  touching, with the touching corners squared (`src/scripts/tag-lines.ts`).
  Live showed one big block with a ragged right edge. One-line tags are
  unchanged.
- © year is the current year; About me age is 30; double space in "working
  as" removed.

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

`node scripts/compare.mjs <local path> <reference name> [header,footer,full]`
pixel-diffs the running dev server against `shots/` at all four widths and
writes red-highlighted diffs to `reference/diff/` (gitignored). `--live`
diffs against the live site itself, with Lottie animations on both sides
frozen on the same frame (`--frame=N`): needed for animated pages. Set
`LOCAL_URL=http://localhost:4322` to diff a production build served by
`npx astro preview --port 4322` instead: the dev server caches rendered
Markdown and can serve stale output after config changes, and doesn't
notice newly created content files until it is restarted.
`node scripts/css-rules.mjs .class …` prints every Webflow CSS rule for the
given selectors, per breakpoint: the fastest way to get exact values.

## Build order

1. ~~Run `migrate.py`, confirm all 179 assets downloaded, commit.~~ Done.
2. Cancel Webflow. **On hold** until the rebuild matches the old site's look and
   feel; Webflow is the reference until then.
3. ~~`npm create astro@latest`, drop in `content.config.ts`, get the content
   collections validating.~~ Done: 34 projects, 4 categories, all 170 images
   processed by `astro build` without warnings.
4. ~~Layout + footer from `src/data/footer.json`.~~ Done: `BaseLayout.astro`,
   `SiteHeader.astro`, `SiteFooter.astro`, tokens in `src/styles/tokens.css`.
   Header and footer are pixel-identical to the live site at all four widths
   (footer differs only by the intended © year). The CV is served from
   `/cv/nynke-zwart-cv.pdf`; replace that file to update it. Page titles are
   `<title> | Portfolio Nynke` (the live site uses "Portfolio Nynke" for
   almost every page).
5. ~~Home page.~~ Done: intro text in `src/content/pages/home.md` (new `pages`
   collection), tiles in `CategoryTile.astro`. Full page identical to live
   apart from the © year; hover and phone scroll-fill end states identical.
   Hover is pure CSS; the phone scroll-fill is a small IntersectionObserver.
6. ~~About me (`/aboutme`).~~ Done: text in `src/content/pages/aboutme.md`,
   the photo-with-circles Lottie in `src/assets/lottie/about-me.json`, played
   by `Lottie.astro` (lottie-web, MIT). Identical to live with the animation
   frozen on the same frame, apart from the age, a double space fixed in
   "working  as", and the © year.
7. ~~Category page template, themed by the category's `colour`.~~ Done:
   `site-categories/[slug].astro`, `HighlightCard.astro`, `ProjectCard.astro`.
   Identical to live apart from the © year and the deliberate changes above
   (Lotties frozen on the same frame; animated GIF covers differ). Highlight
   cards show `highlightSummary` (Webflow's separate "Highlighted text")
   when set, else `summary`. `global.css` sets `box-sizing: border-box` on
   everything, as Webflow does.
8. Project page template. Frontmatter carries metadata, cover, gallery and the
   side-by-side `methodPair`; the Markdown body carries method text, the
   full-width image and the conclusion, already in the right order.
   **GIFs:** 22 project images are GIFs, and `<Image>` converts them to a
   single-frame WebP. Render GIFs with a plain `<img src={img.src}>` (or
   `format="gif"`) so they keep animating.
9. Deploy to GitHub Pages, add `CNAME`, point DNS, verify old URLs resolve.

Content editing after launch is undecided: either Markdown directly in Git, or
Sveltia CMS for a visual admin panel that commits to the repo. Doesn't block
anything — decide once the site is up.
