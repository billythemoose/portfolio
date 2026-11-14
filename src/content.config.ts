import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';

// Jekyll allowed `tags: a b c` (space-separated string), a YAML list, or nothing.
const wordList = z
  .union([z.string(), z.array(z.string()), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return [];
    const words = Array.isArray(value) ? value : value.split(/\s+/);
    return words.map((word) => word.trim()).filter(Boolean);
  });

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: wordList,
    categories: wordList,
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    // Newest first on the projects page.
    date: z.coerce.date(),
    repo: z.url().optional(),
    demo: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

const cvSection = z.discriminatedUnion('type', [
  z.object({
    title: z.string().trim(),
    type: z.literal('map'),
    contents: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
  z.object({
    title: z.string().trim(),
    type: z.literal('time_table'),
    contents: z.array(
      z.object({
        title: z.string(),
        institution: z.string().optional(),
        year: z.union([z.string(), z.number()]).transform(String),
        description: z.array(z.string()).default([]),
      }),
    ),
  }),
  z.object({
    title: z.string().trim(),
    type: z.literal('list'),
    // List items may contain inline HTML (e.g. <u>Languages:</u>).
    contents: z.array(z.string()),
  }),
]);

// The CV is a top-level YAML list of sections. The file loader needs a unique
// `id` per entry, so derive one from the section title and keep the order.
const cv = defineCollection({
  loader: file('src/content/cv.yml', {
    parser: (text) =>
      (parseYaml(text) as Array<Record<string, unknown>>).map((section, order) => ({
        ...section,
        id: String(section.title)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        order,
      })),
  }),
  schema: z.intersection(cvSection, z.object({ order: z.number() })),
});

export const collections = { blog, projects, cv };
