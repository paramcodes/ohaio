import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Style = "sweep" | "pulse" | "static";
type Tech = "band" | "gradient";

const codeFor = (style: Style, tech: Tech) => {
  if (style === "pulse") {
    return `.block {
  animation: pulse var(--cycle)
    ease-in-out infinite;
}
@keyframes pulse {
  50% { opacity: 0.9; }
}`;
  }
  if (style === "static") {
    return `@media (prefers-reduced-motion: reduce) {
  .band { animation: none; }
}
/* the status line carries it now */`;
  }
  if (tech === "gradient") {
    return `.block {
  background-size: 220% 100%;
  animation: slide var(--cycle) linear infinite;
}
@keyframes slide {
  from { background-position: 160% 0; }
  to   { background-position: -60% 0; }
}`;
  }
  return `.card { overflow: clip; }
.band {
  inset-inline-start: -100%;
  inline-size: 100%;
  animation: sweep var(--cycle) linear infinite;
}
@keyframes sweep {
  to { transform: translateX(200%); }
}`;
};

const COST: Record<Style | Tech, string> = {
  sweep: "composite",
  pulse: "composite",
  static: "none",
  band: "skips paint",
  gradient: "repaints",
};

export default function ShimmerLab() {
  const [style, setStyle] = useState<Style>("sweep");
  const [tech, setTech] = useState<Tech>("band");
  const [cycle, setCycle] = useState(1200);
  const [onScreen, setOnScreen] = useState(true);
  const [mounted, setMounted] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const reduceMotion = mounted && prefersReduced === true;

  const active = reduceMotion ? "static" : style;
  const animate = active !== "static";
  const paused = !onScreen;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const card = cardRef.current;
    const frame = frameRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries[entries.length - 1].isIntersecting),
      { root: frame, threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <LabShell
      title="Shimmer is a claim about the wait, not the work"
      description="Nothing here computes anything. The moving light only says the request is still alive, which is why it belongs on short waits and not on a job with a real percentage."
      accent="#8a5c2e"
      foot="Move a band with transform, pause it once nobody can see it, and stop the loop when the wait has an honest number to show."
    >
      <div className="shm-bar">
        <div className="lab-toggle" role="group" aria-label="Loop style">
          <button
            type="button"
            aria-pressed={style === "sweep"}
            onClick={() => setStyle("sweep")}
            disabled={reduceMotion}
          >
            Sweep
          </button>
          <button
            type="button"
            aria-pressed={style === "pulse"}
            onClick={() => setStyle("pulse")}
            disabled={reduceMotion}
          >
            Pulse
          </button>
          <button
            type="button"
            aria-pressed={style === "static"}
            onClick={() => setStyle("static")}
            disabled={reduceMotion}
          >
            Static
          </button>
        </div>
        <div className="lab-toggle" role="group" aria-label="How the sweep moves">
          <button
            type="button"
            aria-pressed={tech === "band"}
            onClick={() => setTech("band")}
            disabled={active !== "sweep"}
          >
            Move a band
          </button>
          <button
            type="button"
            aria-pressed={tech === "gradient"}
            onClick={() => setTech("gradient")}
            disabled={active !== "sweep"}
          >
            Slide a gradient
          </button>
        </div>
      </div>

      <div className="shm-frame" ref={frameRef}>
        <div
          ref={cardRef}
          className="shm-card"
          data-style={active}
          data-tech={tech}
          data-paused={paused}
          style={{ "--shm-cycle": `${cycle}ms` } as CSSProperties}
          aria-hidden="true"
        >
          {active === "sweep" && tech === "band" ? <span className="shm-band" /> : null}
          <span className="shm-row shm-row--head">
            <span className="shm-block shm-block--avatar" />
            <span className="shm-stack">
              <span className="shm-block" style={{ inlineSize: "70%" }} />
              <span className="shm-block" style={{ inlineSize: "45%" }} />
            </span>
          </span>
          <span className="shm-block shm-block--wide" />
          <span className="shm-block shm-block--wide" style={{ inlineSize: "92%" }} />
          <span className="shm-block" style={{ inlineSize: "58%" }} />
        </div>
        <div className="shm-filler" aria-hidden="true">
          <p>Scroll this panel down.</p>
          {Array.from({ length: 12 }, (_, i) => (
            <span className="shm-line" key={i} />
          ))}
        </div>
        <p className="shm-hint">
          The loop keeps burning frames while it is only half off screen. An IntersectionObserver
          pauses it here.
        </p>
      </div>

      <div className="lab-metrics shm-metrics">
        <div className="lab-metric">
          <span>Animated</span>
          <strong>
            {active === "sweep" ? (tech === "band" ? "transform" : "background-position") : active === "pulse" ? "opacity" : "nothing"}
          </strong>
        </div>
        <div className="lab-metric">
          <span>Cost</span>
          <strong>
            {active === "sweep" ? COST[tech] : COST[active]}
          </strong>
        </div>
        <div className="lab-metric">
          <span>Play state</span>
          <strong>{animate ? (paused ? "paused" : "running") : "static"}</strong>
        </div>
      </div>

      <div className="lab-row">
        <label className="lab-control">
          <span className="lab-control-top">
            Cycle length
            <output>{cycle}ms</output>
          </span>
          <input
            type="range"
            min={600}
            max={2400}
            step={100}
            value={cycle}
            onChange={(event) => setCycle(Number(event.target.value))}
            disabled={active === "static"}
          />
        </label>
        <p className="shm-code">{codeFor(active, tech)}</p>
      </div>
    </LabShell>
  );
}
