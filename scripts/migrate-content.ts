import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { DOMAIN_META, DOMAIN_ORDER, type DomainId } from "../src/lib/domains";
import type { ConceptFormat } from "../src/lib/status";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content/concepts");
const ARCHIVE_DIR = path.join(ROOT, "docs/archive/legacy-md");
const MERGED_DIR = path.join(ROOT, "docs/archive/merged-concepts");
const TAXONOMY_PATH = path.join(ROOT, "src/data/taxonomy.json");
const TODAY = "2026-10-24";

interface Card {
  slug: string;
  title: string;
  summary: string;
  domain: DomainId;
  domainName: string;
  layer: string;
  layerName: string;
  status: "published" | "stub";
  difficulty: number;
}

interface LegacyLayer {
  id: string;
  number: string;
  name: string;
  description: string;
  concepts: Card[];
}

interface LegacyDomain {
  id: DomainId;
  name: string;
  description: string;
  layers: LegacyLayer[];
}

interface ConceptRecord {
  title: string;
  domain: DomainId;
  layer: string;
  difficulty: number;
  format: ConceptFormat;
  priority: "P0" | "P1" | "P2";
  aliases: string[];
  redirectFrom: string[];
}

interface TaxonomyLayer {
  id: string;
  number: string;
  name: string;
  description: string;
  concepts: string[];
}

interface TaxonomyDomain {
  id: DomainId;
  name: string;
  jp: string;
  tagline: string;
  description: string;
  layers: TaxonomyLayer[];
}

interface Taxonomy {
  version: number;
  updated: string;
  domains: TaxonomyDomain[];
  concepts: Record<string, ConceptRecord>;
}

const MERGES: Record<string, string> = {
  saga: "saga-pattern",
  "canary-release": "canary-deployment",
  "draw-call": "draw-calls",
  "navigation-mesh": "navmesh",
  lod: "level-of-detail",
  "hover-feedback": "hover",
};

const TITLE_OVERRIDES: Record<string, string> = {
  csr: "Client-side rendering (CSR)",
  csrf: "Cross-site request forgery (CSRF)",
  ssrf: "Server-side request forgery (SSRF)",
  component: "ECS component",
  level: "Game level",
  poi: "Points of interest (POI)",
  map: "Game map",
  batching: "Batching (rendering)",
  "continuous-batching": "Continuous batching (inference)",
  focus: "Focus state",
  oomkilled: "OOMKilled (Kubernetes)",
  "level-of-detail": "Level of detail (LOD)",
  navmesh: "NavMesh",
  "draw-calls": "Draw calls",
  hover: "Hover",
  "saga-pattern": "Saga pattern",
  "canary-deployment": "Canary deployment",
  "transactional-outbox": "Transactional outbox",
  "n1-query-problem": "N+1 query problem",
  "n1-service-calls": "N+1 service calls",
  "idempotency-key": "Idempotency key",
  "time-wait": "TIME_WAIT",
  "close-wait": "CLOSE_WAIT",
  "stale-while-revalidate": "stale-while-revalidate",
  "red-method": "RED method",
  "use-method": "USE method",
  "oom-killer": "OOM killer",
  "pagedattention": "PagedAttention",
  "lsm-tree": "LSM tree",
  "wasm": "WebAssembly (Wasm)",
  "webgpu": "WebGPU",
  "webgl": "WebGL",
  "gltf": "glTF",
  "pbr": "Physically based rendering (PBR)",
  "ecs": "Entity-component-system (ECS)",
  "rsc-payload": "RSC payload",
  "srcset": "srcset",
  "indexeddb": "IndexedDB",
  "localstorage": "localStorage",
  "bfcache": "bfcache",
  "abortcontroller": "AbortController",
  "shadcnui": "shadcn/ui",
  "sql-injection": "SQL injection",
  "xss": "Cross-site scripting (XSS)",
  "dom-xss": "DOM-based XSS",
};

const LAYER_NAME_OVERRIDES: Record<string, string> = {
  "latency-where-backend-engineering-gets-serious": "Latency",
  "query-performance-things-people-discover-the-hard-way": "Query performance",
  "caching-far-deeper-than-use-redis": "Caching beyond Redis",
  "rate-limiting-deeper-than-100-requestsminute": "Rate limiting",
  "debugging-tools-techniques-people-eventually-learn": "Debugging tools",
  "particularly-nasty-production-only-phenomena": "Production-only phenomena",
  "architecture-concepts-that-become-important-at-scale": "Architecture at scale",
  "software-testing-beyond-unitintegration-tests": "Testing beyond unit tests",
  "security-things-backend-engineers-eventually-encounter": "Backend security",
  "data-correctness-event-driven-systems": "Data correctness",
  "api-gateway-microservice-specific-problems": "API gateway problems",
  "storage-hardware-performance": "Storage hardware",
  "build-systems-cicd-internals": "Build systems and CI/CD",
  "modern-ai-servingbackend-infrastructure": "Modern AI-serving infrastructure",
  "distributed-observability-much-deeper": "Distributed observability",
  "sre-incident-response-jargon": "SRE and incident response",
  "clientserver-state-caching": "Client/server state and caching",
  "nextjs-modern-routing-internals": "Next.js and modern routing",
  "react-compiler-memoization": "React Compiler and memoization",
  "state-management-much-deeper-than-redux": "State management",
  "accessibility-as-engineering-constraints": "Accessibility constraints",
  "the-foundational-game-dev-vocabulary": "Foundational vocabulary",
  "the-large-game-performance-vocabulary": "Large-game performance",
  "the-game-loop": "The game loop",
  "uihud-game-vocabulary": "UI and HUD",
  "game-architecture-vocabulary": "Game architecture",
  "level-design-vocabulary": "Level design",
  "open-world-vocabulary": "Open world",
  "game-feel-vocabulary": "Game feel",
  "lod": "Level of detail",
  "web-specific-game-technology": "Web game technology",
  "principle": "Principles",
  "prompting": "Patterns",
};

const P0 = new Set([
  "cache-stampede",
  "retry-storm",
  "circuit-breaker",
  "backpressure",
  "write-skew",
  "idempotency",
  "transactional-outbox",
  "hydration",
  "layout-thrashing",
  "long-task",
  "query-cache",
  "code-splitting",
  "focus-management",
  "easing",
  "command-palette",
  "popover",
  "container-query",
  "skeleton",
  "game-loop",
  "fixed-timestep",
  "aabb",
  "navmesh",
  "level-of-detail",
  "draw-calls",
  "object-pooling",
  "sql-injection",
  "xss",
  "csrf",
  "ssrf",
  "binary-exploitation",
]);

const P1_EXTRA = new Set([
  "bulkhead-pattern",
  "lost-update",
  "fencing-tokens",
  "request-waterfall",
  "main-thread-blocking",
  "optimistic-update",
  "core-web-vitals",
  "hover",
  "focus",
  "spring",
  "scroll-snap",
  "shared-element-transition",
  "client-prediction",
  "interest-management",
  "instancing",
  "scene-graph",
  "pcap-analysis",
  "malware-analysis",
  "reverse-engineering",
]);

const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await fs.readFile(file, "utf8")) as T;

const cleanLayerDescription = (description: string, name: string) => {
  const stripped = description
    .replace(/\s+—\s+the .*? concepts worth knowing.*$/i, "")
    .trim();
  if (!stripped || stripped === name) {
    return `Concepts that belong together under ${name.toLowerCase()} in this domain.`;
  }
  return stripped;
};

const frontmatter = (data: Record<string, unknown>) => {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${JSON.stringify(item)}`);
      }
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
};

const escapeMdxProse = (body: string) => {
  const lines = body.split("\n");
  let fenced = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      let next = "";
      let inCode = false;
      for (const char of line) {
        if (char === "`") inCode = !inCode;
        if (!inCode && char === "{") next += "&#123;";
        else if (!inCode && char === "}") next += "&#125;";
        else if (!inCode && char === "<") next += "&lt;";
        else next += char;
      }
      return next;
    })
    .join("\n");
};

const scaffoldBody = (concept: ConceptRecord, layerName: string) => `> **Scaffolded entry.** The title and its place in the taxonomy are set. The researched field note has not been written yet.

## What this entry will cover

- A working definition of ${concept.title} and the problem it names
- A concrete example or failure mode
- Where the concept sits relative to the rest of ${layerName}
- Sources worth reading, with links

## Why it is on the map

${concept.title} belongs to the ${layerName} layer of ${DOMAIN_META[concept.domain].name}. This page is queued for research and review, and it is marked \`noindex\` until the note is finished.

Until then, the layer page lists the entries around it.
`;

const legacyToSource = (resource: {
  type: string;
  title: string;
  url: string;
  free?: boolean;
}) => ({
  kind: resource.type === "docs" ? "docs" : "article",
  title: resource.title,
  url: resource.url,
  role: "supporting",
  free: resource.free ?? true,
  accessed: TODAY,
});

async function main() {
  const catalogue = await readJson<{ domains: LegacyDomain[] }>(
    path.join(ROOT, "src/data/catalogue.json"),
  );

  const legacyTitles = new Map<string, string>();
  const legacySummaries = new Map<string, string>();
  const legacyLayers = new Map<string, { name: string; description: string }>();
  const legacyDomains = new Map<DomainId, { description: string; name: string }>();
  const cards = new Map<string, Card>();

  for (const domain of catalogue.domains) {
    legacyDomains.set(domain.id, {
      name: domain.name,
      description: domain.description,
    });
    for (const layer of domain.layers) {
      legacyLayers.set(`${domain.id}:${layer.id}`, {
        name: layer.name,
        description: layer.description,
      });
      for (const card of layer.concepts) {
        cards.set(card.slug, card);
        legacyTitles.set(card.slug, card.title);
        legacySummaries.set(card.slug, card.summary);
      }
    }
  }

  const taxonomy: Taxonomy = {
    version: 1,
    updated: TODAY,
    domains: [],
    concepts: {},
  };

  const canonicalSlugs = new Set<string>();
  const mergedSlugs = new Set(Object.keys(MERGES));

  for (const domainId of DOMAIN_ORDER) {
    const legacyDomain = catalogue.domains.find((item) => item.id === domainId);
    if (!legacyDomain) continue;
    const meta = DOMAIN_META[domainId];
    const taxonomyDomain: TaxonomyDomain = {
      id: domainId,
      name: meta.name,
      jp: meta.jp,
      tagline: meta.tagline,
      description: legacyDomains.get(domainId)?.description ?? meta.tagline,
      layers: [],
    };

    for (const legacyLayer of legacyDomain.layers) {
      const kept = legacyLayer.concepts
        .map((card) => card.slug)
        .filter((slug) => !mergedSlugs.has(slug));

      const layerName =
        LAYER_NAME_OVERRIDES[legacyLayer.id] ?? legacyLayer.name;

      const concepts: string[] = [];
      for (const slug of kept) {
        const card = cards.get(slug);
        if (!card) continue;
        canonicalSlugs.add(slug);
        concepts.push(slug);
        const redirectFrom = Object.entries(MERGES)
          .filter(([, target]) => target === slug)
          .map(([source]) => source);
        const isLegacyPublished = card.status === "published";
        taxonomy.concepts[slug] = {
          title: TITLE_OVERRIDES[slug] ?? card.title,
          domain: card.domain,
          layer: legacyLayer.id,
          difficulty: card.difficulty,
          format: isLegacyPublished ? "field-note" : "standard",
          priority: P0.has(slug) ? "P0" : P1_EXTRA.has(slug) || isLegacyPublished ? "P1" : "P2",
          aliases: redirectFrom,
          redirectFrom,
        };
      }

      if (concepts.length === 0) continue;

      taxonomyDomain.layers.push({
        id: legacyLayer.id,
        number: legacyLayer.number,
        name: layerName,
        description: cleanLayerDescription(legacyLayer.description, layerName),
        concepts,
      });
    }

    taxonomy.domains.push(taxonomyDomain);
  }

  for (const merged of mergedSlugs) {
    if (canonicalSlugs.has(merged)) {
      throw new Error(`Merged slug ${merged} is also canonical`);
    }
  }

  await fs.mkdir(path.dirname(TAXONOMY_PATH), { recursive: true });
  await fs.writeFile(
    TAXONOMY_PATH,
    `${JSON.stringify(taxonomy, null, 2)}\n`,
    "utf8",
  );

  const files = await fs.readdir(CONTENT_DIR);
  const legacy = new Map<string, { data: Record<string, unknown>; body: string }>();
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    const parsed = matter(raw);
    legacy.set(slug, {
      data: parsed.data as Record<string, unknown>,
      body: parsed.content.trim(),
    });
  }

  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.mkdir(MERGED_DIR, { recursive: true });

  let written = 0;
  for (const domain of taxonomy.domains) {
    for (const layer of domain.layers) {
      for (const slug of layer.concepts) {
        const concept = taxonomy.concepts[slug];
        const source = legacy.get(slug);
        const layerMeta = legacyLayers.get(`${concept.domain}:${concept.layer}`);
        const layerName = layer.name || layerMeta?.name || concept.layer;
        const isLegacyPublished =
          source?.data.status === "published" && concept.format === "field-note";

        const summary = isLegacyPublished
          ? (source?.data.summary as string) ?? `A field note about ${concept.title}.`
          : `A scaffolded entry for ${concept.title}, filed under ${layerName}. The sourced field note is queued.`;

        const sources = Array.isArray(source?.data.resources)
          ? (source.data.resources as Array<{
              type: string;
              title: string;
              url: string;
              free?: boolean;
            }>).map(legacyToSource)
          : [];

        const body = isLegacyPublished
          ? escapeMdxProse(source?.body ?? "")
          : scaffoldBody(concept, layerName);

        const data: Record<string, unknown> = {
          summary,
          status: isLegacyPublished ? "in-review" : "scaffold",
          format: concept.format,
          updated: TODAY,
          sources,
        };

        const output = `${frontmatter(data)}${body}\n`;
        await fs.writeFile(path.join(CONTENT_DIR, `${slug}.mdx`), output, "utf8");
        written += 1;
      }
    }
  }

  for (const [slug, parsed] of legacy) {
    const target = mergedSlugs.has(slug) ? MERGED_DIR : ARCHIVE_DIR;
    await fs.writeFile(
      path.join(target, `${slug}.md`),
      matter.stringify(parsed.body, parsed.data),
      "utf8",
    );
    await fs.unlink(path.join(CONTENT_DIR, `${slug}.md`));
  }

  console.log(
    `Migrated ${written} entries. ${mergedSlugs.size} merged files archived to docs/archive/merged-concepts.`,
  );
}

await main();
