import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import LabShell from "./LabShell";

type Command = {
  id: string;
  label: string;
  group: "Pages" | "Actions";
  hint?: string;
  to?: string;
  run?: "copy";
};

const COMMANDS: Command[] = [
  { id: "spring", label: "Spring", group: "Pages", hint: "motion", to: "/concepts/spring/" },
  { id: "easing", label: "Easing", group: "Pages", hint: "motion", to: "/concepts/easing/" },
  { id: "skeleton", label: "Skeleton", group: "Pages", hint: "loading", to: "/concepts/skeleton/" },
  { id: "shimmer", label: "Shimmer", group: "Pages", hint: "loading", to: "/concepts/shimmer/" },
  { id: "snap", label: "Scroll snap", group: "Pages", hint: "scroll", to: "/concepts/scroll-snap/" },
  { id: "hydration", label: "Hydration", group: "Pages", hint: "react", to: "/concepts/hydration/" },
  { id: "atlas", label: "Atlas index", group: "Pages", to: "/index/" },
  { id: "copy", label: "Copy this address", group: "Actions", hint: "clipboard", run: "copy" },
  { id: "top", label: "Back to the top", group: "Actions", hint: "scroll" },
];

function fuzzy(needle: string, haystack: string) {
  const query = needle.toLowerCase();
  const text = haystack.toLowerCase();
  if (!query) return { score: 0, hits: [] as number[] };
  const hits: number[] = [];
  let from = 0;
  let score = 0;
  let run = 0;
  for (const char of query) {
    const at = text.indexOf(char, from);
    if (at === -1) return null;
    hits.push(at);
    run = at === from ? run + 1 : 0;
    score += 1 + run * 2 + (from === 0 ? 3 : 0);
    from = at + 1;
  }
  return { score, hits };
}

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  const set = new Set(hits);
  return (
    <>
      {Array.from(text).map((char, index) =>
        set.has(index) ? <mark key={index}>{char}</mark> : <span key={index}>{char}</span>,
      )}
    </>
  );
}

export default function CommandPaletteLab() {
  const [variant, setVariant] = useState<"dialog" | "bare">("dialog");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [last, setLast] = useState("nothing yet");
  const [focusStayed, setFocusStayed] = useState("—");
  const [openedBy, setOpenedBy] = useState("—");

  const dialog = useRef<HTMLDialogElement>(null);
  const bare = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const tabbing = useRef(false);

  const results = useMemo(() => {
    const scored = COMMANDS.map((command) => ({ command, match: fuzzy(query, command.label) }))
      .filter((item) => item.match !== null)
      .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
    return scored.slice(0, 6);
  }, [query]);

  const close = useCallback(() => {
    if (variant === "dialog") dialog.current?.close();
    else {
      setOpen(false);
      trigger.current?.focus();
    }
  }, [variant]);

  const show = useCallback(
    (via: string) => {
      setOpenedBy(via);
      setQuery("");
      setActive(0);
      if (variant === "dialog") {
        if (!dialog.current?.open) dialog.current?.showModal();
        setOpen(true);
      } else {
        setOpen(true);
      }
      requestAnimationFrame(() => input.current?.focus());
    },
    [variant],
  );

  const onScopeKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      // stop it reaching the atlas's own ⌘K listener on window
      event.preventDefault();
      event.stopPropagation();
      if (open) close();
      else show("Ctrl / Cmd + K");
      return;
    }
    if (event.key === "Escape" && open && variant === "bare") {
      event.preventDefault();
      close();
    }
  };

  useEffect(() => {
    if (!open) return;
    const markTab = (event: KeyboardEvent) => {
      tabbing.current = event.key === "Tab";
    };
    const clearTab = (event: KeyboardEvent) => {
      if (event.key === "Tab") tabbing.current = false;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!tabbing.current) return;
      const root = variant === "dialog" ? dialog.current : bare.current;
      setFocusStayed(root && event.target instanceof Node && root.contains(event.target) ? "inside the palette" : "out to the page");
    };
    window.addEventListener("keydown", markTab, true);
    window.addEventListener("keyup", clearTab, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", markTab, true);
      window.removeEventListener("keyup", clearTab, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const node = list.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    if (command.to) {
      setLast(`would open ${command.label}`);
      window.location.assign(command.to);
      return;
    }
    if (command.run === "copy") {
      const url = window.location.href;
      navigator.clipboard
        ?.writeText(url)
        .then(() => setLast("address copied"))
        .catch(() => setLast("clipboard blocked"));
      close();
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    setLast(command.label);
    close();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]?.command);
    }
  };

  const panel = (
    <div className="cp-panel">
      <div className="cp-field">
        <span className="cp-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={input}
          className="cp-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="cp-list"
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `cp-opt-${results[active].command.id}` : undefined}
          placeholder="Type a concept…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd className="cp-kbd">Esc</kbd>
        <button
          type="button"
          className="cp-close"
          aria-label="Close the palette"
          onClick={() => close()}
        >
          ×
        </button>
      </div>

      {results.length ? (
        <ul ref={list} id="cp-list" className="cp-list" role="listbox" aria-label="Commands" tabIndex={-1}>
          {results.map((item, index) => (
            <li
              key={item.command.id}
              id={`cp-opt-${item.command.id}`}
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              className="cp-opt"
              onMouseEnter={() => setActive(index)}
              onClick={() => run(item.command)}
            >
              <span className="cp-opt-label">
                <Highlight text={item.command.label} hits={item.match?.hits ?? []} />
              </span>
              <span className="cp-opt-meta">
                {item.command.group === "Pages" ? "page" : "action"}
                {item.command.hint ? ` · ${item.command.hint}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-empty">
          Nothing matches “{query}”. Try <code>spr</code> or <code>hy</code>.
        </p>
      )}

      <div className="cp-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> move
        </span>
        <span>
          <kbd>↵</kbd> run
        </span>
        <span className="cp-count">
          {results.length} of {COMMANDS.length}
        </span>
      </div>
    </div>
  );

  return (
    <LabShell
      title="A palette is a dialog wearing a search box"
      description="Press Ctrl K while this box has focus, or press the button. The atlas owns a ⌘K of its own, so this one stops the event from reaching the window — scoping a shortcut is half the work. The interesting part is not the fuzzy filter: it is where focus goes, what happens to the page behind, and whether Escape is the platform's or yours."
      accent="#6b3f6e"
      foot="showModal() gives you the trap, the backdrop, the Escape key and an inert page for free. A positioned div gives you all four as bugs."
    >
      <div className="cp-scope" onKeyDown={onScopeKey}>
        <div className="cp-bar">
        <div className="lab-toggle" role="group" aria-label="Implementation">
          <button
            type="button"
            aria-pressed={variant === "dialog"}
            onClick={() => {
              close();
              setVariant("dialog");
            }}
          >
            &lt;dialog&gt; + showModal
          </button>
          <button
            type="button"
            aria-pressed={variant === "bare"}
            onClick={() => {
              close();
              setVariant("bare");
            }}
          >
            A positioned div
          </button>
        </div>
        <button type="button" ref={trigger} className="lab-button" onClick={() => (open ? close() : show("the button"))}>
          {open ? "Close the palette" : "Open the palette"}
        </button>
      </div>

      <div className="cp-stage">
        <label className="cp-behind">
          <span>Search the atlas</span>
          <input type="text" placeholder="a field on the page behind" />
        </label>
        <p className="cp-behind-note">
          Focus is on this field, then on the one after it, while the palette is open — press Tab in
          the palette and watch the readout.
        </p>
        <label className="cp-behind">
          <span>Add a note</span>
          <input type="text" placeholder="another field" />
        </label>
      </div>

      {variant === "dialog" ? (
        <dialog
          ref={dialog}
          className="cp-dialog"
          onClose={() => {
            setOpen(false);
            setFocusStayed("—");
            trigger.current?.focus();
          }}
        >
          {panel}
        </dialog>
      ) : (
        <div ref={bare} className="cp-dialog cp-dialog--bare" data-open={open} aria-hidden={!open}>
          {panel}
        </div>
      )}
      </div>

      <div className="lab-metrics cp-metrics">
        <div className="lab-metric">
          <span>Opened by</span>
          <strong>{openedBy}</strong>
        </div>
        <div className="lab-metric">
          <span>Tab went</span>
          <strong>{focusStayed}</strong>
        </div>
        <div className="lab-metric">
          <span>Last command</span>
          <strong>{last}</strong>
        </div>
        <div className="lab-metric">
          <span>Page behind</span>
          <strong>{variant === "dialog" ? "inert" : "reachable"}</strong>
        </div>
      </div>
    </LabShell>
  );
}
