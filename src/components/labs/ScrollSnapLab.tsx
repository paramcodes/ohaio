import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Strictness = "none" | "proximity" | "mandatory";
type Align = "start" | "center";

const PLATES = [
  { id: "tide", numeral: "01", title: "Tide", note: "Low water, long light" },
  { id: "ridge", numeral: "02", title: "Ridge", note: "Weather along the spine" },
  { id: "moss", numeral: "03", title: "Moss", note: "Rain kept in the shade" },
  { id: "dusk", numeral: "04", title: "Dusk", note: "The hour without edges" },
  { id: "snow", numeral: "05", title: "Snow", note: "Sound arriving late" },
];

const STRICTNESS: { id: Strictness; label: string }[] = [
  { id: "none", label: "Off" },
  { id: "proximity", label: "Proximity" },
  { id: "mandatory", label: "Mandatory" },
];

const ALIGNMENTS: { id: Align; label: string }[] = [
  { id: "start", label: "Start" },
  { id: "center", label: "Center" },
];

export default function ScrollSnapLab() {
  const [strictness, setStrictness] = useState<Strictness>("mandatory");
  const [align, setAlign] = useState<Align>("start");
  const [oneAtATime, setOneAtATime] = useState(false);
  const [active, setActive] = useState(0);
  const [offset, setOffset] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduceMotion = useReducedMotion();

  const readPosition = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const styles = getComputedStyle(viewport);
    const padding = parseFloat(styles.scrollPaddingInlineStart) || 0;
    const anchor =
      align === "center" ? bounds.left + bounds.width / 2 : bounds.left + padding;

    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const position = align === "center" ? rect.left + rect.width / 2 : rect.left;
      const next = Math.abs(position - anchor);
      if (next < distance) {
        distance = next;
        nearest = index;
      }
    });

    setActive(nearest);
    setOffset(Math.round(distance));
  }, [align]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readPosition);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(readPosition);
    observer.observe(viewport);
    readPosition();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [readPosition]);

  const jump = (index: number) => {
    const viewport = viewportRef.current;
    const card = cardRefs.current[index];
    if (!viewport || !card) return;
    const styles = getComputedStyle(viewport);
    const padding = parseFloat(styles.scrollPaddingInlineStart) || 0;
    const left =
      align === "center"
        ? card.offsetLeft + card.offsetWidth / 2 - viewport.clientWidth / 2
        : card.offsetLeft - padding;
    viewport.scrollTo({
      left: Math.max(0, left),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const guide = align === "center" ? "50%" : "0.85rem";
  const snapType =
    strictness === "none" ? "none" : (`inline ${strictness}` as const);
  const snapTypeCode = strictness === "none" ? "none" : `inline ${strictness}`;

  return (
    <LabShell
      title="Scroll snap is a set of resting positions"
      description="The browser still follows your hand. What changes is where the motion is allowed to stop. Move the strip, then change the rule underneath it."
      accent="#3c6b5c"
      foot="Use mandatory only when every stop is meaningful; use proximity when the content is read at its own pace."
    >
      <div className="snap-frame">
        <div
          className="snap-viewport"
          ref={viewportRef}
          role="region"
          aria-label="Scroll snap gallery"
          tabIndex={0}
          style={{
            scrollSnapType: snapType,
            scrollPaddingInline: align === "center" ? "0px" : "0.85rem",
          }}
        >
          <div className="snap-track" data-align={align}>
            {PLATES.map((plate, index) => (
              <button
                key={plate.id}
                type="button"
                className="snap-card"
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                style={{
                  scrollSnapAlign: align,
                  scrollSnapStop: oneAtATime ? "always" : "normal",
                }}
                onClick={() => jump(index)}
                aria-label={`Move plate ${plate.numeral} to the snap line`}
              >
                <span className={`snap-art snap-art--${plate.id}`} aria-hidden="true">
                  <span className="snap-art-num">{plate.numeral}</span>
                </span>
                <span className="snap-card-copy">
                  <strong>{plate.title}</strong>
                  <small>{plate.note}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <span
          className="snap-guide"
          aria-hidden="true"
          data-hidden={strictness === "none"}
          style={{ insetInlineStart: guide }}
        />
      </div>

      <p className="snap-hint">
        Drag the strip, scroll it, or focus it and use the arrow keys. The dashed line is the
        snapport edge where a plate comes to rest.
      </p>

      <div className="lab-metrics snap-metrics">
        <div className="lab-metric">
          <span>Strictness</span>
          <strong>{strictness === "none" ? "Off" : strictness}</strong>
        </div>
        <div className="lab-metric">
          <span>Nearest plate</span>
          <strong>{PLATES[active].numeral}</strong>
        </div>
        <div className="lab-metric">
          <span>Off snap</span>
          <strong>{offset}px</strong>
        </div>
      </div>

      <div className="snap-readout">
        <div className="snap-dots" aria-hidden="true">
          {PLATES.map((plate, index) => (
            <span key={plate.id} data-active={index === active} />
          ))}
        </div>
        <span className="snap-readout-label">{PLATES[active].title}</span>
      </div>

      <div className="snap-controls">
        <div className="snap-control">
          <span className="snap-control-label">Strictness</span>
          <div className="lab-toggle" role="group" aria-label="Snap strictness">
            {STRICTNESS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === strictness}
                onClick={() => setStrictness(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="snap-control">
          <span className="snap-control-label">Alignment</span>
          <div className="lab-toggle" role="group" aria-label="Snap alignment">
            {ALIGNMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === align}
                onClick={() => setAlign(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="snap-control">
          <span className="snap-control-label">Snap stop</span>
          <div className="lab-toggle" role="group" aria-label="Snap stop">
            <button
              type="button"
              aria-pressed={!oneAtATime}
              onClick={() => setOneAtATime(false)}
            >
              Normal
            </button>
            <button
              type="button"
              aria-pressed={oneAtATime}
              onClick={() => setOneAtATime(true)}
            >
              Every plate
            </button>
          </div>
        </div>
      </div>

      <div className="lab-row">
        <code className="snap-code">
          scroll-snap-type: {snapTypeCode}; scroll-snap-align: {align};
        </code>
        <button type="button" className="lab-button lab-button--quiet" onClick={() => jump(3)}>
          Jump to plate 04
        </button>
      </div>
    </LabShell>
  );
}
