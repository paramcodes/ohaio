import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const source = z.object({
  kind: z.enum([
    "docs",
    "article",
    "video",
    "course",
    "book",
    "paper",
    "talk",
    "tool",
    "spec",
    "standard",
    "interactive",
  ]),
  title: z.string(),
  url: z.string().url(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  role: z.enum(["primary", "supporting", "reference"]).default("supporting"),
  free: z.boolean().default(true),
  accessed: z.string().optional(),
  archiveUrl: z.string().url().optional(),
});

const concepts = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/concepts" }),
  schema: z.object({
    summary: z.string(),
    status: z.enum([
      "scaffold",
      "draft",
      "in-review",
      "published",
      "stale",
      "archived",
    ]),
    format: z.enum(["field-note", "standard", "glossary"]),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sources: z.array(source).default([]),
    versionNotes: z.string().optional(),
  }),
});

export const collections = { concepts };
