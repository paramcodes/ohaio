import catalogueData from "@/data/catalogue.json";
import cardsData from "@/data/cards.json";

export type DomainId = "backend" | "frontend" | "ui" | "gamedev" | "security";
export type ConceptStatus = "published" | "stub";

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
}

export const catalogue = catalogueData as { domains: Domain[] };
export const cards = cardsData as ConceptCard[];
export const cardBySlug = new Map(cards.map((card) => [card.slug, card]));

export const DOMAIN_ORDER: DomainId[] = [
  "backend",
  "frontend",
  "ui",
  "gamedev",
  "security",
];

export const DOMAIN_META: Record<
  DomainId,
  {
    name: string;
    jp: string;
    color: string;
    atlas: string;
    tint: string;
    tagline: string;
  }
> = {
  backend: {
    name: "Backend",
    jp: "基盤",
    color: "#35604f",
    atlas: "#74b79c",
    tint: "#e7efe9",
    tagline: "Concurrency, storage, networks, and the failure modes behind them.",
  },
  frontend: {
    name: "Frontend",
    jp: "前面",
    color: "#40518c",
    atlas: "#8b9ee0",
    tint: "#e9ecf7",
    tagline: "The browser as a distributed system, from cache to paint.",
  },
  ui: {
    name: "Interface",
    jp: "界面",
    color: "#8d522e",
    atlas: "#dd9a68",
    tint: "#f3ebe2",
    tagline: "Motion, scroll, components, and the words that make interaction legible.",
  },
  gamedev: {
    name: "Game Dev",
    jp: "遊戯",
    color: "#64436f",
    atlas: "#b58cc7",
    tint: "#f0eaf3",
    tagline: "Simulation, rendering, and the craft that makes a world respond.",
  },
  security: {
    name: "Security",
    jp: "守り",
    color: "#8d3137",
    atlas: "#d97b80",
    tint: "#f6e8e8",
    tagline: "Break it carefully, then understand exactly why it broke.",
  },
};

export const stats = {
  concepts: cards.length,
  domains: catalogue.domains.length,
  layers: catalogue.domains.reduce((sum, domain) => sum + domain.layerCount, 0),
  fieldNotes: cards.filter((card) => card.status === "published").length,
};

export const publishedCards = cards.filter((card) => card.status === "published");

export const featured = cardBySlug.get("lost-update") ?? publishedCards[0];

export function getDomain(id: string): Domain | undefined {
  return catalogue.domains.find((domain) => domain.id === id);
}

export function domainMeta(id: DomainId) {
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
  return cards
    .filter(
      (candidate) =>
        candidate.slug !== card.slug &&
        candidate.domain === card.domain &&
        candidate.layer === card.layer,
    )
    .slice(0, limit);
}

export function difficultyLabel(value: number): string {
  return ["", "Approach", "Everyday", "Working", "Deep", "Specialist"][value] ?? "Working";
}

export function statusLabel(status: ConceptStatus): string {
  return status === "published" ? "Field note" : "Filed entry";
}

export function searchConcepts(query: string, limit = 10): ConceptCard[] {
  const q = query.trim().toLowerCase();
  const pool = [...cards];
  if (!q) {
    return pool
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "published" ? -1 : 1;
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
      if (card.status === "published") score += 4;
      return { card, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.card.title.localeCompare(b.card.title));

  return scored.slice(0, limit).map((entry) => entry.card);
}
