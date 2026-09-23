// Pixel-diff the local rebuild against the archived live-site screenshots.
//
//   node scripts/compare.mjs <local path> <reference name> [regions]
//   node scripts/compare.mjs / index header,footer
//   node scripts/compare.mjs /projects/trombone-lamp projects__trombone-lamp full
//
// Regions:
//   header  top of the page down to the bottom of .site-header (+ shadow)
//   footer  the last <footer> height of the page, from the bottom
//   full    the whole page (only meaningful once the template is done)
//
// Needs the dev server on http://localhost:4321 and reference/shots/.
// Writes red-highlighted diffs to reference/diff/<width>/<name>-<region>.png.

import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Override with LOCAL_URL to diff a production build (`astro preview`).
const LOCAL = process.env.LOCAL_URL ?? 'http://localhost:4321';
const WIDTHS = [1280, 900, 600, 375];
const SHADOW = 6; // px of header shadow to include below the header

const [localPath = '/', refName = 'index', regionArg = 'header,footer'] = process.argv.slice(2);
const regions = regionArg.split(',');

function crop(png, y, height) {
  const out = new PNG({ width: png.width, height });
  PNG.bitblt(png, out, 0, y, png.width, height, 0, 0);
  return out;
}

const browser = await chromium.launch({ channel: 'chrome' });
let worst = 0;

for (const width of WIDTHS) {
  const ref = PNG.sync.read(await readFile(`reference/shots/${width}/${refName}.png`));
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(LOCAL + localPath, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Astro's dev toolbar floats over the bottom of the page.
  await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  const box = await page.evaluate(() => {
    const f = document.querySelector('footer')?.getBoundingClientRect();
    return {
      header: document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0,
      footerTop: f ? f.top + window.scrollY : 0,
      footer: f?.height ?? 0,
    };
  });
  const local = PNG.sync.read(await page.screenshot({ fullPage: true }));
  await page.close();

  for (const region of regions) {
    let a, b;
    if (region === 'header') {
      const h = Math.round(box.header) + SHADOW;
      a = crop(local, 0, h);
      b = crop(ref, 0, h);
    } else if (region === 'footer') {
      // Locally the footer may sit above the bottom of a short page; on the
      // live pages it is always last.
      const h = Math.round(box.footer);
      a = crop(local, Math.round(box.footerTop), h);
      b = crop(ref, ref.height - h, h);
    } else {
      const h = Math.min(local.height, ref.height);
      if (local.height !== ref.height) {
        console.log(`  ${width}px full: page height differs (local ${local.height}, live ${ref.height})`);
      }
      a = crop(local, 0, h);
      b = crop(ref, 0, h);
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const pct = (100 * bad) / (a.width * a.height);
    worst = Math.max(worst, pct);
    await mkdir(`reference/diff/${width}`, { recursive: true });
    await writeFile(`reference/diff/${width}/${refName}-${region}.png`, PNG.sync.write(diff));
    console.log(`${String(width).padStart(4)}px ${region.padEnd(6)} ${bad.toString().padStart(6)} px differ (${pct.toFixed(2)}%)`);
  }
}

await browser.close();
console.log(`\nWorst region: ${worst.toFixed(2)}% of pixels differ.`);
