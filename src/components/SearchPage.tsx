import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DOMAIN_META,
  publishedCards,
  searchConcepts,
  stats,
  type ConceptCard,
} from "@/lib/site";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    setQuery(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [query, ready]);

  const results = useMemo(
    () => (query.trim() ? searchConcepts(query, 60) : publishedCards),
    [query],
  );

  const showingSearch = query.trim().length > 0;

  return (
    <div className="search-shell">
      <label className="visually-hidden" htmlFor="concept-search">
        Search concepts
      </label>
      <div className="search-field">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          id="concept-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${stats.concepts} concepts…`}
          autoComplete="off"
          spellCheck={false}
          aria-controls="search-results"
        />
      </div>

      <p className="search-summary" aria-live="polite">
        {showingSearch
          ? `${results.length} ${results.length === 1 ? "entry" : "entries"} for “${query.trim()}”`
          : `${publishedCards.length} field notes, ready to read`}
      </p>

      <div id="search-results" className="search-results">
        {results.length === 0 ? (
          <div className="search-empty">
            <strong>Nothing under that word yet.</strong>
            Try a broader term, a layer such as “caching”, or a domain name.
          </div>
        ) : (
          results.map((card) => <ResultRow key={card.slug} card={card} />)
        )}
      </div>
    </div>
  );
}

function ResultRow({ card }: { card: ConceptCard }) {
  const domain = DOMAIN_META[card.domain];

  return (
    <a
      className="search-result"
      href={card.url}
      data-concept={card.slug}
    >
      <span className="search-result-title">{card.title}</span>
      <span className="meta-strip" style={{ margin: 0 }}>
        <span className="domain-chip" style={{ "--dc": domain.color } as CSSProperties}>
          <i className="domain-dot" />
          {domain.name}
        </span>
        <span>{card.layerName}</span>
        <span className={card.status === "published" ? "status-tag status-tag--published" : "status-tag"}>
          {card.status === "published" ? "Field note" : "Filed entry"}
        </span>
      </span>
      <span className="search-result-copy">{card.summary}</span>
    </a>
  );
}
