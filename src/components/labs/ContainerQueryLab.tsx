import { useCallback, useEffect, useRef, useState } from "react";
import LabShell from "./LabShell";

type FrameType = "inline" | "none";

const THRESHOLD_REM = 20;

export default function ContainerQueryLab() {
  const [widthRem, setWidthRem] = useState(20);
  const [frameType, setFrameType] = useState<FrameType>("inline");

  const [viewport, setViewport] = useState(0);
  const [containerPx, setContainerPx] = useState(0);
  const [containerCols, setContainerCols] = useState(1);
  const [mediaCols, setMediaCols] = useState(1);
  const [titlePx, setTitlePx] = useState(0);

  const frameRef = useRef<HTMLDivElement>(null);
  const cqCardRef = useRef<HTMLDivElement>(null);
  const mqCardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);

  const measure = useCallback(() => {
    setViewport(window.innerWidth);
    const frame = frameRef.current;
    if (frame) setContainerPx(Math.round(frame.getBoundingClientRect().width));
    const tracks = (el: HTMLElement | null) => {
      if (!el) return 1;
      const cols = getComputedStyle(el).gridTemplateColumns;
      return cols.split(" ").filter((s) => s && s !== "none").length;
    };
    setContainerCols(tracks(cqCardRef.current));
    setMediaCols(tracks(mqCardRef.current));
    if (titleRef.current) setTitlePx(Math.round(Number.parseFloat(getComputedStyle(titleRef.current).fontSize)));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [widthRem, frameType, measure]);

  const agree = containerCols === mediaCols;

  const card = (variant: "container" | "media", ref: React.RefObject<HTMLDivElement | null>) => (
    <div
      ref={ref}
      className="cq-card"
      data-variant={variant}
    >
      <div className="cq-thumb" aria-hidden="true" />
      <div className="cq-body">
        {variant === "container" ? (
          <strong ref={titleRef} className="cq-title">
            Card title
          </strong>
        ) : (
          <strong className="cq-title">Card title</strong>
        )}
        <p className="cq-text">
          {variant === "container"
            ? "Layout driven by the container's own width."
            : "Layout driven by the viewport width."}
        </p>
      </div>
    </div>
  );

  return (
    <LabShell
      title="A component should respond to its own box, not the browser window"
      description="Drag the width of the container. Two identical cards sit inside it — one styled with @container, one with @media. They disagree, and the disagreement is the entire point: the media-query card is answering a question nobody asked it."
      accent="var(--indigo)"
      foot="container-type: inline-size turns an element into a query container. Its children then measure that element, so the same card can look right in a sidebar and a full-width page without a single breakpoint on the viewport."
    >
      <div className="cq-bar">
        <label className="cq-slider">
          <span>Container width</span>
          <input
            type="range"
            min={12}
            max={44}
            step={1}
            value={widthRem}
            onChange={(e) => setWidthRem(Number(e.target.value))}
            aria-label="Container width in rem"
          />
          <b>{widthRem} rem</b>
        </label>
        <div className="lab-chips" role="group" aria-label="container-type">
          <button type="button" aria-pressed={frameType === "inline"} onClick={() => setFrameType("inline")}>
            container-type: inline-size
          </button>
          <button type="button" aria-pressed={frameType === "none"} onClick={() => setFrameType("none")}>
            none
          </button>
        </div>
      </div>

      <div
        ref={frameRef}
        className="cq-frame"
        data-type={frameType}
        style={{ inlineSize: `${widthRem}rem` }}
      >
        <p className="cq-flag">
          {frameType === "none"
            ? "No query container — @container can't match, so the container card is frozen."
            : `Query container active — @container flips at ${THRESHOLD_REM}rem.`}
        </p>
        <div className="cq-stack">
          {card("container", cqCardRef)}
          {card("media", mqCardRef)}
        </div>
      </div>

      <div className="lab-metrics cq-metrics">
        <div className="lab-metric">
          <span>Viewport width</span>
          <strong>{viewport} px</strong>
        </div>
        <div className="lab-metric">
          <span>Container width</span>
          <strong>{containerPx} px</strong>
        </div>
        <div className="lab-metric">
          <span>@container card</span>
          <strong>{containerCols} col</strong>
        </div>
        <div className="lab-metric">
          <span>@media card</span>
          <strong>{mediaCols} col</strong>
        </div>
        <div className="lab-metric">
          <span>Title (6cqi)</span>
          <strong>{titlePx} px</strong>
        </div>
        <div className="lab-metric">
          <span>Cards agree?</span>
          <strong>{agree ? "yes" : "no"}</strong>
        </div>
      </div>

      <div className="lab-row">
        <pre className="cq-code">{`.card-wrap {
  container-type: inline-size;
}

/* responds to the wrap, not the window */
@container (min-width: ${THRESHOLD_REM}rem) {
  .card { grid-template-columns: 8rem 1fr; }
}

/* the same threshold, wrong signal */
@media (min-width: ${THRESHOLD_REM}rem) {
  .card { grid-template-columns: 8rem 1fr; }
}

.card-title { font-size: 6cqi; } /* 1cqi = 1% of container inline size */`}</pre>
        <p className="cq-hint">
          The viewport stays fixed, so the <strong>@media card never changes</strong> — it is locked to whichever
          layout the browser width implies. The <strong>@container card</strong> flips to two columns the moment the
          box crosses {THRESHOLD_REM}rem, tracking the space the card actually has. Watch <strong>Cards agree?</strong>{" "}
          go <em>no</em> in the narrow range: that gap is a component rendering a layout chosen for a viewport it does
          not live in. The title is sized in <code>cqi</code>, so its pixel height rides the container width too. Set{" "}
          <strong>container-type: none</strong> and the flip stops — with no query container, <code>@container</code>{" "}
          has nothing to measure and the card freezes at one column.
        </p>
      </div>
    </LabShell>
  );
}
