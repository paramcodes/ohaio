import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  DOMAIN_META,
  DOMAIN_ORDER,
  searchConcepts,
  stats,
  statusLabel,
  type ConceptCard,
} from "@/lib/site";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchConcepts(query, 24), [query]);

  const groups = useMemo(
    () =>
      DOMAIN_ORDER.map((domain) => ({
        domain,
        meta: DOMAIN_META[domain],
        items: results.filter((card) => card.domain === domain),
      })).filter((group) => group.items.length > 0),
    [results],
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("ohaio:scroll-lock", { detail: { locked: open } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("ohaio:scroll-lock", { detail: { locked: false } }),
      );
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    const onSearchRequest = () => setOpen(true);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-search-open]")) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("ohaio:search", onSearchRequest);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("ohaio:search", onSearchRequest);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const choose = (card: ConceptCard) => {
    setOpen(false);
    window.location.assign(card.url);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      label="Search concepts"
      shouldFilter={false}
      loop
      overlayClassName="palette-overlay"
      contentClassName="palette-content"
      className="palette-root"
    >
      <div className="palette-input-row">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <Command.Input
          className="palette-input"
          value={query}
          onValueChange={setQuery}
          placeholder={`Search ${stats.concepts} concepts…`}
          aria-label="Search concepts"
        />
      </div>

      <Command.List className="palette-list" aria-label="Concept results" data-lenis-prevent>
        {results.length === 0 ? (
          <div className="palette-empty">
            <strong>No entry found</strong>
            Try a shorter term, or browse the full index.
          </div>
        ) : (
          groups.map((group) => (
            <Command.Group
              key={group.domain}
              heading={group.meta.name}
              className="palette-group"
            >
              {group.items.map((card) => (
                <Command.Item
                  key={card.slug}
                  value={card.slug}
                  className="palette-item"
                  onSelect={() => choose(card)}
                >
                  <span className="palette-item-title">{card.title}</span>
                  <span className="palette-item-meta">
                    {statusLabel(card.status)} · {card.layerName}
                  </span>
                  <span className="palette-item-copy">{card.summary}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))
        )}

        {query.trim() && results.length > 0 ? (
          <Command.Group heading="More" className="palette-group">
            <Command.Item
              value="search-all-results"
              className="palette-item"
              onSelect={() => {
                setOpen(false);
                window.location.assign(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
            >
              <span className="palette-item-title">All results for “{query.trim()}”</span>
              <span className="palette-item-meta">Search page</span>
              <span className="palette-item-copy">See the full list with summaries.</span>
            </Command.Item>
          </Command.Group>
        ) : null}
      </Command.List>

      <div className="palette-footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open
        </span>
        <span>
          <kbd>esc</kbd> to close
        </span>
      </div>
    </Command.Dialog>
  );
}
