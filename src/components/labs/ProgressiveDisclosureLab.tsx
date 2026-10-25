import { useCallback, useEffect, useRef, useState } from "react";
import LabShell from "./LabShell";

type Method = "display" | "visibility" | "opacity" | "hidden" | "inert";

const METHODS: [Method, string][] = [
  ["display", "display: none"],
  ["visibility", "visibility: hidden"],
  ["opacity", "opacity: 0"],
  ["hidden", "hidden attr"],
  ["inert", "inert"],
];

const METHOD_LABEL: Record<Method, string> = {
  display: "display: none",
  visibility: "visibility: hidden",
  opacity: "opacity: 0",
  hidden: "the hidden attribute",
  inert: "the inert attribute",
};

export default function ProgressiveDisclosureLab() {
  const [method, setMethod] = useState<Method>("display");
  const [open, setOpen] = useState(true);
  const [height, setHeight] = useState("—");
  const [focusable, setFocusable] = useState("—");
  const [perceivable, setPerceivable] = useState("—");
  const [landed, setLanded] = useState("nothing yet — press Tab from “Start here”");

  const stage = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const box = panel.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setHeight(`${Math.round(rect.height)} px`);

    const style = getComputedStyle(box);
    const shown = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    setPerceivable(shown ? "yes" : "no");

    // A control is reachable only if it is laid out, visible, and not inert.
    // opacity is deliberately absent: a transparent control is still focusable.
    const rendered = style.display !== "none" && style.visibility !== "hidden";
    const inert = box.inert || !!box.closest("[inert]");
    setFocusable(rendered && !inert ? "yes" : "no");
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [method, open, measure]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      if (!el) return;
      const name = el.dataset.stop ?? "the page";
      const insideCollapsed = panel.current?.contains(el) && !open;
      setLanded(insideCollapsed ? `${name} — inside the collapsed panel` : name);
    };
    node.addEventListener("focusin", onFocusIn);
    return () => node.removeEventListener("focusin", onFocusIn);
  }, [open]);

  const code = [
    `.panel {`,
    `  /* revealed */`,
    `}`,
    ``,
    `.collapsed .panel {`,
    method === "display" && `  display: none;`,
    method === "visibility" && `  visibility: hidden;`,
    method === "opacity" && `  opacity: 0;`,
    `}`,
    method === "hidden" && `\n/* collapsed */\n<details-panel hidden>`,
    method === "inert" && `\n/* collapsed, but still painted */\n<details-panel inert>`,
    method === "opacity" &&
      `\n/* opacity alone leaves it focusable —\n   add one of these to finish the hide: */\n  visibility: hidden;   /* or display: none, or inert */`,
  ]
    .filter((line) => line !== false && line !== "")
    .join("\n");

  return (
    <LabShell
      title="Hiding is not one thing"
      description="Reveal a block of advanced options, then collapse it five different ways. Only some of them actually take the content out of the keyboard's way — and the difference is invisible until someone presses Tab."
      accent="#3f5d8a"
      foot="Collapse the panel, then press Tab from “Start here”. If focus walks into controls you cannot see, that method hid pixels but not the interface."
    >
      <div className="pd-bar">
        <div className="lab-toggle" role="group" aria-label="Disclosure state">
          <button type="button" aria-expanded={open} aria-controls="pd-panel" onClick={() => setOpen((v) => !v)}>
            {open ? "Collapse" : "Reveal"} advanced options
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="How the panel is hidden when collapsed">
          {METHODS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={method === id} onClick={() => setMethod(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pd-stage" ref={stage} data-method={method} data-open={open ? "true" : "false"}>
        <button type="button" className="pd-btn pd-start" data-stop="Start here">
          Start here — then press Tab
        </button>

        <div
          className="pd-panel"
          id="pd-panel"
          ref={panel}
          hidden={method === "hidden" && !open}
          inert={method === "inert" && !open}
        >
          <p className="pd-panel-note">Advanced options — {METHOD_LABEL[method]} when collapsed.</p>
          <label className="pd-field">
            <span className="pd-label">Cache-Control</span>
            <input className="pd-input" type="text" defaultValue="max-age=31536000" data-control data-stop="Cache-Control field" />
          </label>
          <button type="button" className="pd-btn" data-control data-stop="Apply advanced">
            Apply advanced
          </button>
        </div>

        <button type="button" className="pd-btn pd-submit" data-stop="Submit order">
          Submit order
        </button>
      </div>

      <div className="lab-metrics pd-metrics">
        <div className="lab-metric">
          <span>Panel height</span>
          <strong>{height}</strong>
        </div>
        <div className="lab-metric">
          <span>Control focusable</span>
          <strong>{focusable}</strong>
        </div>
        <div className="lab-metric">
          <span>Perceivable</span>
          <strong>{perceivable}</strong>
        </div>
        <div className="lab-metric">
          <span>Tab landed on</span>
          <strong>{landed}</strong>
        </div>
      </div>

      <div className="lab-row">
        <pre className="pd-code">{code}</pre>
        <p className="pd-hint">
          <code>display: none</code> and the <code>hidden</code> attribute remove the box from layout and the
          accessibility tree. <code>visibility: hidden</code> keeps the space but is still un-focusable.{" "}
          <code>inert</code> keeps it painted and laid out yet un-operable. Only <code>opacity: 0</code> leaves the
          controls fully reachable — which is why a fade-out must land on one of the others, not stop at transparent.
        </p>
      </div>
    </LabShell>
  );
}
