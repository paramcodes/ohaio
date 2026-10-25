import catalogueData from "@/data/catalogue.json";
import cardsData from "@/data/cards.json";
import publishedData from "@/data/published.json";
import { DOMAIN_META, type DomainId, type DomainMeta } from "./domains";
import {
  statusRank,
  type ConceptFormat,
  type ConceptStatus,
} from "./status";

export { DOMAIN_META, DOMAIN_ORDER, isDomainId } from "./domains";
export type { DomainId, DomainMeta } from "./domains";
export {
  FORMAT_LABEL,
  STATUS_ORDER,
  isIndexable,
  isPublished,
  isReadable,
  statusLabel,
} from "./status";
export type { ConceptFormat, ConceptStatus } from "./status";

export interface ConceptCard {
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

export interface Layer {
  id: string;
  number: string;
  name: string;
  description: string;
  concepts: ConceptCard[];
}

export interface Domain {
  id: DomainId;
  name: string;
  jp: string;
  tagline: string;
  description: string;
  layers: Layer[];
  conceptCount: number;
  layerCount: number;
  publishedCount: number;
  inReviewCount: number;
}

export const catalogue = catalogueData as unknown as { domains: Domain[] };
export const cards = cardsData as unknown as ConceptCard[];
export const cardBySlug = new Map(cards.map((card) => [card.slug, card]));

export const publishedSlugs = new Set(publishedData.slugs);

export const stats = {
  concepts: cards.length,
  domains: catalogue.domains.length,
  layers: catalogue.domains.reduce((sum, domain) => sum + domain.layerCount, 0),
  fieldNotes: cards.filter((card) => card.status === "published").length,
  inReview: cards.filter((card) => card.status === "in-review").length,
  sources: cards.reduce((sum, card) => sum + card.sourceCount, 0),
};

export const publishedCards = cards.filter((card) => card.status === "published");
export const inReviewCards = cards.filter((card) => card.status === "in-review");

export const featured =
  publishedCards[0] ?? inReviewCards[0] ?? cardBySlug.get("lost-update") ?? cards[0];

export function getDomain(id: string): Domain | undefined {
  return catalogue.domains.find((domain) => domain.id === id);
}

export function domainMeta(id: DomainId): DomainMeta {
  return DOMAIN_META[id];
}

export function conceptIndex(slug: string): number {
  return cards.findIndex((card) => card.slug === slug);
}

export function neighbours(slug: string) {
  const index = conceptIndex(slug);
  if (index === -1) return { previous: undefined, next: undefined };
  return {
    previous: index > 0 ? cards[index - 1] : undefined,
    next: index < cards.length - 1 ? cards[index + 1] : undefined,
  };
}

export function relatedTo(card: ConceptCard, limit = 4): ConceptCard[] {
  const sameLayer = cards.filter(
    (candidate) =>
      candidate.slug !== card.slug &&
      candidate.domain === card.domain &&
      candidate.layer === card.layer,
  );
  if (sameLayer.length >= limit) return sameLayer.slice(0, limit);
  const sameDomain = cards.filter(
    (candidate) =>
      candidate.slug !== card.slug &&
      candidate.domain === card.domain &&
      candidate.layer !== card.layer,
  );
  return [...sameLayer, ...sameDomain].slice(0, limit);
}

export function difficultyLabel(value: number): string {
  return ["", "Approach", "Everyday", "Working", "Deep", "Specialist"][value] ?? "Working";
}

export function searchConcepts(query: string, limit = 10): ConceptCard[] {
  const q = query.trim().toLowerCase();
  const pool = cards.filter((card) => card.status !== "archived");
  if (!q) {
    return [...pool]
      .sort((a, b) => {
        const rank = statusRank(a.status) - statusRank(b.status);
        if (rank !== 0) return rank;
        return a.title.localeCompare(b.title);
      })
      .slice(0, limit);
  }

  const scored = pool
    .map((card) => {
      const title = card.title.toLowerCase();
      const layer = card.layerName.toLowerCase();
      const summary = card.summary.toLowerCase();
      let score = 0;
      if (title === q) score += 200;
      if (title.startsWith(q)) score += 120;
      if (title.includes(q)) score += 80;
      if (layer.includes(q)) score += 35;
      if (summary.includes(q)) score += 20;
      if (card.domainName.toLowerCase().includes(q)) score += 10;
      if (card.status === "published") score += 8;
      else if (card.status === "in-review") score += 4;
      return { card, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        statusRank(a.card.status) - statusRank(b.card.status) ||
        a.card.title.localeCompare(b.card.title),
    );

  return scored.slice(0, limit).map((entry) => entry.card);
}
