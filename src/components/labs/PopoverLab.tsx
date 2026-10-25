import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import LabShell from "./LabShell";

type Side = "below" | "right" | "above" | "left";

const AREAS: { id: Side; label: string; css: string }[] = [
  { id: "below", label: "Below", css: "block-end span-inline-end" },
  { id: "right", label: "Right", css: "inline-end span-block-end" },
  { id: "above", label: "Above", css: "block-start span-inline-end" },
  { id: "left", label: "Left", css: "inline-start span-block-end" },
];

const MENU = ["Rename", "Duplicate", "Archive", "Copy link"];
const DETAILS = [
  ["Filed under", "Components"],
  ["Domain", "Interface"],
  ["Reviewed", "25 Oct 2026"],
];

export default function PopoverLab() {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [side, setSide] = useState<Side>("below");
  const [support, setSupport] = useState<{ popover: boolean; anchor: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("nothing yet");
  const [focusBack, setFocusBack] = useState("—");
  const [mounted, setMounted] = useState(false);

  const trigA = useRef<HTMLButtonElement>(null);
  const trigB = useRef<HTMLButtonElement>(null);
  const popA = useRef<HTMLDivElement>(null);
  const popB = useRef<HTMLDivElement>(null);
  const why = useRef("the trigger");

  useEffect(() => {
    setMounted(true);
    const popover = typeof HTMLElement.prototype.hasOwnProperty === "function"
      ? "popover" in HTMLElement.prototype
      : false;
    const anchor =
      typeof CSS !== "undefined" && CSS.supports("position-area: block-end");
    setSupport({ popover, anchor });
  }, []);

  useEffect(() => {
    trigA.current?.setAttribute("popovertarget", "pop-menu");
    trigB.current?.setAttribute("popovertarget", "pop-details");
  }, []);

  useEffect(() => {
    if (!support?.popover) return;
    const nodes = [popA.current, popB.current];
    const onToggle = (event: ToggleEvent) => {
      const el = event.target as HTMLElement;
      if (event.newState === "open") setOpenId(el.id);
      else setOpenId((current) => (current === el.id ? null : current));
    };
    const onBeforeClose = (event: ToggleEvent) => {
      if (event.newState !== "closed") return;
      setReason(why.current);
      const trigger = (event.target as HTMLElement).id === "pop-menu" ? trigA.current : trigB.current;
      queueMicrotask(() => {
        setFocusBack(document.activeElement === trigger ? "to the button" : "elsewhere");
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = nodes.some((n) => n?.contains(target));
      const onTrigger = [trigA.current, trigB.current].some((n) => n?.contains(target));
      if (!inside && !onTrigger) why.current = "a click outside";
      else if (onTrigger) why.current = "the trigger";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") why.current = "the Escape key";
    };

    for (const node of nodes) {
      node?.addEventListener("toggle", onToggle as EventListener);
      node?.addEventListener("beforetoggle", onBeforeClose as EventListener);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      for (const node of nodes) {
        node?.removeEventListener("toggle", onToggle as EventListener);
        node?.removeEventListener("beforetoggle", onBeforeClose as EventListener);
      }
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [support]);

  useEffect(() => {
    if (!support || support.anchor) return;
    const pop = openId ? document.getElementById(openId) : null;
    if (!pop) return;
    const trigger = openId === "pop-menu" ? trigA.current : trigB.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const gap = 8;
    let left = box.left;
    let top = box.bottom + gap;
    if (side === "above") {
      top = box.top - height - gap;
    } else if (side === "right") {
      left = box.right + gap;
      top = box.top;
    } else if (side === "left") {
      left = box.left - width - gap;
      top = box.top;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    pop.style.position = "fixed";
    pop.style.inset = "auto";
    pop.style.margin = "0";
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }, [openId, side, support]);

  const area = AREAS.find((item) => item.id === side)?.css ?? "block-end";

  const anchorStyle = (name: string) =>
    ({ "--pop-anchor": name, "--pop-area": area }) as CSSProperties;

  return (
    <LabShell
      title="A popover is a layer, not a z-index"
      description="Two anchored surfaces, opened with nothing but attributes. Switch the mode and watch what closes them; switch the placement and watch what keeps them attached."
      accent="#3f5d8a"
      foot="Light dismiss, Escape, focus return and the top layer are the browser's work. Placement is the only part you still have to supply."
    >
      <div className="pop-bar">
        <div className="lab-toggle" role="group" aria-label="Popover mode">
          <button type="button" aria-pressed={mode === "auto"} onClick={() => setMode("auto")}>
            auto
          </button>
          <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
            manual
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Placement">
          {AREAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={side === item.id}
              onClick={() => setSide(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="pop-support" aria-label="Feature support">
          <span data-on={support?.popover}>
            <i /> popover
          </span>
          <span data-on={support?.anchor}>
            <i /> anchor positioning
          </span>
        </div>
      </div>

      <div className="pop-stage">
        <div className="pop-row">
          <button
            type="button"
            ref={trigA}
            className="lab-button"
            style={{ anchorName: "--pop-a" } as CSSProperties}
          >
            Row actions
          </button>
          <button
            type="button"
            ref={trigB}
            className="lab-button lab-button--quiet"
            style={{ anchorName: "--pop-b" } as CSSProperties}
          >
            Record details
          </button>
          <p className="pop-note">
            In <code>auto</code> the platform keeps one surface open at a time, so opening the second
            closes the first. In <code>manual</code> it does not, and a click outside does nothing.
          </p>
        </div>

        <div className="pop-pad" aria-hidden="true">
          <span>click anywhere out here</span>
        </div>

        <div
          ref={popA}
          id="pop-menu"
          className="pop-card"
          popover={mode}
          data-area={area}
          data-anchor={String(Boolean(support?.anchor))}
          style={anchorStyle("--pop-a")}
        >
          <p className="pop-card-title">This row</p>
          <ul className="pop-list">
            {MENU.map((item) => (
              <li key={item}>
                <button type="button" onClick={() => { why.current = "an action inside"; popA.current?.hidePopover(); }}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          ref={popB}
          id="pop-details"
          className="pop-card"
          popover={mode}
          data-area={area}
          data-anchor={String(Boolean(support?.anchor))}
          style={anchorStyle("--pop-b")}
        >
          <p className="pop-card-title">Record</p>
          <dl className="pop-dl">
            {DETAILS.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="lab-metrics pop-metrics">
        <div className="lab-metric">
          <span>Open</span>
          <strong>{openId ? openId.replace("pop-", "") : "none"}</strong>
        </div>
        <div className="lab-metric">
          <span>Closed by</span>
          <strong>{reason}</strong>
        </div>
        <div className="lab-metric">
          <span>Focus went</span>
          <strong>{focusBack}</strong>
        </div>
        <div className="lab-metric">
          <span>Placement</span>
          <strong>{support === null ? "checking" : support.anchor ? "CSS anchor" : "JS fallback"}</strong>
        </div>
      </div>

      <div className="lab-row">
        <p className="pop-code">
          {mounted
            ? `<button popovertarget="menu">Row actions</button>\n\n<div id="menu" popover="auto">\n  /* the browser: layer, Escape, light dismiss, focus */\n</div>\n\n.menu { position-area: ${area}; }`
            : `<button popovertarget="menu">Row actions</button>\n\n<div id="menu" popover="auto"></div>`}
        </p>
        <p className="pop-hint">
          Nothing above opens or closes the surface in script. The <code>toggle</code> events are read
          for the readout, and the placement falls back to a few lines of maths only where{" "}
          <code>position-area</code> is missing.
        </p>
      </div>
    </LabShell>
  );
}
