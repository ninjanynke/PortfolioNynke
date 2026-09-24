# Webflow → Astro migration

One-off script that turns the Webflow CSV exports of nynkezwart.com into Astro
content collections, and pulls every asset off Webflow's CDN into the repo.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install requests

# Dry run first — writes Markdown, copies no assets.
.venv/bin/python migrate.py --csv-dir . --out . --skip-images

# The real thing. 179 assets.
.venv/bin/python migrate.py --csv-dir . --out .
```

Every run also writes `asset-manifest.tsv` — one row per asset, listing the
source URL and where it lands. If you'd rather not use Python for the
download, `download-assets.sh` fetches exactly the same files with `curl`.

`--csv-dir` is the folder holding the six exported CSVs. `--out` is the root of
the Astro project. Re-running is safe: assets already on disk are skipped.
Assets are copied from the local backup in `assets/webflow/` when present and
only downloaded from Webflow's CDN when missing there.

## What it writes

```
src/
  content/
    projects/<slug>.md          34 files
    projects/<slug>/images/     assets for that project
    categories/<slug>.md         4 files
    categories/<slug>/images/   logos and the Lottie
  assets/footer/                 social icons
  data/footer.json
```

Each project's images live next to its Markdown file and are referenced
relatively (`./<slug>/images/foo.jpg`). That's deliberate — Astro's `image()` schema
helper picks up relative paths and handles resizing and format conversion at
build time.

## Then

`src/content.config.ts` defines the schema the
generated frontmatter expects, and replaces the field editor Webflow gave you:
a bad category slug or a missing image becomes a build error instead of a
broken page.

## Field mapping

| Webflow                            | Frontmatter                   |
| ---------------------------------- | ----------------------------- |
| Project title                      | `title`                       |
| Project short summary              | `summary` (tags stripped)     |
| Highlighted text                   | `highlightSummary`, only where it differs from the summary |
| Project category                   | `category` (collection ref)   |
| Project type / tags / skills learnt| `type`, `tags`, `skills` — resolved from slugs to labels |
| Project start/end date             | `startDate`, `endDate` (ISO)  |
| IsHighlightedProject               | `featured`                    |
| Created On                         | `created` (list order)        |
| Project cover image                | `cover`                       |
| Project gallery images             | `gallery` + `galleryCaption`  |
| Method image LB / RB               | `methodPair`                  |
| Project video link                 | `video.youtube` (ID extracted)|
| Method text 1, full-width image, method text 2 | body, in that order |
| Conclusion and future plans        | body, under its own heading   |

Reference collections (types, tags, skills) are flattened into plain strings.
They held nothing but a name and a slug, so a separate collection for each
would be three extra files to maintain for no gain. If you later want tag
archive pages, generate them from the values instead.

## Known issues in the source data

The script prints these at the end of a run:

- `tikkie` has no category and is still a draft — it won't appear anywhere.
- The Etsy footer entry has no URL and is skipped.
- `design-outline` is the only category with a Lottie animation attached, and
  it points at a *different* Webflow project (site ID `5f36f3d3…`, not
  `5f3a5425…`). The other three categories have no Lottie set. Your assets zip
  does contain four `*_walkingtext.json` Lottie files — those were placed on
  pages directly rather than through the CMS, so they're already safe.
