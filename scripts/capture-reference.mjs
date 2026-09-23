// Archive the live Webflow site as the reference for the rebuild.
//
//   node scripts/capture-reference.mjs            # everything
//   node scripts/capture-reference.mjs /aboutme   # just these paths
//
// Writes to reference/:
//   html/<page>.html            raw HTML as served by Webflow
//   shots/<width>/<page>.png    full-page screenshots, one per breakpoint range
//   webflow/                    the site stylesheet and webflow.js (holds the
//                               interaction/animation definitions)
//   assets/                     every file the pages load from Webflow's CDN
//                               that isn't already in the CMS export
//
// Uses the locally installed Google Chrome; no browser download needed.

import { chromium } from 'playwright';
import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://www.nynkezwart.com';
const OUT = 'reference';
// Webflow's breakpoints are 991 / 767 / 479; one width inside each range.
const WIDTHS = [1280, 900, 600, 375];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function pagePaths() {
  const slugs = async (dir) =>
    (await readdir(dir)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  const projects = [];
  for (const slug of await slugs('src/content/projects')) {
    const md = await readFile(`src/content/projects/${slug}.md`, 'utf8');
    if (!/^draft: true$/m.test(md)) projects.push(`/projects/${slug}`);
  }
  const categories = (await slugs('src/content/categories')).map((s) => `/site-categories/${s}`);
  return ['/', '/aboutme', ...categories, ...projects];
}

const fileFor = (p) => (p === '/' ? 'index' : p.slice(1).replaceAll('/', '__'));

// Scroll the whole page so scroll-triggered animations and lazy images fire.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
}

async function main() {
  const only = process.argv.slice(2);
  const paths = only.length ? only : await pagePaths();
  for (const dir of ['html', 'webflow', 'assets', ...WIDTHS.map((w) => `shots/${w}`)]) {
    await mkdir(path.join(OUT, dir), { recursive: true });
  }

  const browser = await chromium.launch({ channel: 'chrome' });
  const cdnFiles = new Set();
  const failures = [];

  for (const p of paths) {
    const name = fileFor(p);
    const res = await fetch(SITE + p);
    if (!res.ok) { failures.push(`${p}: HTTP ${res.status}`); continue; }
    await writeFile(path.join(OUT, 'html', `${name}.html`), await res.text());

    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('response', (r) => {
        if (/website-files\.com|webflow\.com/.test(r.url())) cdnFiles.add(r.url());
      });
      await page.goto(SITE + p, { waitUntil: 'networkidle' });
      await scrollThrough(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'shots', String(width), `${name}.png`), fullPage: true });
      await context.close();
    }
    console.log(`captured ${p}`);
  }
  await browser.close();

  // Download the stylesheet, webflow.js and any directly-placed assets.
  const known = new Set(await readdir('assets/webflow').catch(() => []));
  let saved = 0;
  for (const url of cdnFiles) {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop());
    // Skip Webflow's resized copies (foo-p-500.jpeg); Astro makes its own.
    if (!base || known.has(base) || /-p-\d+\.\w+$/.test(base)) continue;
    const dir = /\.(css|js)$/.test(base) ? 'webflow' : 'assets';
    const dest = path.join(OUT, dir, base);
    if (await exists(dest)) continue;
    const res = await fetch(url);
    if (!res.ok) { failures.push(`${url}: HTTP ${res.status}`); continue; }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    saved++;
  }

  console.log(`\n${paths.length} pages, ${cdnFiles.size} CDN files seen, ${saved} new files saved.`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}

main();
