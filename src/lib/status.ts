export type ConceptStatus =
  | "scaffold"
  | "draft"
  | "in-review"
  | "published"
  | "stale"
  | "archived";

export type ConceptFormat = "field-note" | "standard" | "glossary";

export const STATUS_ORDER: ConceptStatus[] = [
  "published",
  "in-review",
  "draft",
  "stale",
  "scaffold",
  "archived",
];

const STATUS_LABEL: Record<ConceptStatus, string> = {
  scaffold: "Scaffold",
  draft: "Draft",
  "in-review": "In review",
  published: "Field note",
  stale: "Needs review",
  archived: "Archived",
};

export const FORMAT_LABEL: Record<ConceptFormat, string> = {
  "field-note": "Field note",
  standard: "Entry",
  glossary: "Glossary",
};

export function statusLabel(status: ConceptStatus): string {
  return STATUS_LABEL[status];
}

export function isPublished(status: ConceptStatus): boolean {
  return status === "published";
}

export function isReadable(status: ConceptStatus): boolean {
  return status === "published" || status === "in-review";
}

export function isIndexable(status: ConceptStatus): boolean {
  return status === "published";
}

export function statusRank(status: ConceptStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}
