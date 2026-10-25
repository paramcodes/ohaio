import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import LabShell from "./LabShell";

type Gap = "margin" | "bridge" | "flush";
type Dismiss = "instant" | "grace";
type Closed = "clickable" | "ignored";
type Device = "real" | "touch";

const TOOLTIPS = [
  { id: "copy", label: "Copy", hint: "Copy this link" },
  { id: "share", label: "Share", hint: "Share this link" },
  { id: "delete", label: "Delete", hint: "Delete the row" },
];

const GAP_LABEL: Record<Gap, string> = {
  margin: "8px gap, no bridge",
  bridge: "8px gap, bridged",
  flush: "no gap",
};

export default function HoverLab() {
  const [gap, setGap] = useState<Gap>("margin");
  const [dismiss, setDismiss] = useState<Dismiss>("instant");
  const [closed, setClosed] = useState<Closed>("clickable");
  const [device, setDevice] = useState<Device>("real");
  const [disabled, setDisabled] = useState(false);
  const [media, setMedia] = useState<{ hover: boolean; fine: boolean } | null>(null);
  const [chain, setChain] = useState(0);
  const [sample, setSample] = useState("no leave yet");
  const [landed, setLanded] = useState("nothing yet");
  const [steals, setSteals] = useState(0);

  const stage = useRef<HTMLDivElement>(null);
  const tips = useRef<Record<string, HTMLSpanElement | null>>({});

  useEffect(() => {
    const hover = matchMedia("(hover: hover)");
    const fine = matchMedia("(pointer: fine)");
    const sync = () => setMedia({ hover: hover.matches, fine: fine.matches });
    sync();
    hover.addEventListener("change", sync);
    fine.addEventListener("change", sync);
    return () => {
      hover.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const onMove = () => {
      const hovered = [...document.querySelectorAll(":hover")];
      setChain(hovered.filter((el) => node.contains(el)).length);
    };
    node.addEventListener("pointermove", onMove);
    return () => node.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    setSample(`reset — ${GAP_LABEL[gap]}, ${dismiss === "grace" ? "140ms grace" : "no grace"}`);
  }, [gap, dismiss]);

  const leaveGroup = (id: string) => {
    const tip = tips.current[id];
    if (!tip) return;
    window.setTimeout(() => {
      const value = Number(getComputedStyle(tip).opacity);
      setSample(value >= 0.99 ? "still 1.00 at 30ms" : `${value.toFixed(2)} at 30ms`);
    }, 30);
  };

  const onStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains("hv-tip")) {
      setLanded("the closed tooltip");
      setSteals((n) => n + 1);
      return;
    }
    setLanded(target.dataset.who ?? "the chrome");
  };

  const hoverCapable = device === "touch" ? false : media ? media.hover && media.fine : null;

  const rootStyle = {
    "--hv-gap": gap === "flush" ? "0px" : "8px",
    "--hv-closed-pe": closed === "ignored" ? "none" : "auto",
  } as CSSProperties;

  const code = [
    `.group .tip {`,
    `  position: absolute; inset-block-start: 100%;`,
    `  margin-block-start: ${gap === "flush" ? "0" : "8px"};`,
    `  opacity: 0;`,
    `  pointer-events: ${closed === "ignored" ? "none" : "auto"};`,
    `  transition: opacity 120ms linear${dismiss === "grace" ? " 140ms" : ""};`,
    `}`,
    gap === "bridge"
      ? `\n.tip::before {\n  content: "";\n  position: absolute;\n  inset-block-end: 100%;\n  block-size: 8px;\n}`
      : "",
    `\n@media (hover: hover) and (pointer: fine) {`,
    `  .group:hover .tip,\n  .group:focus-within .tip {`,
    `    opacity: 1;`,
    `    pointer-events: auto;`,
    dismiss === "grace" ? `    transition-delay: 0ms;` : "",
    `  }\n}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return (
    <LabShell
      title="A tooltip is a promise about a gap"
      description="Hover a toolbar button, then move the pointer down into the tooltip that appears. Four decisions decide whether you arrive with it still open, and only one of them is the animation."
      accent="#a1492f"
      foot="Gated hover, a bridged gap, a grace period on the way out, and a closed surface that stays out of the hit test. Four lines of CSS — that is the whole component."
    >
      <div className="hv-bar">
        <div className="lab-toggle" role="group" aria-label="Pointer capability">
          <button type="button" aria-pressed={device === "real"} onClick={() => setDevice("real")}>
            this device
          </button>
          <button type="button" aria-pressed={device === "touch"} onClick={() => setDevice("touch")}>
            pretend (hover: none)
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Gap between trigger and surface">
          {([
            ["margin", "8px gap"],
            ["bridge", "bridged"],
            ["flush", "flush"],
          ] as [Gap, string][]).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={gap === id} onClick={() => setGap(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="lab-chips" role="group" aria-label="Dismiss timing">
          <button type="button" aria-pressed={dismiss === "instant"} onClick={() => setDismiss("instant")}>
            closes at once
          </button>
          <button type="button" aria-pressed={dismiss === "grace"} onClick={() => setDismiss("grace")}>
            140ms grace
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Closed surface hit testing">
          <button type="button" aria-pressed={closed === "clickable"} onClick={() => setClosed("clickable")}>
            closed takes clicks
          </button>
          <button type="button" aria-pressed={closed === "ignored"} onClick={() => setClosed("ignored")}>
            closed is ignored
          </button>
        </div>
        <div className="lab-chips">
          <button
            type="button"
            aria-pressed={disabled}
            onClick={() => setDisabled((d) => !d)}
          >
            disable Copy
          </button>
        </div>
      </div>

      <div
        className="hv-stage"
        ref={stage}
        style={rootStyle}
        data-device={device}
        data-gap={gap}
        data-dismiss={dismiss}
        onClick={onStageClick}
      >
        <div className="hv-toolbar">
          {TOOLTIPS.map((item, index) => (
            <span className="hv-group" key={item.id} onMouseLeave={() => leaveGroup(item.id)}>
              <button
                type="button"
                className="hv-icon"
                data-who={`the ${item.label.toLowerCase()} button`}
                disabled={disabled && item.id === "copy"}
                aria-label={item.label}
                aria-describedby={`hv-${item.id}`}
              >
                {index === 0 && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" />
                    <path d="M10.5 3.5h-6a2 2 0 0 0-2 2v6" fill="none" stroke="currentColor" />
                  </svg>
                )}
                {index === 1 && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="12" cy="4" r="2.2" fill="none" stroke="currentColor" />
                    <circle cx="4" cy="8" r="2.2" fill="none" stroke="currentColor" />
                    <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" />
                    <path d="m6 7 4-2M6 9l4 2" stroke="currentColor" fill="none" />
                  </svg>
                )}
                {index === 2 && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 5h9M6.5 5V3.5h3V5M5 5l.7 8h4.6L11 5" fill="none" stroke="currentColor" />
                  </svg>
                )}
              </button>
              <span
                className="hv-tip"
                id={`hv-${item.id}`}
                role="tooltip"
                data-who={`the ${item.label} tooltip`}
                ref={(el) => {
                  tips.current[item.id] = el;
                }}
              >
                {item.hint}
              </span>
            </span>
          ))}
        </div>
        <div className="hv-strip" data-who="the row behind">
          this strip sits under the tooltips — click where one is parked: transparent is not absent. On the touch
          profile the surface stays closed and still eats the click.
        </div>
      </div>

      <div className="lab-metrics hv-metrics">
        <div className="lab-metric">
          <span>This pointer</span>
          <strong>{media === null ? "checking" : hoverCapable === false ? "no hover" : hoverCapable ? "hover + fine" : "mixed"}</strong>
        </div>
        <div className="lab-metric">
          <span>Chain depth</span>
          <strong>{chain}</strong>
        </div>
        <div className="lab-metric">
          <span>Opacity after leave</span>
          <strong>{sample}</strong>
        </div>
        <div className="lab-metric">
          <span>Click landed on</span>
          <strong>{landed}</strong>
        </div>
      </div>

      <div className="lab-row">
        <pre className="hv-code">{code}</pre>
        <p className="hv-hint">
          Chain depth counts everything inside the box that matches <code>:hover</code> at once — the control{" "}
          <em>and every ancestor above it</em>, which is why a whole card lights up when you hover one icon. Steals
          so far: <strong>{steals}</strong>. Tab to a button instead of hovering it:{" "}
          <code>:focus-within</code> opens the same surface, because hover-only information is unreachable otherwise.
        </p>
      </div>
    </LabShell>
  );
}
