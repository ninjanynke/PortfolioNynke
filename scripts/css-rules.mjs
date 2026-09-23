// Print every rule in the archived Webflow stylesheet that mentions any of
// the given selectors, grouped by media query. Reference tool for the rebuild.
//
//   node scripts/css-rules.mjs .footer .footer-heading '#w-node-_1b15985f'

import { readFile, readdir } from 'node:fs/promises';

const dir = 'reference/webflow';
const file = (await readdir(dir)).find((f) => f.endsWith('.css'));
const css = (await readFile(`${dir}/${file}`, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const wanted = process.argv.slice(2);

// Minimal parser: top-level rules and one level of @media nesting.
function* rules(text, media = '') {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) return;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    for (; j < text.length && depth; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
    }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@media')) yield* rules(body, head);
    else if (!head.startsWith('@')) yield { media, selector: head, body: body.trim() };
    i = j;
  }
}

const matches = (sel) =>
  wanted.some((w) => sel.split(',').some((part) => new RegExp(`${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(part)));

let current = null;
for (const r of rules(css)) {
  if (!matches(r.selector)) continue;
  if (r.media !== current) { current = r.media; console.log(`\n/* ${current || 'base'} */`); }
  console.log(`${r.selector} {\n  ${r.body.split(';').map((d) => d.trim()).filter(Boolean).join(';\n  ')};\n}`);
}
