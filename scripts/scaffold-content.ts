import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { DOMAIN_META, type DomainId } from "../src/lib/domains";
import type { ConceptFormat } from "../src/lib/status";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content/concepts");
const TAXONOMY_PATH = path.join(ROOT, "src/data/taxonomy.json");
const TODAY = new Date().toISOString().slice(0, 10);

interface ConceptRecord {
  title: string;
  domain: DomainId;
  layer: string;
  difficulty: number;
  format: ConceptFormat;
  priority: string;
}

interface Taxonomy {
  domains: Array<{
    id: DomainId;
    layers: Array<{ id: string; name: string; concepts: string[] }>;
  }>;
  concepts: Record<string, ConceptRecord>;
}

const frontmatter = (data: Record<string, unknown>) => {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${JSON.stringify(item)}`);
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
};

async function main() {
  const taxonomy = JSON.parse(
    await fs.readFile(TAXONOMY_PATH, "utf8"),
  ) as Taxonomy;
  const files = new Set(
    (await fs.readdir(CONTENT_DIR))
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.slice(0, -4)),
  );

  const exitCodes = [];
  for (const domain of taxonomy.domains) {
    for (const layer of domain.layers) {
      for (const slug of layer.concepts) {
        if (files.has(slug)) continue;
        const concept = taxonomy.concepts[slug];
        const layerName = layer.name;
        const body = `> **Scaffolded entry.** The title and its place in the taxonomy are set. The researched field note has not been written yet.

## What this entry will cover

- A working definition of ${concept.title} and the problem it names
- A concrete example or failure mode
- Where the concept sits relative to the rest of ${layerName}
- Sources worth reading, with links

## Why it is on the map

${concept.title} belongs to the ${layerName} layer of ${DOMAIN_META[concept.domain].name}. This page is queued for research and review, and it is marked \`noindex\` until the note is finished.

Until then, the layer page lists the entries around it.
`;
        const data = {
          summary: `A scaffolded entry for ${concept.title}, filed under ${layerName}. The sourced field note is queued.`,
          status: "scaffold",
          format: concept.format,
          updated: TODAY,
          sources: [],
        };
        await fs.writeFile(
          path.join(CONTENT_DIR, `${slug}.mdx`),
          `${frontmatter(data)}${body}`,
          "utf8",
        );
        exitCodes.push(slug);
      }
    }
  }

  if (exitCodes.length === 0) {
    console.log("No missing entries. Taxonomy and content are in sync.");
    return;
  }
  console.log(`Scaffolded ${exitCodes.length} entries: ${exitCodes.join(", ")}`);
}

await main();
