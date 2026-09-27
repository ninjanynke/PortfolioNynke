// Check each project video's shape against YouTube, so its player on the
// site has the same shape as the video (no black bars).
//
//   node scripts/video-aspects.mjs           report only
//   node scripts/video-aspects.mjs --write   also fix `aspect` in the files
//
// Run it after adding or replacing a video. The shape is stored in the
// project's frontmatter as `video.aspect` ("1:1", "9:16", …); 16:9 is the
// default and is left out.
//
// YouTube's own oEmbed info only ever says 16:9 or 4:3, so this reads the
// size of the video files listed on the video's watch page instead. That
// isn't an official API: if YouTube changes the page, this reports that it
// couldn't read a video and changes nothing. The site never depends on it.

import { readFile, readdir, writeFile } from 'node:fs/promises';

const dir = 'src/content/projects';
const write = process.argv.includes('--write');
const DEFAULT = '16:9';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const ratio = (w, h) => `${w / gcd(w, h)}:${h / gcd(w, h)}`;

// The JSON object assigned to `name` in the page's scripts.
function extractJson(html, name) {
  const start = html.indexOf(name);
  if (start < 0) return null;
  const open = html.indexOf('{', start);
  let depth = 0;
  let inString = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(open, i + 1));
  }
  return null;
}

async function videoSize(id) {
  const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'Accept-Language': 'en',
    },
  });
  const player = extractJson(await res.text(), 'ytInitialPlayerResponse');
  const data = player?.streamingData ?? {};
  const formats = [...(data.formats ?? []), ...(data.adaptiveFormats ?? [])].filter((f) => f.width && f.height);
  if (!formats.length) return null;
  // The largest file; every file of a video has the same shape.
  const best = formats.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  return { width: best.width, height: best.height };
}

const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
let changed = 0;

for (const file of files) {
  const path = `${dir}/${file}`;
  const text = await readFile(path, 'utf8');
  const block = text.match(/\nvideo:\n((?: {2}.*\n)+)/);
  if (!block) continue;
  const id = block[1].match(/youtube: "([^"]+)"/)?.[1];
  const current = block[1].match(/aspect: "([^"]+)"/)?.[1] ?? DEFAULT;
  const name = file.replace(/\.md$/, '');

  const size = await videoSize(id).catch(() => null);
  if (!size) {
    console.log(`?  ${name}: couldn't read the video size from YouTube (${id})`);
    continue;
  }
  const actual = ratio(size.width, size.height);
  if (actual === current) {
    console.log(`ok ${name}: ${actual} (${size.width}×${size.height})`);
    continue;
  }

  console.log(`!! ${name}: file says ${current}, video is ${actual} (${size.width}×${size.height})`);
  if (!write) continue;
  let lines = block[1].replace(/ {2}aspect: "[^"]*"\n/, '');
  if (actual !== DEFAULT) lines = lines.replace(/( {2}youtube: "[^"]*"\n)/, `$1  aspect: "${actual}"\n`);
  await writeFile(path, text.replace(block[1], lines));
  changed++;
}

if (write) console.log(`\n${changed} file(s) updated.`);
else console.log('\nRun with --write to fix the files marked !!.');
