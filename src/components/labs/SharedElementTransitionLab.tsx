import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Naming = "match" | "shared" | "index";

interface Tile {
  id: string;
  label: string;
  hue: string;
}

const TILES: Tile[] = [
  { id: "a", label: "Northwind", hue: "oklch(0.62 0.13 33)" },
  { id: "b", label: "Kōhaku", hue: "oklch(0.56 0.12 230)" },
  { id: "c", label: "Tessellate", hue: "oklch(0.6 0.11 150)" },
  { id: "d", label: "Lantern", hue: "oklch(0.66 0.14 75)" },
];

const byId = (id: string) => TILES.find((t) => t.id === id)!;

const NAMING_LABEL: Record<Naming, string> = {
  match: "match-element",
  shared: "one shared name",
  index: "index-based names",
};

export default function SharedElementTransitionLab() {
  const [order, setOrder] = useState<string[]>(["a", "b", "c", "d"]);
  const [naming, setNaming] = useState<Naming>("match");
  const [dur, setDur] = useState<string>("—");
  const [result, setResult] = useState<string>("idle");
  const [supported, setSupported] = useState<{ vt: boolean; match: boolean; groups: boolean } | null>(null);
  const reduceMotion = useReducedMotion();
  const pending = useRef<Naming>(naming);
  pending.current = naming;

  useEffect(() => {
    setSupported({
      vt: typeof document.startViewTransition === "function",
      match: CSS.supports("view-transition-name", "match-element"),
      groups: CSS.supports("view-transition-name", "share(--x)"),
    });
    return () => {
      delete document.documentElement.dataset.seLab;
    };
  }, []);

  const nameFor = (index: number) => {
    if (pending.current === "match") return "match-element";
    if (pending.current === "shared") return "tile";
    return `tile-${index}`;
  };

  const run = (update: () => void) => {
    if (supported?.vt !== true || reduceMotion) {
      update();
      setResult(reduceMotion ? "instant (reduced motion)" : "instant (no API)");
      setDur("0 ms");
      return;
    }
    const root = document.documentElement;
    root.dataset.seLab = "true";
    const t0 = performance.now();
    const transition = document.startViewTransition(() => flushSync(update));
    const clear = () => {
      delete root.dataset.seLab;
    };
    // Duplicate names fail snapshot capture, which rejects ready even when finished
    // still resolves. Silencing it here keeps the deliberate failure-case demo from
    // escaping an unhandled rejection; the browser logs its own diagnostic regardless.
    transition.ready.catch(() => {});
    transition.finished.then(
      () => {
        clear();
        const ms = Math.round(performance.now() - t0);
        setDur(`${ms} ms`);
        setResult(ms < 150 ? "skipped — no pair matched" : "morphed");
      },
      () => {
        clear();
        setDur("—");
        setResult("aborted");
      },
    );
  };

  const shuffle = () => run(() => setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]));
  const removeFirst = () => run(() => setOrder((o) => (o.length > 1 ? o.slice(1) : o)));
  const restore = () => run(() => setOrder(["a", "b", "c", "d"]));

  return (
    <LabShell
      title="A shared element is an identity, not a position"
      description="Reorder a row of cards and make one of them physically travel to its new slot. The View Transition API matches snapshots by name — so the naming strategy is the whole feature, and the obvious choices are the two that break."
      accent="var(--indigo)"
      foot="Shuffle with each naming strategy and read the result. One shared name aborts the match; index names animate but pair by slot; match-element follows the element."
    >
      <div className="se-bar">
        <div className="lab-chips" role="group" aria-label="Naming strategy">
          {(["match", "shared", "index"] as Naming[]).map((id) => (
            <button key={id} type="button" aria-pressed={naming === id} onClick={() => setNaming(id)}>
              {NAMING_LABEL[id]}
            </button>
          ))}
        </div>
        <div className="lab-actions">
          <button type="button" className="lab-button" onClick={shuffle}>
            Move last to front
          </button>
          <button type="button" className="lab-button lab-button--quiet" onClick={removeFirst}>
            Remove first
          </button>
          <button type="button" className="lab-button lab-button--quiet" onClick={restore}>
            Reset
          </button>
        </div>
      </div>

      <div className="se-stage" data-naming={naming}>
        {order.map((id, index) => {
          const tile = byId(id);
          return (
            <div className="se-card" key={id} style={{ viewTransitionName: nameFor(index) }}>
              <span className="se-art" style={{ background: tile.hue }}>
                <span className="se-art-label">{tile.label}</span>
              </span>
              <span className="se-slot">{index + 1}</span>
            </div>
          );
        })}
      </div>

      <div className="lab-metrics se-metrics">
        <div className="lab-metric">
          <span>startViewTransition</span>
          <strong>{supported === null ? "checking" : supported.vt ? "supported" : "absent"}</strong>
        </div>
        <div className="lab-metric">
          <span>match-element</span>
          <strong>{supported === null ? "checking" : supported.match ? "supported" : "unsupported"}</strong>
        </div>
        <div className="lab-metric">
          <span>share: groups</span>
          <strong>{supported === null ? "checking" : supported.groups ? "supported" : "not shipped"}</strong>
        </div>
        <div className="lab-metric">
          <span>Last reorder</span>
          <strong>{result}</strong>
        </div>
      </div>

      <div className="lab-row">
        <p className="se-readout">
          Transition took <strong>{dur}</strong> with <strong>{NAMING_LABEL[naming]}</strong>.
        </p>
        <p className="se-hint">
          On <strong>one shared name</strong> every card declares the same <code>view-transition-name</code>, so the
          browser refuses to guess which is which and skips the whole transition in a few dozen milliseconds. On{" "}
          <strong>index names</strong> the reorder animates, but slot 1 always morphs into slot 1 — the content
          crossfades instead of the card travelling. Only <strong>match-element</strong> names each element by its
          identity, so the moved card flies to its new home. <code>share:</code> groups, which would let one element
          morph into several, are not shipped in this browser yet.
        </p>
      </div>
    </LabShell>
  );
}
