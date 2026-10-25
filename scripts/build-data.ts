import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  DOMAIN_META,
  DOMAIN_ORDER,
  type DomainId,
} from "../src/lib/domains";
import {
  statusRank,
  type ConceptFormat,
  type ConceptStatus,
} from "../src/lib/status";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content/concepts");
const DATA_DIR = path.join(ROOT, "src/data");
const TAXONOMY_PATH = path.join(DATA_DIR, "taxonomy.json");

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

interface Frontmatter {
  summary: string;
  status: ConceptStatus;
  format: ConceptFormat;
  updated: string;
  reviewed?: string;
  sources?: Array<Record<string, unknown>>;
}

interface Card {
  slug: string;
  title: string;
  summary: string;
  domain: DomainId;
  domainName: string;
  layer: string;
  layerName: string;
  status: ConceptStatus;
  difficulty: number;
  url: string;
  format: ConceptFormat;
  priority: "P0" | "P1" | "P2";
  updated: string;
  reviewed?: string;
  sourceCount: number;
}

interface GraphNode {
  id: string;
  label: string;
  jp?: string;
  type: "domain" | "layer" | "concept";
  domain: string;
  layer: string;
  layerName?: string;
  status: ConceptStatus;
  url: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await fs.readFile(file, "utf8")) as T;

const writeJson = async (file: string, value: unknown) => {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
};

async function readFrontmatter() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((file) =>
    file.endsWith(".mdx"),
  );
  const entries = new Map<string, Frontmatter>();
  for (const file of files) {
    const slug = file.slice(0, -4);
    const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    const parsed = matter(raw);
    entries.set(slug, parsed.data as Frontmatter);
  }
  return entries;
}

function domainBestStatus(cards: Card[]): ConceptStatus {
  return cards.reduce<ConceptStatus>(
    (best, card) => (statusRank(card.status) < statusRank(best) ? card.status : best),
    "scaffold",
  );
}

async function main() {
  const taxonomy = await readJson<Taxonomy>(TAXONOMY_PATH);
  const frontmatter = await readFrontmatter();

  const missingContent = Object.keys(taxonomy.concepts).filter(
    (slug) => !frontmatter.has(slug),
  );
  if (missingContent.length > 0) {
    throw new Error(
      `Missing content files for: ${missingContent.join(", ")}. Run npm run content:scaffold.`,
    );
  }

  const orphanContent = [...frontmatter.keys()].filter(
    (slug) => !taxonomy.concepts[slug],
  );
  if (orphanContent.length > 0) {
    throw new Error(
      `Content files missing from taxonomy: ${orphanContent.join(", ")}`,
    );
  }

  const cards: Card[] = [];
  const cardBySlug = new Map<string, Card>();
  const catalogue = {
    domains: [] as Array<{
      id: DomainId;
      name: string;
      jp: string;
      tagline: string;
      description: string;
      layers: Array<{
        id: string;
        number: string;
        name: string;
        description: string;
        concepts: Card[];
      }>;
      conceptCount: number;
      layerCount: number;
      publishedCount: number;
      inReviewCount: number;
    }>,
  };

  for (const domain of taxonomy.domains) {
    const meta = DOMAIN_META[domain.id];
    const domainEntry = {
      id: domain.id,
      name: meta.name,
      jp: meta.jp,
      tagline: meta.tagline,
      description: domain.description,
      layers: [] as Array<{
        id: string;
        number: string;
        name: string;
        description: string;
        concepts: Card[];
      }>,
      conceptCount: 0,
      layerCount: 0,
      publishedCount: 0,
      inReviewCount: 0,
    };

    for (const layer of domain.layers) {
      const layerCards: Card[] = [];
      for (const slug of layer.concepts) {
        const concept = taxonomy.concepts[slug];
        const front = frontmatter.get(slug);
        if (!front) continue;
        const card: Card = {
          slug,
          title: concept.title,
          summary: front.summary,
          domain: domain.id,
          domainName: meta.name,
          layer: layer.id,
          layerName: layer.name,
          status: front.status,
          difficulty: concept.difficulty,
          url: `/concepts/${slug}`,
          format: front.format ?? concept.format,
          priority: concept.priority,
          updated: front.updated,
          reviewed: front.reviewed,
          sourceCount: front.sources?.length ?? 0,
        };
        layerCards.push(card);
        cards.push(card);
        cardBySlug.set(slug, card);
      }

      domainEntry.layers.push({
        id: layer.id,
        number: layer.number,
        name: layer.name,
        description: layer.description,
        concepts: layerCards,
      });
      domainEntry.conceptCount += layerCards.length;
      domainEntry.publishedCount += layerCards.filter(
        (card) => card.status === "published",
      ).length;
      domainEntry.inReviewCount += layerCards.filter(
        (card) => card.status === "in-review",
      ).length;
    }

    domainEntry.layerCount = domainEntry.layers.length;
    catalogue.domains.push(domainEntry);
  }

  const orderedDomains = DOMAIN_ORDER.map((id) =>
    catalogue.domains.find((domain) => domain.id === id),
  ).filter((domain): domain is NonNullable<typeof domain> => Boolean(domain));
  catalogue.domains = orderedDomains;

  const published = cards.filter((card) => card.status === "published");

  await writeJson(path.join(DATA_DIR, "cards.json"), cards);
  await writeJson(path.join(DATA_DIR, "catalogue.json"), catalogue);
  await writeJson(
    path.join(DATA_DIR, "palette.json"),
    cards.map((card) => ({
      title: card.title,
      summary: card.summary,
      domain: card.domainName,
      url: card.url,
      status: card.status,
    })),
  );
  await writeJson(path.join(DATA_DIR, "published.json"), {
    updated: new Date().toISOString().slice(0, 10),
    slugs: published.map((card) => card.slug),
    urls: published.map((card) => card.url),
  });

  let previousGraph: { nodes?: GraphNode[]; edges?: GraphEdge[] } = {};
  try {
    previousGraph = await readJson(path.join(DATA_DIR, "graph.json"));
  } catch {
    previousGraph = {};
  }
  const previousNodes = new Map(
    (previousGraph.nodes ?? []).map((node) => [node.id, node]),
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const conceptCoords = new Map<string, { x: number; y: number }>();

  const domainPosition = (domain: DomainId, index: number) => {
    const previous = previousNodes.get(`domain:${domain}`);
    if (previous) return { x: previous.x, y: previous.y };
    return { x: 420 + index * 280, y: 520 };
  };

  taxonomy.domains.forEach((domain, domainIndex) => {
    const meta = DOMAIN_META[domain.id];
    const position = domainPosition(domain.id, domainIndex);
    nodes.push({
      id: `domain:${domain.id}`,
      label: meta.name,
      jp: meta.jp,
      type: "domain",
      domain: domain.id,
      layer: "",
      status: "published",
      url: `/domains/${domain.id}`,
      x: position.x,
      y: position.y,
      size: 22,
      color: meta.atlas,
    });

    domain.layers.forEach((layer, layerIndex) => {
      const layerCards = layer.concepts
        .map((slug) => cardBySlug.get(slug))
        .filter((card): card is Card => Boolean(card));

      const conceptPositions = layerCards
        .map((card) => previousNodes.get(`concept:${card.slug}`))
        .filter((node): node is GraphNode => Boolean(node));
      const previousLayer = previousNodes.get(
        `layer:${domain.id}:${layer.id}`,
      );

      let layerX: number;
      let layerY: number;
      if (previousLayer) {
        layerX = previousLayer.x;
        layerY = previousLayer.y;
      } else if (conceptPositions.length > 0) {
        layerX =
          conceptPositions.reduce((sum, node) => sum + node.x, 0) /
          conceptPositions.length;
        layerY =
          conceptPositions.reduce((sum, node) => sum + node.y, 0) /
          conceptPositions.length;
      } else {
        const angle =
          (hash(`${domain.id}:${layer.id}`) % 360) * (Math.PI / 180) +
          layerIndex * 0.35;
        const radius = 150 + (layerIndex % 3) * 60;
        layerX = position.x + Math.cos(angle) * radius;
        layerY = position.y + Math.sin(angle) * radius;
      }

      nodes.push({
        id: `layer:${domain.id}:${layer.id}`,
        label: layer.name,
        type: "layer",
        domain: domain.id,
        layer: layer.id,
        layerName: layer.name,
        status: domainBestStatus(layerCards),
        url: `/domains/${domain.id}#${layer.id}`,
        x: layerX,
        y: layerY,
        size: 8,
        color: meta.atlas,
      });
      edges.push({
        source: `domain:${domain.id}`,
        target: `layer:${domain.id}:${layer.id}`,
      });

      layerCards.forEach((card, conceptIndex) => {
        const previous = previousNodes.get(`concept:${card.slug}`);
        let x: number;
        let y: number;
        if (previous) {
          x = previous.x;
          y = previous.y;
        } else {
          const seed = hash(card.slug);
          const angle = ((seed % 360) * Math.PI) / 180;
          const radius = 28 + (seed % 34);
          x = layerX + Math.cos(angle) * radius;
          y = layerY + Math.sin(angle) * radius + conceptIndex * 0.01;
        }
        conceptCoords.set(card.slug, { x, y });
        nodes.push({
          id: `concept:${card.slug}`,
          label: card.title,
          type: "concept",
          domain: domain.id,
          layer: layer.id,
          layerName: layer.name,
          status: card.status,
          url: card.url,
          x,
          y,
          size: card.status === "published" ? 6.6 : 5.5,
          color: meta.atlas,
        });
        edges.push({
          source: `layer:${domain.id}:${layer.id}`,
          target: `concept:${card.slug}`,
        });
      });
    });
  });

  await writeJson(path.join(DATA_DIR, "graph.json"), { nodes, edges });

  console.log(
    `Generated ${cards.length} cards, ${nodes.length} graph nodes, ${published.length} published entries.`,
  );
}

await main();
