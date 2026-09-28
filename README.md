# nynkezwart.com

Nynke Zwart's portfolio: a static [Astro](https://astro.build) site, served
by GitHub Pages at https://www.nynkezwart.com. Content is Markdown in this
repo; there's no CMS or database.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:4321, reloads as you edit
npm run build      # the finished site, in dist/
npm run preview    # serve dist/ to check the build
```

## Publish

Push to `main`. GitHub Actions builds the site and publishes it in 2–3
minutes (`.github/workflows/deploy.yml`); follow it in the repository's
Actions tab, or with `gh run list`.

## Where things are

```
src/
  content/
    projects/<slug>.md          one per project, at /projects/<slug>
    projects/<slug>/images/     that project's images
    categories/<slug>.md        the four category pages, at /site-categories/<slug>
    pages/home.md, aboutme.md   text of the home and About me pages
  content.config.ts             what each file must contain
  data/footer.json              the footer's links
  components/, layouts/, pages/ how everything looks
public/cv/nynke-zwart-cv.pdf    the CV; replace the file to update it
```

## Editing a project

A project is its Markdown file plus its `images/` folder. The frontmatter
holds the facts, the cover, the gallery and the side-by-side Method images;
the text below it is the page body:

```markdown
---
title: "Macrame"
summary: "Shown on the category page."
category: "naai-outline"
cover: "./macrame/images/img_8550.jpg"
gallery:
  - "./macrame/images/img_7101.jpg"
…
---

## Method

Text. One image on its own line appears full width, with the text in
the brackets as its caption:

![Caption under the image](./macrame/images/rope.jpg)

## Conclusion and future plans

Optional; left out, the section doesn't appear.
```

Images are referenced relative to the project's Markdown file. Astro makes
resized copies at build time, so add the originals; GIFs become animated
WebP. A missing image, an unknown category or a missing field stops the
build with an error, rather than publishing a broken page.

`featured: true` puts a project under its category's Highlights.

## Drafts

Unfinished projects go in `src/content/drafts/`, laid out the same way
(`drafts/<slug>.md`, `drafts/<slug>/images/`). That folder is left out of
Git, so drafts stay on your own computer: the dev server shows them at
`/projects/<slug>`, but they never reach GitHub or the live site. To
publish one, move its file and images folder to `src/content/projects/`.
Back up your computer, because drafts are nowhere else.

After adding or replacing a YouTube video (`video.youtube` in the
frontmatter), run `node scripts/video-aspects.mjs --write` to store its
shape, so the player isn't letterboxed.

## Scripts

- `scripts/video-aspects.mjs`: checks every video's shape against YouTube.
- `scripts/compare.mjs`: pixel-diffs the local site against the live one,
  at four widths. Handy before pushing a change that shouldn't move anything.
- `scripts/css-rules.mjs`: prints rules from the old Webflow stylesheet in
  `reference/webflow/`.

## History

Until September 2026 the site ran on Webflow; its CMS export was converted
into these Markdown files on 2026-09-23. `reference/` holds the old site's
HTML, stylesheet and page assets, as a record of what it looked like.
