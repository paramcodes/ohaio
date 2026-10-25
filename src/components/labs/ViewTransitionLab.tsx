import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

interface VtItem {
  id: string;
  index: string;
  kicker: string;
  title: string;
  copy: string;
  art: "rings" | "grid" | "bars" | "dots";
  stats: { label: string; value: string }[];
}

const ITEMS: VtItem[] = [
  {
    id: "feed",
    index: "01",
    kicker: "Shared element",
    title: "Feed to reader",
    copy: "The plate is the only element named in both views. The card becomes the hero while the surrounding copy changes instantly, so the eye follows one object instead of re-reading the page.",
    art: "rings",
    stats: [
      { label: "Stories", value: "24" },
      { label: "Unread", value: "6" },
      { label: "Synced", value: "12s ago" },
    ],
  },
  {
    id: "queue",
    index: "02",
    kicker: "Unique names",
    title: "Queue to job",
    copy: "A view-transition-name must be unique in each snapshot. Four thumbnails can hold four names, but only the selected one can also exist in the detail view.",
    art: "grid",
    stats: [
      { label: "Jobs", value: "1.2k" },
      { label: "Running", value: "3" },
      { label: "Done", value: "42%" },
    ],
  },
  {
    id: "palette",
    index: "03",
    kicker: "Snapshot layer",
    title: "Token sheet",
    copy: "Old and new states are painted into a pseudo-element tree above the document. Animating only the named group keeps the rest of the lab perfectly still.",
    art: "bars",
    stats: [
      { label: "Tokens", value: "6" },
      { label: "Space", value: "OKLCH" },
      { label: "Body AA", value: "4.6:1" },
    ],
  },
  {
    id: "type",
    index: "04",
    kicker: "No library",
    title: "Type scale",
    copy: "startViewTransition snapshots the old state, runs your DOM update, then animates the difference. Without support — or under reduced motion — the same update lands with no travel.",
    art: "dots",
    stats: [
      { label: "Steps", value: "5" },
      { label: "Base", value: "16px" },
      { label: "Ratio", value: "1.25" },
    ],
  },
];

type View = { kind: "grid" } | { kind: "detail"; id: string };

export default function ViewTransitionLab() {
  const [view, setView] = useState<View>({ kind: "grid" });
  const [lastId, setLastId] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnFocus = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setSupported(typeof document.startViewTransition === "function");
    return () => {
      delete document.documentElement.dataset.vtLab;
    };
  }, []);

  useEffect(() => {
    if (view.kind === "detail") {
      closeRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!returnFocus.current) return;
    cardRefs.current[returnFocus.current]?.focus({ preventScroll: true });
    returnFocus.current = null;
  }, [view]);

  const swap = (next: View, nextLastId?: string) => {
    const update = () =>
      flushSync(() => {
        setView(next);
        if (nextLastId) setLastId(nextLastId);
      });

    if (supported !== true || reduceMotion) {
      update();
      return;
    }

    const root = document.documentElement;
    root.dataset.vtLab = "true";
    const transition = document.startViewTransition(update);
    const clearFlag = () => {
      delete root.dataset.vtLab;
    };
    transition.finished.then(clearFlag, clearFlag);
  };

  const open = (id: string, art: HTMLElement | null) => {
    stageRef.current?.querySelectorAll<HTMLElement>(".vt-art").forEach((element) => {
      element.style.viewTransitionName = "";
    });
    if (art) art.style.viewTransitionName = "vt-card-art";
    returnFocus.current = id;
    swap({ kind: "detail", id }, id);
  };

  const close = () => swap({ kind: "grid" });

  const active =
    view.kind === "detail"
      ? (ITEMS.find((item) => item.id === view.id) ?? null)
      : null;

  return (
    <LabShell
      title="One element survives the swap"
      description="Open a panel. The plate is named in both views, so it morphs from thumbnail to hero while the rest of the lab changes instantly."
      accent="var(--indigo)"
      foot="startViewTransition snapshots the old state, runs the DOM update, then animates the difference. Reduced motion and unsupported browsers get the instant swap."
    >
      <div className="vt-stage" ref={stageRef}>
        <div className="vt-bar">
          <span>{active ? `Detail · ${active.title}` : "Grid · 4 panels"}</span>
          <span className="vt-support" data-supported={supported === true}>
            <i aria-hidden="true" />
            {supported === null
              ? "Checking support"
              : supported
                ? `Native view transitions${reduceMotion ? " · reduced motion" : ""}`
                : "Fallback: instant swap"}
          </span>
        </div>

        {active ? (
          <div className="vt-detail" onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}>
            <span
              className="vt-art vt-detail-art"
              data-art={active.art}
              style={{ viewTransitionName: "vt-card-art" }}
            >
              <span className="vt-art-index">{active.index}</span>
            </span>
            <div className="vt-detail-body">
              <button
                ref={closeRef}
                className="vt-back"
                type="button"
                onClick={close}
              >
                Back to panels
              </button>
              <p className="vt-detail-kicker">{active.kicker}</p>
              <h5 className="vt-detail-title">{active.title}</h5>
              <p className="vt-detail-copy">{active.copy}</p>
              <dl className="vt-stats">
                {active.stats.map((stat) => (
                  <div className="vt-stat" key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : (
          <div className="vt-grid">
            {ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="vt-card"
                ref={(element) => {
                  cardRefs.current[item.id] = element;
                }}
                onClick={(event) =>
                  open(
                    item.id,
                    event.currentTarget.querySelector<HTMLElement>(".vt-art"),
                  )
                }
              >
                <span
                  className="vt-art"
                  data-art={item.art}
                  style={{
                    viewTransitionName:
                      item.id === lastId ? "vt-card-art" : undefined,
                  }}
                >
                  <span className="vt-art-index">{item.index}</span>
                </span>
                <span className="vt-card-body">
                  <span className="vt-card-kicker">{item.kicker}</span>
                  <strong>{item.title}</strong>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </LabShell>
  );
}
