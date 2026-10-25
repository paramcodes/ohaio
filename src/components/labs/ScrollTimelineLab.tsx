import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Strategy = "css" | "js";

const CHAPTERS = [
  {
    title: "Position is the input",
    body: "Scroll progress is a ratio: how far the content has moved through its scrollable range. No clock, no easing, no queue.",
  },
  {
    title: "The range is the timeline",
    body: "scroll() maps 0–100% of the container's scroll range. view() maps an element's own passage through the scrollport.",
  },
  {
    title: "Remove the duration",
    body: "A scroll timeline ignores duration. Keep linear timing; a curve would make the visual lag behind the gesture.",
  },
  {
    title: "Read once per frame",
    body: "In a JS fallback, listen passively and update inside requestAnimationFrame. Never measure layout in a scroll handler.",
  },
  {
    title: "Sticky is the stage",
    body: "The gauge stays in place while chapters pass. It is a readout of the scroll, not an entrance animation.",
  },
  {
    title: "Stop at decoration",
    body: "Essential content must not depend on how far someone scrolls. If the motion is only ornamental, reduced motion can freeze it.",
  },
];

export default function ScrollTimelineLab() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("css");
  const [progress, setProgress] = useState(0);
  const [range, setRange] = useState(0);
  const [mounted, setMounted] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const reduceMotion = mounted && prefersReduced === true;
  const useNative = supported === true && strategy === "css" && !reduceMotion;
  const animate = supported !== null && !reduceMotion;

  useEffect(() => {
    setMounted(true);
    const ok =
      typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
    setSupported(ok);
    if (!ok) setStrategy("js");
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const measure = () => {
      const max = viewport.scrollHeight - viewport.clientHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, viewport.scrollTop / max)) : 0;
      viewport.style.setProperty("--stl-progress", value.toFixed(4));
      setRange(Math.round(max));
      const next = Math.round(value * 100);
      setProgress((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  const goTo = (edge: "start" | "end") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: edge === "end" ? viewport.scrollHeight : 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const supportLabel =
    supported === null
      ? "Checking timeline support"
      : reduceMotion
        ? "Reduced motion: gauge frozen"
        : supported
          ? "Native scroll timeline available"
          : "No native timeline";
  const timelineLabel =
    supported === null
      ? "Checking"
      : useNative
        ? "CSS scroll()"
        : reduceMotion
          ? "Static"
          : "JS fallback";

  return (
    <LabShell
      title="Scroll position is the clock"
      description="The gauge is not playing an animation when you arrive. It is already at the value the scroll position implies. Scroll the panel and watch the two representations agree."
      accent="#9a4a33"
      foot="Native timelines run off the main thread. The JS fallback is a few lines, but it must read the scroll position once per frame."
    >
      <div className="stl-bar">
        <span
          className="stl-support"
          data-supported={supported === true ? "true" : "false"}
        >
          <i aria-hidden="true" />
          {supportLabel}
        </span>
        <div className="lab-toggle" role="group" aria-label="Animation strategy">
          <button
            type="button"
            aria-pressed={strategy === "css"}
            disabled={supported === false}
            onClick={() => setStrategy("css")}
          >
            CSS timeline
          </button>
          <button
            type="button"
            aria-pressed={strategy === "js"}
            onClick={() => setStrategy("js")}
          >
            JS fallback
          </button>
        </div>
      </div>

      <div
        className="stl-viewport"
        ref={viewportRef}
        role="region"
        aria-label="Scroll-driven animation demo"
        tabIndex={0}
        data-native={useNative}
        data-motion={animate}
      >
        <div className="stl-layout">
          <div className="stl-visual" aria-hidden="true">
            <div className="stl-gauge">
              <span className="stl-ticks">
                {Array.from({ length: 13 }, (_, index) => (
                  <i
                    key={index}
                    style={{ transform: `rotate(${-120 + index * 20}deg)` }}
                  />
                ))}
              </span>
              <span className="stl-needle" />
              <span className="stl-hub" />
            </div>
            <span className="stl-percent">{progress}%</span>
            <span className="stl-visual-label">scroll progress</span>
            <span className="stl-progress">
              <span className="stl-progress-fill" />
            </span>
          </div>

          <div className="stl-chapters">
            {CHAPTERS.map((chapter, index) => (
              <article className="stl-chapter" key={chapter.title}>
                <span className="stl-chapter-num">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong className="stl-chapter-title">{chapter.title}</strong>
                <p>{chapter.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <p className="stl-hint">Scroll inside the panel, or focus it and use the arrow keys.</p>

      <div className="lab-metrics">
        <div className="lab-metric">
          <span>Progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="lab-metric">
          <span>Timeline</span>
          <strong>{timelineLabel}</strong>
        </div>
        <div className="lab-metric">
          <span>Scroll range</span>
          <strong>{range}px</strong>
        </div>
      </div>

      <div className="lab-row">
        <code className="stl-code">
          {".gauge {\n  animation: turn linear both;\n  animation-timeline: scroll(nearest block);\n}"}
        </code>
        <div className="lab-actions">
          <button
            type="button"
            className="lab-button lab-button--quiet"
            onClick={() => goTo("start")}
          >
            Back to start
          </button>
          <button type="button" className="lab-button" onClick={() => goTo("end")}>
            Jump to end
          </button>
        </div>
      </div>
    </LabShell>
  );
}
