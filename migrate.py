#!/usr/bin/env python3
"""
Migrate the Webflow export of nynkezwart.com into Astro content collections.

Reads the CSVs exported from Webflow, downloads every referenced asset off
Webflow's CDN into the repo, and writes one Markdown file per project and
per category.

Usage:
    python migrate.py --csv-dir ./webflow-csv --out .
    python migrate.py --csv-dir ./webflow-csv --out . --skip-images   # dry run

Requires: pip install requests
Everything else is standard library.

Safe to re-run: assets already on disk are not downloaded again.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests")


# --------------------------------------------------------------------------
# Which CSV is which. Webflow names exports by collection ID, so we match on
# a substring rather than the full filename.
# --------------------------------------------------------------------------

CSV_FILES = {
    "projects": "Project_details",
    "categories": "Category_details",
    "types": "Project_types",
    "tags": "Project_tags",
    "skills": "Project_skills",
    "footer": "Footer_items",
}


def find_csv(csv_dir: Path, fragment: str) -> Path:
    # Webflow has used both "Project_details" and "Project details" in names.
    matches = [p for p in csv_dir.glob("*.csv") if fragment in p.name.replace(" ", "_")]
    if not matches:
        sys.exit(f"No CSV matching '{fragment}' found in {csv_dir}")
    if len(matches) > 1:
        sys.exit(f"Multiple CSVs match '{fragment}': {[m.name for m in matches]}")
    return matches[0]


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [
            {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            for row in csv.DictReader(fh)
        ]


# --------------------------------------------------------------------------
# Rich text: Webflow gives us a small, predictable subset of HTML.
# Only p, strong, em, a, ul, ol, li and br appear in this export, so a full
# HTML-to-Markdown library would be overkill.
# --------------------------------------------------------------------------

class RichTextToMarkdown(HTMLParser):
    """Convert the small HTML subset Webflow emits into Markdown.

    Inline emphasis is buffered rather than written straight out, because
    Webflow's editor produces things like '<strong>paper </strong>' where the
    space sits inside the tag. Markdown will not render '**paper **' as bold,
    so the whitespace has to be moved outside the markers.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._stack: list[tuple[str, list[str]]] = []
        self._link_href: str | None = None
        self._list_stack: list[str] = []
        self._item_index: list[int] = []

    # -- output buffer: either the document, or the innermost inline span ---

    @property
    def _buf(self) -> list[str]:
        return self._stack[-1][1] if self._stack else self.parts

    def _emit(self, text: str) -> None:
        self._buf.append(text)

    def _open_inline(self, marker: str) -> None:
        self._stack.append((marker, []))

    def _close_inline(self, marker: str) -> None:
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == marker:
                break
        else:
            return  # stray closing tag; ignore
        _, buffer = self._stack.pop(index)
        inner = "".join(buffer)
        core = inner.strip()
        if not core:
            self._emit(inner)
            return
        lead = inner[: len(inner) - len(inner.lstrip())]
        trail = inner[len(inner.rstrip()) :]
        self._emit(f"{lead}{marker}{core}{marker}{trail}")

    # -- HTMLParser hooks --------------------------------------------------

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "p":
            self._flush_block()
        elif tag in ("strong", "b"):
            self._open_inline("**")
        elif tag in ("em", "i"):
            self._open_inline("*")
        elif tag == "a":
            self._link_href = attrs.get("href")
            self._open_inline("\x00link")
        elif tag in ("ul", "ol"):
            self._flush_block()
            self._list_stack.append(tag)
            self._item_index.append(0)
        elif tag == "li":
            if self._list_stack and self._list_stack[-1] == "ol":
                self._item_index[-1] += 1
                self._emit(f"\n{self._item_index[-1]}. ")
            else:
                self._emit("\n- ")
        elif tag == "br":
            self._emit("  \n")
        elif tag == "img":
            src_attr = attrs.get("src", "")
            alt = attrs.get("alt", "")
            # Left as an absolute URL on purpose; flagged in the report.
            self._emit(f"\n\n![{alt}]({src_attr})\n\n")

    def handle_endtag(self, tag):
        if tag == "p":
            self._flush_block()
        elif tag in ("strong", "b"):
            self._close_inline("**")
        elif tag in ("em", "i"):
            self._close_inline("*")
        elif tag == "a":
            href = self._link_href or ""
            self._link_href = None
            for index in range(len(self._stack) - 1, -1, -1):
                if self._stack[index][0] == "\x00link":
                    break
            else:
                return
            _, buffer = self._stack.pop(index)
            inner = "".join(buffer)
            core = inner.strip()
            lead = inner[: len(inner) - len(inner.lstrip())]
            trail = inner[len(inner.rstrip()) :]
            self._emit(f"{lead}[{core}]({href}){trail}" if core else inner)
        elif tag in ("ul", "ol"):
            if self._list_stack:
                self._list_stack.pop()
                self._item_index.pop()
            self._flush_block()

    def handle_data(self, data):
        self._emit(re.sub(r"\s+", " ", data))

    def _flush_block(self) -> None:
        if self._stack:
            return  # never break a paragraph inside an inline span
        if self.parts and not "".join(self.parts[-2:]).endswith("\n\n"):
            self.parts.append("\n\n")

    def result(self) -> str:
        while self._stack:  # unbalanced tags: salvage the text
            marker, buffer = self._stack.pop()
            self._buf.append("".join(buffer))
        md = "".join(self.parts)
        md = re.sub(r"[ \t]+\n", "\n", md)
        md = re.sub(r"\n{3,}", "\n\n", md)
        return md.strip()


def html_to_markdown(html: str | None) -> str:
    if not html or not html.strip():
        return ""
    # A few fields were saved double-encoded ('&amp;nbsp;'), so decode once
    # before parsing; the parser handles a single level itself.
    if "&amp;" in html:
        html = unescape(html)
    parser = RichTextToMarkdown()
    parser.feed(html)
    parser.close()
    return parser.result()


def caption(value: str | None) -> str | None:
    """Caption fields are plain text in theory, but a few hold rich-text
    HTML. Strip anything that looks like markup, and drop empties."""
    text = html_to_plain(value) if value and "<" in value else (value or "")
    return text.strip() or None


def html_to_plain(html: str | None) -> str:
    """Strip tags entirely. Used for the short summary shown in listings."""
    if not html:
        return ""
    text = unescape(re.sub(r"<[^>]+>", " ", html))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# --------------------------------------------------------------------------
# Assets
# --------------------------------------------------------------------------

# Webflow asset URLs look like:
#   https://uploads-ssl.webflow.com/<site>/<hash>_<original name>.<ext>
# We drop the hash and keep a readable, slugified version of the name.
HASH_PREFIX = re.compile(r"^[0-9a-f]{24}_")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w.-]+", "-", value).strip("-.")
    value = re.sub(r"-{2,}", "-", value)
    return value.lower() or "asset"


def filename_for(url: str) -> str:
    raw = unquote(Path(urlparse(url).path).name)
    raw = HASH_PREFIX.sub("", raw)
    stem, _, ext = raw.rpartition(".")
    if not stem:
        stem, ext = raw, "bin"
    return f"{slugify(stem)}.{ext.lower()}"


class AssetDownloader:
    def __init__(self, root: Path, backup: Path, skip: bool = False) -> None:
        self.root = root
        self.backup = backup  # flat copy of the CDN, keyed by original filename
        self.skip = skip
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "portfolio-migration/1.0"
        self.seen: dict[tuple[str, str], Path] = {}
        self.claimed: dict[Path, str] = {}  # dest -> url that owns it
        self.copied = 0
        self.failed: list[tuple[str, str]] = []
        self.manifest: list[tuple[str, str]] = []
        self.downloaded = 0

    def fetch(self, url: str | None, folder: str, ref_dir: Path) -> str | None:
        """Save `url` into <root>/<folder>/. Returns its path relative to
        `ref_dir` (the folder of the file that will reference it), or None."""
        if not url or not url.startswith("http"):
            return None

        key = (folder, url)
        dest = self.seen.get(key)
        if dest is None:
            dest = self.root / folder / filename_for(url)
            # Two different URLs can slugify to the same filename. Disambiguate
            # with a short piece of the Webflow hash rather than overwriting.
            if self.claimed.get(dest, url) != url:
                digest = re.search(r"/([0-9a-f]{24})_", url)
                suffix = digest.group(1)[:6] if digest else "dup"
                dest = dest.with_name(f"{dest.stem}-{suffix}{dest.suffix}")
            self.claimed[dest] = url
            self.manifest.append((url, str(dest)))

            if not self.skip and not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                local = self.backup / unquote(Path(urlparse(url).path).name)
                try:
                    if local.is_file() and local.stat().st_size:
                        shutil.copyfile(local, dest)
                        self.copied += 1
                    else:
                        resp = self.session.get(url, timeout=60)
                        resp.raise_for_status()
                        dest.write_bytes(resp.content)
                        self.downloaded += 1
                        print(f"    downloaded {folder}/{dest.name}")
                except Exception as exc:  # noqa: BLE001 - report and continue
                    self.failed.append((url, str(exc)))
                    print(f"    FAILED {url}: {exc}", file=sys.stderr)
                    return None
            self.seen[key] = dest

        rel = Path(os.path.relpath(dest, ref_dir)).as_posix()
        return rel if rel.startswith("../") else f"./{rel}"


# --------------------------------------------------------------------------
# YAML output. Hand-rolled so the script has no PyYAML dependency and so the
# formatting stays readable and diff-friendly in Git.
# --------------------------------------------------------------------------

def yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def yaml_block(data: dict, indent: int = 0) -> list[str]:
    pad = " " * indent
    lines: list[str] = []
    for key, value in data.items():
        if value is None or value == "" or value == [] or value == {}:
            continue
        if isinstance(value, dict):
            lines.append(f"{pad}{key}:")
            lines.extend(yaml_block(value, indent + 2))
        elif isinstance(value, list):
            lines.append(f"{pad}{key}:")
            for item in value:
                if isinstance(item, dict):
                    inner = yaml_block(item, indent + 4)
                    lines.append(f"{pad}  - {inner[0].strip()}")
                    lines.extend(inner[1:])
                else:
                    lines.append(f"{pad}  - {yaml_scalar(item)}")
        else:
            lines.append(f"{pad}{key}: {yaml_scalar(value)}")
    return lines


def write_markdown(path: Path, frontmatter: dict, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["---", *yaml_block(frontmatter), "---", ""]
    if body:
        lines.append(body)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------
# Misc parsing
# --------------------------------------------------------------------------

def parse_date(value: str | None) -> str | None:
    """'Fri Feb 01 2019 00:00:00 GMT+0000 (...)' -> '2019-02-01'."""
    if not value:
        return None
    try:
        return datetime.strptime(value[:24].strip(), "%a %b %d %Y %H:%M:%S").date().isoformat()
    except ValueError:
        return None


def split_refs(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def truthy(value: str | None) -> bool:
    return str(value).strip().lower() in {"true", "yes", "1"}


YOUTUBE_ID = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{6,})"
)


def youtube_id(url: str | None) -> str | None:
    if not url:
        return None
    match = YOUTUBE_ID.search(url)
    return match.group(1) if match else None


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv-dir", type=Path, default=Path("."), help="folder holding the Webflow CSV exports")
    ap.add_argument("--out", type=Path, default=Path("."), help="root of the Astro project")
    ap.add_argument("--skip-images", action="store_true", help="write Markdown without downloading assets")
    args = ap.parse_args()

    paths = {name: find_csv(args.csv_dir, frag) for name, frag in CSV_FILES.items()}

    projects = read_csv(paths["projects"])
    categories = read_csv(paths["categories"])
    footer_rows = read_csv(paths["footer"])

    # Reference collections: map slug -> human-readable label.
    types = {r["Slug"]: r["Project type"] for r in read_csv(paths["types"])}
    tags = {r["Slug"]: r["Tag name"] for r in read_csv(paths["tags"])}
    skills = {r["Slug"]: r["Skill name"] for r in read_csv(paths["skills"])}

    content = args.out / "src" / "content"
    assets = args.out / "src" / "assets"
    data_dir = args.out / "src" / "data"

    # Images sit next to the Markdown that uses them, so Astro's image()
    # helper resolves them: src/content/projects/<slug>/images/...
    dl = AssetDownloader(args.out / "src", args.out / "assets" / "webflow", skip=args.skip_images)
    report: list[str] = []

    # ---- Categories ------------------------------------------------------
    print("Categories:")
    for row in categories:
        slug = row["Slug"]
        print(f"  {slug}")
        folder = f"content/categories/{slug}/images"
        ref = content / "categories"
        fm = {
            "title": row.get("CategoryTitle") or row.get("Name"),
            "label": row.get("ThisPage"),
            # 'Name' is prefixed with a sort key in Webflow, e.g. '1_Programmer'
            "order": int(row["Name"].split("_")[0]) if row.get("Name", "")[:1].isdigit() else 99,
            "colour": row.get("Background colour"),
            "colourLight": row.get("Lighter colour"),
            "logo": dl.fetch(row.get("Logo"), folder, ref),
            "logoHover": dl.fetch(row.get("Logo on hover"), folder, ref),
            "lottie": dl.fetch(row.get("LottieFile"), folder, ref),
            "next": row.get("NextCategory") or None,
            "previous": row.get("PreviousCategory") or None,
        }
        body = html_to_markdown(row.get("Category detailed page introduction text"))
        write_markdown(content / "categories" / f"{slug}.md", fm, body)

    # ---- Projects --------------------------------------------------------
    print("Projects:")
    for row in projects:
        slug = row["Slug"]
        title = row["Project title"]
        print(f"  {slug}")
        folder = f"content/projects/{slug}/images"
        ref = content / "projects"

        category = row.get("Project category") or None
        if not category:
            report.append(f"{slug}: no category set — will not appear on any category page")

        gallery_urls = split_refs(row.get("Project gallery images"))
        gallery = [p for p in (dl.fetch(u, folder, ref) for u in gallery_urls) if p]

        video_url = row.get("Project video link") or None
        vid = youtube_id(video_url)
        if video_url and not vid:
            report.append(f"{slug}: video link is not YouTube ({video_url}) — needs handling by hand")

        fm = {
            "title": title,
            "summary": html_to_plain(row.get("Project short summary")),
            "category": category,
            "type": types.get(row.get("Project type", ""), row.get("Project type") or None),
            "tags": [tags.get(s, s) for s in split_refs(row.get("Project tags"))],
            "skills": [skills.get(s, s) for s in split_refs(row.get("Project skills learnt"))],
            "startDate": parse_date(row.get("Project start date")),
            "endDate": parse_date(row.get("Project end date")),
            "featured": truthy(row.get("IsHighlightedProject")),
            "featuredTag": tags.get(
                row.get("Highlighted project tag (1)", ""),
                row.get("Highlighted project tag (1)") or None,
            ),
            "cover": dl.fetch(row.get("Project cover image"), folder, ref),
            "draft": truthy(row.get("Draft")),
            "gallery": gallery,
            "galleryCaption": caption(row.get("Project gallery images text")),
            "methodPair": [
                item for item in (
                    {"src": dl.fetch(row.get("Project method image_LB"), folder, ref),
                     "caption": caption(row.get("Project method image_LB text"))},
                    {"src": dl.fetch(row.get("Project method image_RB"), folder, ref),
                     "caption": caption(row.get("Project method image_RB text"))},
                ) if item["src"]
            ],
            "video": ({"youtube": vid, "caption": caption(row.get("Project video text"))}
                      if vid else None),
        }

        # Body keeps the original reading order: method text, the full-width
        # image that sat between the two paragraphs, then the conclusion.
        sections: list[str] = []
        method_1 = html_to_markdown(row.get("Project method text 1"))
        method_2 = html_to_markdown(row.get("Project method text 2"))
        conclusion = html_to_markdown(row.get("Conclusion and future plans text"))

        if method_1 or method_2:
            sections.append("## Method")
        if method_1:
            sections.append(method_1)
        full_src = dl.fetch(row.get("Project method image_fullWidth"), folder, ref)
        if full_src:
            alt = (caption(row.get("Project method image_fullWidth text")) or "").replace("]", "")
            sections.append(f"![{alt}]({full_src})")
        if method_2:
            sections.append(method_2)
        if conclusion:
            sections.append("## Conclusion and future plans")
            sections.append(conclusion)

        write_markdown(content / "projects" / f"{slug}.md", fm, "\n\n".join(sections))

    # ---- Footer ----------------------------------------------------------
    print("Footer links:")
    footer: list[dict] = []
    for row in sorted(footer_rows, key=lambda r: r.get("Name", "")):
        if not row.get("URL"):
            report.append(f"footer '{row.get('Name')}': no URL set — skipped")
            continue
        name = row["Name"].split("_", 1)[-1]
        footer.append({
            "name": name,
            "url": row["URL"],
            "icon": dl.fetch(row.get("Icon image"), "assets/footer", data_dir),
        })
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "footer.json").write_text(
        json.dumps(footer, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"  {len(footer)} links")

    # ---- Manifest --------------------------------------------------------
    # Every asset and where it should end up. Lets you fetch them with
    # something other than this script, and doubles as a record of what the
    # CDN held on the day you left Webflow.
    manifest_path = args.out / "asset-manifest.tsv"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8") as fh:
        fh.write("url\tdestination\n")
        for url, dest in dl.manifest:
            fh.write(f"{url}\t{dest}\n")
    print(f"\nManifest: {manifest_path} ({len(dl.manifest)} assets)")

    # ---- Summary ---------------------------------------------------------
    print()
    print(f"Wrote {len(projects)} projects and {len(categories)} categories.")
    if args.skip_images:
        print("Images were NOT downloaded (--skip-images).")
    else:
        print(f"Copied {dl.copied} assets from assets/webflow/, downloaded {dl.downloaded} new.")

    if dl.failed:
        print(f"\n{len(dl.failed)} asset(s) failed to download:")
        for url, err in dl.failed:
            print(f"  {url}\n    {err}")

    if report:
        print("\nThings that need a look:")
        for line in report:
            print(f"  - {line}")


if __name__ == "__main__":
    main()
