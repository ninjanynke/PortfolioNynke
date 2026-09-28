# nynkezwart.com — Webflow to Astro migration

Context for anyone (including Claude) picking this up. Content is migrated and
validates in Astro; every page is built: layout, home, about me, category
and project pages (see "Build order" below). Live on GitHub Pages at
https://www.nynkezwart.com since 2026-09-27. Next: cancel Webflow (step 2).

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
- **GitHub Pages** for hosting, custom domain, free HTTPS. See "Hosting".
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
- CV as a PDF, now `public/cv/nynke-zwart-cv.pdf`. Only the latest CV goes
  in the repo.

**Keep the URL paths identical.** They're on a CV and on LinkedIn.

## Migration

Done 2026-09-23: the Webflow CMS export became
`src/content/{projects,categories}/*.md` and `src/data/footer.json`, with each
image next to the Markdown that uses it (`src/content/projects/<slug>/images/`,
referenced as `./<slug>/images/foo.jpg`). The Markdown files are the source
now; the migration tooling is gone from the repo.

## Known issues in the source content

- `tikkie` is a draft with no category set. Invisible on the live site. Decide:
  finish or delete.
- The Etsy footer entry had no URL in the Webflow export; added by hand
  to `src/data/footer.json` (ClubKekeJewelry shop, after GitHub). With 8
  icons the footer shows one row down to 768px, then 4+4 (480–767) and
  3+3+2 on phones, always at 40px (live had 7 icons, shrinking at 600).
- `design-outline` is the only category with a Lottie animation, and its URL
  points at a **different Webflow project** (site ID `5f36f3d3…`, not
  `5f3a5425…`); it is the same file as `design_walkingtext.json`.
- ~~Several live pages render broken~~: checked 2026-09-23, **they don't**.
  "No pictures found." is Webflow's hidden empty-state text (in all 33 project
  pages, never visible); `href="#"` links are Webflow lightboxes (clicking an
  image opens it large, so the rebuild needs a lightbox too); 16 projects
  simply have no conclusion, which is fine: sections without content are
  hidden.
- Footer says © 2021: show the current year (2026) instead. About me says
  "27 years old": Nynke is 30 now (2026). CV is 2024. Layout is pixel-perfect;
  stale text like this is fixed rather than copied.
- Videos were YouTube behind Embedly wrappers; the rebuild uses a plain `youtube-nocookie.com` iframe. Webflow sized
  players from YouTube's oEmbed, which only ever says 16:9 or 4:3, so 9 of
  the 15 were the wrong shape (square and portrait videos). See
  "Deliberate changes" for how shapes are handled now.
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
  site but only used by `.block-quote`, which no page uses: not bundled.
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
- **Home tile logos always the same size.** Live stretches the filled logo
  wider than the outline between 380–479px and 740–780px.
- **"Other projects" cards, active state everywhere**, same idea as the
  home tiles: tags fade in (500 ms) and the white veil clears (200 ms),
  triggered by hover where the device can hover, and by scrolling on touch
  screens and windows under 768px (shared `scroll-activate.ts`). Live only
  did this from 992px up; below that it showed the type tag permanently
  (768–991) or never showed tags or the veil (≤767). The Highlights cards get their hover shadow the
  same way.
- **Wrapped card tags split into one pill per line**, flush right, lines
  touching, with the touching corners squared (`src/scripts/tag-lines.ts`).
  Live showed one big block with a ragged right edge. One-line tags are
  unchanged.
- **Smooth page changes.** Pages crossfade (CSS cross-document view
  transitions in `global.css`; no router, no JS; Firefox navigates as
  before). Nothing shifts while loading: fonts are preloaded in
  `BaseLayout.astro`, and `Lottie.astro` holds each animation's space with
  an empty SVG of the same size until lottie-web has drawn it. The header
  sits out the crossfade at every width: old and new header both drawn
  fully opaque, the old page's snapshot on top. The snapshot hides the new
  logo's first-frame blink (it's ready 5–15 ms after the new page's first
  frame); if quick clicking leaves no snapshot, the new header shows, so
  the header is never blank.
- **Category pages all line up.** Live pulls only Designer's walking text
  4px up (a Webflow quirk), so "Highlights" sat 4px higher there. Now all
  four pages use the same position, so switching categories doesn't jump.
- **Project pages: equal space between sections.** Live stacked each
  block's bottom margin, so the space above a section heading (or the
  footer) ran from 0 to 41px depending on what ended the section. Now
  sections end flush and sit `--section-gap` (30px) apart, at every width;
  spacing inside sections is unchanged.
- **Category pages: fixed space before the footer, two-line card titles.**
  Live's space before the footer depended on the titles in the last row
  (tight on Programmer, and on narrow screens titles ran into the footer).
  Now the last row ends at its longest title and `.others` is followed by
  a fixed 30px on all four pages. "Other projects" titles stop at two lines
  with "…" (the rows keep live's spacing); below 768px many titles are cut,
  since the grid keeps four columns down to 480px.
- **Footer at the bottom of the window on short pages** (About me, and
  a-floral-wish on wide screens): `body` is a flex column at least as tall
  as the window and `<main>` grows. Pages taller than the window are
  unchanged. Live left the footer halfway up those pages.
- **Videos in their own shape.** Each player has its video's real shape,
  stored as `video.aspect` in the project's frontmatter ("1:1", "9:16";
  16:9 is the default and left out). `node scripts/video-aspects.mjs`
  checks every video against YouTube and `--write` fixes the files: run it
  after adding or replacing a video. It reads the file sizes from YouTube's watch page, not an
  official API, so it may break if YouTube changes that page; the site
  never depends on it. Players are never taller than 560px or 75% of the
  window. From 768px up the player sits left and the text starts 20px
  after it (a narrow player leaves the text more room); below that it is
  centred above the text, at most 70% wide like the full-width Method
  image (100% below 480px).
- **Footer spacing on phones:** the space above "Spot me in other places!"
  is 20px at every width (live doubled it below 768px and added 20px more
  below 480px).
- © year is the current year; About me age is 30; double space in "working
  as" removed.

## Reference

`reference/` is the record of the Webflow site, in the repo: `html/` (raw
HTML of each page), `webflow/` (the site stylesheet and `webflow.js`, which
holds the interaction definitions under `Webflow.require('ix2').init(...)`)
and `assets/` (files placed directly on pages, outside the CMS: logo, quote
mark, arrows, Lotties). The live site was published from Webflow project `5f36f3d3…`;
the CMS images sat on `5f3a5425…`.

`node scripts/compare.mjs <local path> <name> [header,footer,full]`
pixel-diffs the running dev server against the live site
(www.nynkezwart.com, i.e. the last deploy) at all four widths, with Lottie
animations on both sides frozen on the same frame (`--frame=N`), and writes
red-highlighted diffs to `reference/diff/` (gitignored, safe to empty).
Lazy images are loaded before capture; animated images differ wherever the
two captures caught different frames. Set
`LOCAL_URL=http://localhost:4322` to diff a production build served by
`npx astro preview --port 4322` instead: the dev server caches rendered
Markdown and can serve stale output after config changes, and doesn't
notice newly created content files until it is restarted.
`node scripts/css-rules.mjs .class …` prints every Webflow CSS rule for the
given selectors, per breakpoint: the fastest way to get exact values.

## Build order

1. ~~Migrate the Webflow content and assets.~~ Done.
2. Cancel Webflow. Nothing depends on it since the DNS switch (2026-09-27),
   so cancelling breaks nothing. Left before cancelling: look through
   Webflow once more for anything not yet copied.
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
8. ~~Project page template.~~ Done: `projects/[slug].astro` (facts, key
   work, gallery), `ProjectBody.astro` (method, video, conclusion),
   `ProjectImage.astro`, `Lightbox.astro` (click an image to see it large;
   gallery images page through each other). Frontmatter carries metadata,
   cover, gallery and the side-by-side `methodPair`; the Markdown body
   carries method text, the full-width image and the conclusion, and
   `ProjectBody` splits it at the headings and the image to place the parts
   where Webflow had them. GIFs go through `<Image>` too: Astro's sharp
   service turns them into animated WebP, keeping every frame and the
   loop. Matches live apart
   from the deliberate changes above. Drafts (tikkie) get no page.
9. ~~Deploy to GitHub Pages, point DNS, verify old URLs resolve.~~ Done
   2026-09-27; see "Hosting". All 39 old URLs load over HTTPS on both
   `www.nynkezwart.com` and `nynkezwart.com`.

## Hosting

Live since 2026-09-27 at **https://www.nynkezwart.com** (the main address,
as on Webflow; `nynkezwart.com` and `http://` redirect there).

- **Deploys:** every push to `main` builds and publishes the site
  (`.github/workflows/deploy.yml`, withastro/action + actions/deploy-pages).
  Takes 2–3 minutes; progress in the repository's Actions tab. Free because
  the repository (`ninjanynke/PortfolioNynke`) is public.
- **Repository settings → Pages:** source "GitHub Actions", custom domain
  `www.nynkezwart.com`, Enforce HTTPS on. With an Actions deploy there's no
  `CNAME` file; the domain lives in these settings.
- **Domain and DNS** at Squarespace Domains (account.squarespace.com/domains;
  moved there from Google Domains). Custom records: four `A` records for
  `@` (185.199.108.153, .109.153, .110.153, .111.153), `CNAME` `www` →
  `ninjanynke.github.io`, and `TXT` `_github-pages-challenge-ninjanynke`,
  which verifies the domain for the GitHub account (keep it: it stops
  anyone else claiming the domain on GitHub). The `CNAME` to
  `…dv.googlehosted.com` is an old Google verification record and
  `_domainconnect` is Squarespace's own; neither affects the site. No
  email (MX) on the domain.
- **HTTPS:** a free Let's Encrypt certificate, requested and renewed by
  GitHub. If it ever gets stuck, removing and re-adding the custom domain
  in the Pages settings requests a new one.
- **Paths:** GitHub serves `/projects/macrame` by redirecting to
  `/projects/macrame/`, so links without a trailing slash (CV, LinkedIn)
  keep working. The site can't be previewed at
  `ninjanynke.github.io/PortfolioNynke/`: it uses root paths.

## To do

- ~~**Page weight.**~~ Done 2026-09-28. Card covers are resized WebP at
  the card's display size (`CardCover.astro`; cards below the first
  screen load lazily), and GIFs everywhere become animated WebP, 4–10×
  smaller at the same size and quality. Category pages (all images,
  largest sizes): Maker 28.8 → 2.7 MB, Designer 14.5 → 0.9 MB,
  Programmer 3.6 → 0.3 MB, Florist 1.5 → 0.8 MB. The heaviest image
  left is the NOHRD screen recording (152 frames, 3.7 MB), which only a
  real video would shrink much further.

Content editing after launch is undecided: either Markdown directly in Git, or
Sveltia CMS for a visual admin panel that commits to the repo. Doesn't block
anything — decide once the site is up.
