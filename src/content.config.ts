// src/content.config.ts
//
// This is the replacement for Webflow's CMS field editor. Every Markdown file
// in src/content is validated against these schemas at build time — a typo in
// a category slug or a missing cover image fails the build instead of quietly
// rendering a broken page.
//
// Astro 5 and 6. (On Astro 4 this file lives at src/content/config.ts and uses
// `defineCollection({ type: 'content' })` instead of a loader.)

import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const categorySlugs = [
  "program-outline",
  "design-outline",
  "naai-outline",
  "flower-outline",
] as const;

const categories = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/categories" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      label: z.string(),
      order: z.number(),
      colour: z.string(),
      colourLight: z.string().optional(),
      logo: image().optional(),
      logoHover: image().optional(),
      lottie: z.string().optional(),
      next: z.enum(categorySlugs).optional(),
      previous: z.enum(categorySlugs).optional(),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),

      // `reference` ties this to the categories collection, so a slug that
      // doesn't exist is a build error rather than a 404 at runtime.
      category: reference("categories").optional(),

      type: z.string().optional(),
      tags: z.array(z.string()).default([]),
      skills: z.array(z.string()).default([]),

      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),

      featured: z.boolean().default(false),
      featuredTag: z.string().optional(),

      // image() gives Astro the original file so it can resize, convert to
      // webp/avif and emit width/height. This is the main thing you were
      // getting from Webflow's CDN, and it happens at build time for free.
      cover: image().optional(),
      draft: z.boolean().default(false),

      gallery: z.array(image()).default([]),
      galleryCaption: z.string().optional(),

      methodPair: z
        .array(z.object({ src: image(), caption: z.string().optional() }))
        .max(2)
        .default([]),

      video: z
        .object({ youtube: z.string(), caption: z.string().optional() })
        .optional(),
    }),
});

export const collections = { projects, categories };
