import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const concepts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/concepts" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    domain: z.enum(["backend", "frontend", "ui", "gamedev", "security"]),
    layer: z.string(),
    layerName: z.string(),
    summary: z.string(),
    difficulty: z.number().min(1).max(5),
    status: z.enum(["published", "stub"]),
    resources: z
      .array(
        z.object({
          type: z.string(),
          title: z.string(),
          url: z.string().url(),
          free: z.boolean().default(true),
        }),
      )
      .default([]),
  }),
});

export const collections = { concepts };
