import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { DomainId } from "../src/lib/domains";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content/concepts");
const TAXONOMY_PATH = path.join(ROOT, "src/data/taxonomy.json");
const PATHS_PATH = path.join(ROOT, "src/data/paths.ts");

const STATUSES = new Set([
  "scaffold",
  "draft",
  "in-review",
  "published",
  "stale",
  "archived",
]);

const FORMATS = new Set(["field-note", "standard", "glossary"]);

const SOURCE_KINDS = new Set([
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
]);

const ROLES = new Set(["primary", "supporting", "reference"]);

interface TaxonomyConcept {
  title: string;
  domain: DomainId;
  layer: string;
  format: string;
  redirectFrom: string[];
}

interface Taxonomy {
  domains: Array<{
    id: DomainId;
    layers: Array<{ id: string; name: string; concepts: string[] }>;
  }>;
  concepts: Record<string, TaxonomyConcept>;
}

interface Source {
  kind?: string;
  title?: string;
  url?: string;
  role?: string;
  accessed?: string;
}

const issues: string[] = [];
const warnings: string[] = [];

const error = (message: string) => issues.push(`ERROR  ${message}`);
const warn = (message: string) => warnings.push(`WARN   ${message}`);

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const isIsoDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function main() {
  const taxonomy = JSON.parse(
    await fs.readFile(TAXONOMY_PATH, "utf8"),
  ) as Taxonomy;
  const files = (await fs.readdir(CONTENT_DIR)).filter((file) =>
    file.endsWith(".mdx"),
  );
  const slugs = new Set(files.map((file) => file.slice(0, -4)));

  const layerMap = new Map<string, { domain: DomainId; name: string; concepts: string[] }>();
  for (const domain of taxonomy.domains) {
    for (const layer of domain.layers) {
      layerMap.set(`${domain.id}:${layer.id}`, { domain: domain.id, ...layer });
      for (const slug of layer.concepts) {
        if (!taxonomy.concepts[slug]) {
          error(`Layer ${domain.id}/${layer.id} references unknown concept "${slug}"`);
        }
      }
    }
  }

  for (const [slug, concept] of Object.entries(taxonomy.concepts)) {
    if (!slugs.has(slug)) error(`Taxonomy concept "${slug}" has no content file`);
    if (!layerMap.has(`${concept.domain}:${concept.layer}`)) {
      error(`Concept "${slug}" points at missing layer ${concept.domain}/${concept.layer}`);
    }
    if (!FORMATS.has(concept.format)) {
      error(`Concept "${slug}" has unknown format "${concept.format}"`);
    }
  }
  for (const slug of slugs) {
    if (!taxonomy.concepts[slug]) {
      error(`Content file "${slug}.mdx" is not in taxonomy.json`);
    }
  }

  const titles = new Map<string, string[]>();
  for (const [slug, concept] of Object.entries(taxonomy.concepts)) {
    const key = normalize(concept.title);
    const list = titles.get(key) ?? [];
    list.push(slug);
    titles.set(key, list);
  }
  for (const [key, list] of titles) {
    if (list.length > 1) error(`Duplicate normalized title "${key}": ${list.join(", ")}`);
  }

  for (const [slug, concept] of Object.entries(taxonomy.concepts)) {
    for (const from of concept.redirectFrom) {
      if (taxonomy.concepts[from]) {
        error(`Redirect "${from}" for "${slug}" is also a canonical concept`);
      }
      if (slugs.has(from)) {
        error(`Redirect "${from}" for "${slug}" still has a content file`);
      }
    }
  }

  let publishedCount = 0;
  let inReviewCount = 0;
  let scaffoldCount = 0;

  for (const file of files) {
    const slug = file.slice(0, -4);
    const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const concept = taxonomy.concepts[slug];
    if (!concept) continue;

    if (typeof data.summary !== "string" || data.summary.length < 20) {
      error(`${slug}: summary must be at least 20 characters`);
    }
    if (typeof data.summary === "string" && data.summary.length > 320) {
      warn(`${slug}: summary is ${data.summary.length} characters (target: 20-320)`);
    }
    if (!STATUSES.has(String(data.status))) {
      error(`${slug}: status "${data.status}" is invalid`);
    }
    if (!FORMATS.has(String(data.format))) {
      error(`${slug}: format "${data.format}" is invalid`);
    }
    if (!isIsoDate(data.updated)) error(`${slug}: updated must be YYYY-MM-DD`);
    if (data.reviewed !== undefined && !isIsoDate(data.reviewed)) {
      error(`${slug}: reviewed must be YYYY-MM-DD`);
    }

    const sources = Array.isArray(data.sources) ? (data.sources as Source[]) : [];
    if (!Array.isArray(data.sources)) error(`${slug}: sources must be an array`);

    for (const [index, source] of sources.entries()) {
      const label = `${slug}: source ${index + 1}`;
      if (!SOURCE_KINDS.has(String(source.kind))) {
        error(`${label}: kind "${source.kind}" is invalid`);
      }
      if (!source.title) error(`${label}: title is required`);
      if (!source.url || !/^https?:\/\//.test(source.url)) {
        error(`${label}: url must be absolute http(s)`);
      }
      if (!ROLES.has(String(source.role))) {
        error(`${label}: role "${source.role}" is invalid`);
      }
      if (!isIsoDate(source.accessed)) {
        warn(`${label}: accessed date is missing or invalid`);
      }
    }

    if (data.status === "published") {
      publishedCount += 1;
      if (sources.length < 3) error(`${slug}: published notes need at least 3 sources`);
      if (!sources.some((source) => source.role === "primary")) {
        error(`${slug}: published notes need at least one primary source`);
      }
      if (!isIsoDate(data.reviewed)) {
        error(`${slug}: published notes need a reviewed date`);
      }
      if (data.format !== "field-note") {
        warn(`${slug}: published entries should usually use format "field-note"`);
      }
      if (String(data.summary).includes("scaffolded entry")) {
        error(`${slug}: published note still has a scaffold summary`);
      }
      if (parsed.content.includes("Scaffolded entry")) {
        error(`${slug}: published note still has a scaffold body`);
      }
    } else if (data.status === "in-review") {
      inReviewCount += 1;
      if (sources.length === 0) {
        warn(`${slug}: in-review note has no sources to verify`);
      }
    } else if (data.status === "scaffold") {
      scaffoldCount += 1;
      if (sources.length > 0) {
        warn(`${slug}: scaffold has sources; consider moving it to draft`);
      }
      if (!parsed.content.includes("Scaffolded entry")) {
        warn(`${slug}: scaffold is missing the scaffold notice`);
      }
    }
  }

  let pathsSource = "";
  try {
    pathsSource = await fs.readFile(PATHS_PATH, "utf8");
  } catch {
    warn("paths.ts could not be read");
  }
  for (const match of pathsSource.matchAll(/slug:\s*"([^"]+)",\s*\n\s*why:/g)) {
    const slug = match[1];
    if (!taxonomy.concepts[slug]) {
      error(`paths.ts references missing concept "${slug}"`);
    }
  }

  console.log(
    `Content: ${files.length} files — ${publishedCount} published, ${inReviewCount} in review, ${scaffoldCount} scaffolded.`,
  );

  for (const warning of warnings) console.log(warning);
  for (const issue of issues) console.log(issue);

  if (issues.length > 0) {
    console.error(`\n${issues.length} error(s), ${warnings.length} warning(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`No errors. ${warnings.length} warning(s).`);
}

await main();
