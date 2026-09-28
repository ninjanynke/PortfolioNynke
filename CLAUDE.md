# nynkezwart.com

Nynke Zwart's portfolio: a static Astro site in this repo, live at
https://www.nynkezwart.com on GitHub Pages. It replaced a Webflow site
(moved over September 2026, Webflow cancelled 2026-09-28). `README.md`
covers running it, publishing and how a project file is laid out.

## Ground rules

- **Nothing that can start costing money.** The only cost is the domain.
  Prefer MIT/permissive dependencies installed locally over hosted
  services. Astro outputs plain HTML, so the escape hatch is real; say so
  rather than over-promising if this comes up.
- **Keep the URL paths.** `/projects/<slug>`, `/site-categories/<slug>`,
  `/aboutme` and `/cv/nynke-zwart-cv.pdf` are on the CV and on LinkedIn.
- **A redesign is likely**, explored separately in Claude Design. Keep
  content (Markdown) and presentation (components, CSS) separate so a
  reskin doesn't touch the content files. Until then the current look is
  the reference: changes shouldn't move anything unintentionally.
- **Editing content** (decided 2026-09-28): Markdown in Git, no admin
  panel. The owner describes a change or hands over text and images;
  Claude edits the files, shows the result on the dev server, and commits
  and pushes only after a yes. Sveltia CMS (MIT) stays an option if a
  visual editor is ever wanted; signing in would need a GitHub token or a
  small OAuth service.

## Stack

- **Astro** 7, Content Collections validated by `src/content.config.ts`: a
  missing image or unknown category fails the build.
- Markdown rendered by Sätteri (`@astrojs/markdown-satteri`) with **smart
  punctuation off**, so quotes render exactly as typed.
- Fonts bundled with Fontsource (Montserrat 200–700, Esteban 400), not
  loaded from Google. `lottie-web` for the animations. No CSS or JS
  framework: plain semantic components, values as custom properties in
  `src/styles/tokens.css` (breakpoints 991/767/479). `global.css` sets
  `box-sizing: border-box` on everything.

## Where things are

- Content: `src/content/projects/<slug>.md` with images in
  `projects/<slug>/images/` (34 projects), `categories/<slug>.md` (4:
  `program-outline`, `design-outline`, `naai-outline`, `flower-outline`,
  each with a theme `colour`), `pages/home.md` and `pages/aboutme.md`,
  `src/data/footer.json`. The CV is `public/cv/nynke-zwart-cv.pdf`.
- Pages: `index.astro`, `aboutme.astro`, `site-categories/[slug].astro`
  (Highlights = `featured` projects, then "Other projects"),
  `projects/[slug].astro`. Page titles are `<title> | Portfolio Nynke`.
- `ProjectBody.astro` splits a project's Markdown at its headings (`##
  Method`, `## Conclusion and future plans`) and at the one full-width
  image (its alt text is the caption), and places the parts around the
  `methodPair` images and the video. Empty sections are hidden.
- Images: `ProjectImage.astro` (with `Lightbox.astro`: click to enlarge,
  gallery images page through each other) and `CardCover.astro` (card
  covers at display size, lazy below the first screen). Everything goes
  through Astro's `<Image>`/`getImage()`; GIFs come out as animated WebP.
- Highlight cards show `highlightSummary` when set, else `summary`.
- **Drafts** live in `src/content/drafts/`, laid out like `projects/`. The
  folder is gitignored: drafts show on the dev server (as
  `/projects/<slug>`, and on their category page if they have one) but
  never reach GitHub or the live site, and they're backed up only with the
  laptop. The repo is public, so unpublished work never gets committed.
  To publish, move the file and its images folder to `projects/`.

## Design decisions to keep

Owner's choices that differ from the Webflow original; don't undo them.
Details are in the code comments.

- **Cards activate while scrolling on touch screens and under 768px**,
  and on hover elsewhere (`src/scripts/scroll-activate.ts`): home tiles
  (white, shadow, logo cross-fade), "Other projects" cards (tags fade in,
  veil clears), Highlights (shadow). Nothing is active on page load; back
  to rest after 2 s without scrolling.
- **Wrapped card tags become one pill per line**, flush right
  (`src/scripts/tag-lines.ts`).
- **Pages crossfade** (cross-document view transitions in `global.css`,
  no JS); the header stays put. Nothing shifts while loading: fonts are
  preloaded in `BaseLayout.astro`, `Lottie.astro` reserves each
  animation's space.
- **Even spacing:** project sections sit `--section-gap` (30px) apart;
  category pages end 30px before the footer and all four line up; card
  titles stop at two lines with "…"; the footer sits at the bottom of the
  window on short pages.
- **Videos in their own shape:** `video.aspect` in the frontmatter ("1:1",
  "9:16"; 16:9 is the default). After adding or replacing a video, run
  `node scripts/video-aspects.mjs --write` (it reads YouTube's watch page,
  not an official API, so it may break; the site never depends on it).
  Players are plain `youtube-nocookie.com` iframes, at most 560px or 75%
  of the window tall.

## Checking a change

- Preview on the dev server (`npm run dev`, port 4321). It caches
  rendered Markdown and doesn't notice new content files until restarted;
  for a reliable check, `npm run build` and `npx astro preview --port 4322`.
- `node scripts/compare.mjs <path> <name> [header,footer,full]` pixel-diffs
  the local site against the live one at 1280/900/600/375 wide (Lotties
  frozen on the same frame, `--frame=N`), writing diffs to
  `reference/diff/` (gitignored). `LOCAL_URL=http://localhost:4322` to
  compare a production build. Animated images differ by frame.
- `reference/` holds the Webflow site's HTML, stylesheet and page assets;
  `node scripts/css-rules.mjs .class …` prints its CSS rules per
  breakpoint.

## Hosting

- **Deploys:** every push to `main` builds and publishes the site
  (`.github/workflows/deploy.yml`, withastro/action + actions/deploy-pages)
  in 2–3 minutes; check with `gh run list`. Free because the repository
  (`ninjanynke/PortfolioNynke`) is public.
- **Repository settings → Pages:** source "GitHub Actions", custom domain
  `www.nynkezwart.com`, Enforce HTTPS on. There's no `CNAME` file; the
  domain lives in these settings. `nynkezwart.com` and `http://` redirect
  to `https://www.`.
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
- **Paths:** `/projects/macrame` redirects to `/projects/macrame/`, so
  links without a trailing slash keep working. The site can't be previewed
  at `ninjanynke.github.io/PortfolioNynke/`: it uses root paths.

## To do

- **Drafts:** finish or delete what's in `src/content/drafts/`.
- The heaviest image left is the NOHRD screen recording (152 frames,
  3.7 MB); only real video would shrink it much.
