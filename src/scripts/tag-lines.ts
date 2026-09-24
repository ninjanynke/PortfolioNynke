// Splits a wrapped tag into one pill per line, so each line hugs its own
// words. The browser decides where the tag wraps; this reads which words
// ended up on which line and rebuilds the tag as separate lines, without
// the space at each break, so every line ends flush right. Lines touch, and
// corners that touch the neighbouring line are squared off: the right-hand
// ones always, a left-hand one when that line is the narrower of the two.
// Reruns when the tag's width changes. Without this script the tag stays a
// single inline pill that wraps (see ProjectCard.astro).

const SQUARE_CLASSES = ['sq-tl', 'sq-tr', 'sq-bl', 'sq-br'];

function layout(tag: HTMLElement) {
  const text = (tag.dataset.text ??= tag.textContent?.trim() ?? '');
  const words = text.split(/\s+/);

  // Probe: the plain wrapping version, one span per word.
  const probe = document.createElement('span');
  probe.className = 'card-tag-text';
  words.forEach((word, i) => {
    if (i > 0) probe.append(' ');
    const span = document.createElement('span');
    span.textContent = word;
    probe.append(span);
  });
  tag.replaceChildren(probe);

  const lines: string[][] = [];
  let lastTop: number | undefined;
  for (const span of probe.querySelectorAll('span')) {
    const top = Math.round(span.getBoundingClientRect().top);
    if (top !== lastTop) lines.push([]);
    lines[lines.length - 1].push(span.textContent ?? '');
    lastTop = top;
  }
  if (lines.length < 2) return; // one line: the probe already looks right

  const els = lines.map((line) => {
    const el = document.createElement('span');
    el.className = 'card-tag-line';
    el.textContent = line.join(' ');
    return el;
  });
  tag.replaceChildren(...els);
  tag.classList.add('is-split');

  const lefts = els.map((el) => el.getBoundingClientRect().left);
  els.forEach((el, i) => {
    el.classList.remove(...SQUARE_CLASSES);
    if (i > 0) {
      el.classList.add('sq-tr');
      if (lefts[i] >= lefts[i - 1] - 0.5) el.classList.add('sq-tl');
    }
    if (i < els.length - 1) {
      el.classList.add('sq-br');
      if (lefts[i] >= lefts[i + 1] - 0.5) el.classList.add('sq-bl');
    }
  });
}

export async function splitTagLines(selector: string) {
  const tags = document.querySelectorAll<HTMLElement>(selector);
  if (tags.length === 0) return;
  await document.fonts.ready;

  const relayout = (tag: HTMLElement) => {
    tag.classList.remove('is-split');
    layout(tag);
  };
  tags.forEach(relayout);

  // A tag's available width follows its card; relayout when that changes.
  const widths = new WeakMap<Element, number>();
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (widths.get(entry.target) === width) continue;
      widths.set(entry.target, width);
      entry.target.querySelectorAll<HTMLElement>(selector).forEach(relayout);
    }
  });
  new Set([...tags].map((tag) => tag.parentElement!)).forEach((box) => observer.observe(box));
}
