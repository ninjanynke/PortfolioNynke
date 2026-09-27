// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

// https://astro.build/config
export default defineConfig({
  // The live address; nynkezwart.com redirects here.
  site: 'https://www.nynkezwart.com',
  markdown: {
    processor: satteri({
      // Keep punctuation exactly as written: the Webflow content mixes
      // straight and curly quotes, and smart quotes change how text renders.
      features: { smartPunctuation: false },
    }),
  },
});
