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
// Add --live to diff against the live site itself instead of reference/shots/:
// both pages are captured fresh with every Lottie animation frozen on the
// same frame (--frame=N, default 0), so animated pages can be compared.
//   node scripts/compare.mjs /aboutme aboutme full --live --frame=30
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

const LIVE = 'https://www.nynkezwart.com';
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const [localPath = '/', refName = 'index', regionArg = 'header,footer'] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
const regions = regionArg.split(',');
const againstLive = flags.includes('--live');
const frame = Number(flags.find((f) => f.startsWith('--frame='))?.split('=')[1] ?? 0);

// Freeze Lottie animations on `frame`: Webflow's instances on the live site,
// the ones Lottie.astro attaches to [data-lottie] elements locally.
async function freezeLotties(page) {
  await page.waitForFunction(() => {
    const live = window.Webflow?.require?.('lottie')?.lottie?.getRegisteredAnimations?.() ?? [];
    const local = [...document.querySelectorAll('[data-lottie]')].map((el) => el.lottie);
    return [...live, ...local].every((a) => a && a.isLoaded);
  }, null, { timeout: 15000 });
  await page.evaluate((f) => {
    const live = window.Webflow?.require?.('lottie')?.lottie?.getRegisteredAnimations?.() ?? [];
    const local = [...document.querySelectorAll('[data-lottie]')].map((el) => el.lottie);
    for (const a of [...live, ...local]) a.goToAndStop(f, true);
  }, frame);
  await page.waitForTimeout(200);
}

function crop(png, y, height) {
  const out = new PNG({ width: png.width, height });
  PNG.bitblt(png, out, 0, y, png.width, height, 0, 0);
  return out;
}

const browser = await chromium.launch({ channel: 'chrome' });
let worst = 0;

for (const width of WIDTHS) {
  let ref;
  if (againstLive) {
    const livePage = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await livePage.goto(LIVE + localPath, { waitUntil: 'networkidle' });
    await livePage.evaluate(() => document.fonts.ready);
    await freezeLotties(livePage);
    ref = PNG.sync.read(await livePage.screenshot({ fullPage: true }));
    await livePage.close();
  } else {
    ref = PNG.sync.read(await readFile(`reference/shots/${width}/${refName}.png`));
  }
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(LOCAL + localPath, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (againstLive) await freezeLotties(page);
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
    if (againstLive) {
      await writeFile(`reference/diff/${width}/${refName}-${region}-live.png`, PNG.sync.write(b));
      await writeFile(`reference/diff/${width}/${refName}-${region}-local.png`, PNG.sync.write(a));
    }
    console.log(`${String(width).padStart(4)}px ${region.padEnd(6)} ${bad.toString().padStart(6)} px differ (${pct.toFixed(2)}%)`);
  }
}

await browser.close();
console.log(`\nWorst region: ${worst.toFixed(2)}% of pixels differ.`);
