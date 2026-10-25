import { useCallback, useEffect, useRef, useState } from "react";
import LabShell from "./LabShell";

type Ring = "page" | "none" | "custom";

const SLOTS = [
  { label: "Standard", detail: "4 days" },
  { label: "Express", detail: "next day" },
  { label: "Pickup", detail: "today" },
];

export default function FocusLab() {
  const [ring, setRing] = useState<Ring>("page");
  const [boost, setBoost] = useState(false);
  const [preventScroll, setPreventScroll] = useState(false);
  const [inerted, setInerted] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const [active, setActive] = useState("—");
  const [visible, setVisible] = useState("—");
  const [drawn, setDrawn] = useState("—");
  const [moved, setMoved] = useState("—");
  const [refused, setRefused] = useState("not tried");

  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const apply = useRef<HTMLButtonElement>(null);
  const gift = useRef<HTMLButtonElement>(null);

  const stopName = (el: Element | null) =>
    el?.getAttribute("data-stop") ?? (el ? el.tagName.toLowerCase() : "the page");

  const capture = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      setActive("the page");
      setVisible("—");
      setDrawn("—");
      return;
    }
    const name = el.getAttribute("data-stop") ?? el.tagName.toLowerCase();
    setActive(name);
    setVisible(el.matches(":focus-visible") ? "yes" : "no");
    const style = getComputedStyle(el).outlineStyle;
    setDrawn(style === "auto" ? "auto, 1px" : `${style}, ${getComputedStyle(el).outlineWidth}`);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onFocusIn = (event: FocusEvent) => {
      const label = stopName(event.target as Element);
      capture();
      setPath((current) => (current[current.length - 1] === label ? current : [...current, label].slice(-10)));
    };
    node.addEventListener("focusin", onFocusIn);
    return () => node.removeEventListener("focusin", onFocusIn);
  }, [capture]);

  const focusOffscreen = () => {
    const box = scroller.current;
    if (!box || !apply.current) return;
    box.scrollTop = 0; // so the delta is the reveal distance every time it is pressed
    const before = box.scrollTop;
    apply.current.focus({ preventScroll });
    setMoved(`${Math.round(box.scrollTop - before)} px`);
    capture();
  };

  const focusInert = () => {
    const el = gift.current;
    if (!el) return;
    const before = document.activeElement;
    el.focus({ preventScroll: true });
    const landedOn =
      document.activeElement === el
        ? "it took focus"
        : document.activeElement === before
          ? "refused — focus stayed on the button you pressed"
          : `refused — focus went to ${stopName(document.activeElement)}`;
    setRefused(landedOn);
    capture();
  };

  const reset = () => {
    setPath([]);
    setMoved("—");
    setRefused("not tried");
    (document.activeElement as HTMLElement | null)?.blur();
    setActive("—");
    setVisible("—");
    setDrawn("—");
  };

  return (
    <LabShell
      title="Focus is where the keyboard currently is"
      description="Press Tab inside the form. Nothing here traps it — the point is to watch where it really goes, which stops get skipped, and what happens to the ring when you take the outline away."
      accent="#3f5d8a"
      foot="Every stop in the path was decided by the browser from the DOM and the tabindex attribute. The card you can click is not one of them."
    >
      <div className="fc-bar">
        <div className="lab-toggle" role="group" aria-label="Focus ring source">
          <button type="button" aria-pressed={ring === "page"} onClick={() => setRing("page")}>
            site ring
          </button>
          <button type="button" aria-pressed={ring === "none"} onClick={() => setRing("none")}>
            outline: none
          </button>
          <button type="button" aria-pressed={ring === "custom"} onClick={() => setRing("custom")}>
            custom ring
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Tab order">
          <button type="button" aria-pressed={boost} onClick={() => setBoost((b) => !b)}>
            tabindex=2 on Terms
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Focus scrolling">
          <button type="button" aria-pressed={preventScroll} onClick={() => setPreventScroll((p) => !p)}>
            preventScroll
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Inert region">
          <button type="button" aria-pressed={inerted} onClick={() => setInerted((i) => !i)}>
            make the extras inert
          </button>
        </div>
      </div>

      <div className="fc-stage" ref={root} data-ring={ring}>
        <div className="fc-form">
          <button type="button" className="fc-btn" data-stop="Back">
            Back
          </button>

          <div className="fc-card" role="button" data-stop="Card">
            <strong>Gift wrap</strong>
            <span>clickable, not a tab stop</span>
          </div>

          <fieldset className="fc-fieldset">
            <legend>Delivery</legend>
            {SLOTS.map((slot, index) => (
              <label className="fc-radio" key={slot.label}>
                <input
                  type="radio"
                  name="fc-delivery"
                  defaultChecked={index === 1}
                  data-stop={slot.label}
                  aria-label={`${slot.label}, ${slot.detail}`}
                />
                <span>
                  {slot.label} <em>{slot.detail}</em>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="fc-field">
            <span className="fc-label">Coupon</span>
            <input className="fc-input" type="text" placeholder="AUTUMN" data-stop="Coupon input" />
          </label>

          <div className="fc-scroll" ref={scroller}>
            <div className="fc-tall">
              <p>Two hundred lines of order summary…</p>
              <button type="button" className="fc-btn" ref={apply} data-stop="Apply coupon">
                Apply coupon
              </button>
            </div>
          </div>

          <div className="fc-extra" inert={inerted}>
            <button type="button" className="fc-btn fc-btn--quiet" ref={gift} data-stop="Gift receipt">
              Gift receipt
            </button>
            <a className="fc-link" href="#fc-stage" data-stop="Terms" tabIndex={boost ? 2 : undefined}>
              Terms
            </a>
          </div>
        </div>

        <div className="fc-side">
          <div className="lab-actions">
            <button type="button" className="lab-button" data-stop="Focus offscreen" onClick={focusOffscreen}>
              Focus “Apply coupon”
            </button>
            <button
              type="button"
              className="lab-button lab-button--quiet"
              data-stop="Focus gift receipt"
              onClick={focusInert}
            >
              Focus “Gift receipt”
            </button>
            <button type="button" className="lab-button lab-button--quiet" data-stop="Clear path" onClick={reset}>
              Clear path
            </button>
          </div>
          <ol className="fc-path" aria-label="Tab stops visited">
            {path.length === 0 ? <li className="fc-path-empty">no stops yet — press Tab in the form</li> : null}
            {path.map((stop, index) => (
              <li key={`${stop}-${index}`} data-current={index === path.length - 1}>
                {stop}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="lab-metrics fc-metrics">
        <div className="lab-metric">
          <span>Active element</span>
          <strong>{active}</strong>
        </div>
        <div className="lab-metric">
          <span>Ring drawn</span>
          <strong>{drawn}</strong>
        </div>
        <div className="lab-metric">
          <span>:focus-visible</span>
          <strong>{visible}</strong>
        </div>
        <div className="lab-metric">
          <span>Scroller moved</span>
          <strong>{moved}</strong>
        </div>
      </div>

      <div className="lab-row">
        <p className="fc-readout">
          <code>gift.focus()</code> while the region is inert: <strong>{refused}</strong>
        </p>
        <p className="fc-hint">
          The radio group is one stop, not three — arrow keys move inside it. The card with the <code>onclick</code>{" "}
          is not a stop at all, and calling <code>focus()</code> on it does nothing. Switch to{" "}
          <code>outline: none</code> and press Tab: the focus state stays completely real, it only goes invisible.
          Turning on <code>tabindex="2"</code> does not move Terms one stop earlier — any positive number sends it
          after every <code>0</code> stop on the page, so it lands past the end of the document, behind this page's
          own scrollable code blocks.
        </p>
      </div>
    </LabShell>
  );
}
