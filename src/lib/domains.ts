export type DomainId = "backend" | "frontend" | "ui" | "gamedev" | "security";

export interface DomainMeta {
  name: string;
  jp: string;
  color: string;
  atlas: string;
  tint: string;
  tagline: string;
}

export const DOMAIN_ORDER: DomainId[] = [
  "backend",
  "frontend",
  "ui",
  "gamedev",
  "security",
];

export const DOMAIN_META: Record<DomainId, DomainMeta> = {
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

export function isDomainId(value: string): value is DomainId {
  return (DOMAIN_ORDER as string[]).includes(value);
}
