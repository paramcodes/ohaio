import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Phase = "ready" | "loading";

const ROWS = [
  { title: "Tide tables, north coast", body: "Measured 1948 to 2019." },
  { title: "Why the ferry lies", body: "Crew rosters, not weather." },
  { title: "A harbour that moves", body: "Silt, dredging, and maps." },
];

const BOX = "4rem";

function measure(head: HTMLElement | null, mark: HTMLElement | null) {
  if (!head || !mark) return 0;
  return mark.getBoundingClientRect().top - head.getBoundingClientRect().top;
}

export default function SkeletonLab() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [mirror, setMirror] = useState(true);
  const [latency, setLatency] = useState(1400);
  const [shiftA, setShiftA] = useState(0);
  const [shiftB, setShiftB] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [replayed, setReplayed] = useState(false);

  const headA = useRef<HTMLDivElement>(null);
  const headB = useRef<HTMLDivElement>(null);
  const markA = useRef<HTMLDivElement>(null);
  const markB = useRef<HTMLDivElement>(null);
  const baseA = useRef(0);
  const baseB = useRef(0);
  const armed = useRef(false);

  const prefersReduced = useReducedMotion();
  const reduceMotion = mounted && prefersReduced === true;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (phase !== "loading") return;
    const timer = window.setTimeout(() => setPhase("ready"), latency);
    return () => window.clearTimeout(timer);
  }, [phase, latency]);

  useLayoutEffect(() => {
    if (phase === "loading") {
      baseA.current = measure(headA.current, markA.current);
      baseB.current = measure(headB.current, markB.current);
      armed.current = true;
      return;
    }
    if (!armed.current) return;
    armed.current = false;
    const frame = requestAnimationFrame(() => {
      setShiftA(Math.max(0, Math.round(measure(headA.current, markA.current) - baseA.current)));
      setShiftB(Math.max(0, Math.round(measure(headB.current, markB.current) - baseB.current)));
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const replay = () => {
    setReplayed(true);
    setShiftA(0);
    setShiftB(0);
    setPhase("loading");
  };

  const loading = phase === "loading";

  return (
    <LabShell
      title="A skeleton is a promise about geometry"
      description="Both panels replace the same placeholder with the same three rows. Only one of them promised the real height, so only one keeps the text below it still."
      accent="#4a5a7a"
      foot="Reserve the space first. A placeholder that guesses short shifts the page exactly as much as no placeholder at all."
    >
      <div className="sk-bar">
        <div className="lab-toggle" role="group" aria-label="Placeholder fidelity">
          <button type="button" aria-pressed={mirror} onClick={() => setMirror(true)}>
            Mirrors the layout
          </button>
          <button type="button" aria-pressed={!mirror} onClick={() => setMirror(false)}>
            A box of guesswork
          </button>
        </div>
        <button type="button" className="lab-button" onClick={replay} disabled={loading}>
          Replay the load
        </button>
      </div>

      <div className="sk-panels">
        <div className="sk-panel">
          <div className="sk-head" ref={headA}>
            <span className="sk-head-label">Placeholder</span>
            <span className="sk-state" data-loading={loading}>
              {loading ? "loading" : "arrived"}
            </span>
          </div>
          <div className="sk-slot" aria-busy={loading}>
            {loading ? (
              mirror ? (
                <div className="sk-rows" aria-hidden="true">
                  {ROWS.map((row) => (
                    <div className="sk-row" key={row.title}>
                      <span className="sk-block sk-block--thumb" />
                      <span className="sk-lines">
                        <span className="sk-block sk-line" style={{ inlineSize: "88%" }} />
                        <span className="sk-block sk-line" style={{ inlineSize: "62%" }} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sk-guess" style={{ blockSize: BOX }} aria-hidden="true" />
              )
            ) : (
              <div className="sk-rows" data-enter={replayed}>
                {ROWS.map((row) => (
                  <div className="sk-row" key={row.title}>
                    <span className="sk-thumb" aria-hidden="true" />
                    <span className="sk-lines">
                      <strong>{row.title}</strong>
                      <em>{row.body}</em>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sk-mark" ref={markA}>
            <span>the block after this list</span>
          </div>
          <p className="sk-shift" data-zero={shiftA === 0}>
            {shiftA === 0 ? "0 px moved" : `${shiftA} px moved`}
          </p>
        </div>

        <div className="sk-panel">
          <div className="sk-head" ref={headB}>
            <span className="sk-head-label">Spinner</span>
            <span className="sk-state" data-loading={loading}>
              {loading ? "loading" : "arrived"}
            </span>
          </div>
          <div className="sk-slot" aria-busy={loading}>
            {loading ? (
              <div className="sk-spinner-box" style={{ blockSize: BOX }}>
                <span className="sk-spinner" aria-hidden="true" data-motion={!reduceMotion} />
                <span className="sk-spinner-text">Working on it</span>
                <span className="visually-hidden">Loading content</span>
              </div>
            ) : (
              <div className="sk-rows" data-enter={replayed}>
                {ROWS.map((row) => (
                  <div className="sk-row" key={row.title}>
                    <span className="sk-thumb" aria-hidden="true" />
                    <span className="sk-lines">
                      <strong>{row.title}</strong>
                      <em>{row.body}</em>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sk-mark" ref={markB}>
            <span>the block after this list</span>
          </div>
          <p className="sk-shift" data-zero={shiftB === 0}>
            {shiftB === 0 ? "0 px moved" : `${shiftB} px moved`}
          </p>
        </div>
      </div>

      <div className="lab-metrics sk-metrics">
        <div className="lab-metric">
          <span>Placeholder</span>
          <strong>{mirror ? "Mirrored" : "Guessed"}</strong>
        </div>
        <div className="lab-metric">
          <span>Wait</span>
          <strong>{(latency / 1000).toFixed(1)}s</strong>
        </div>
        <div className="lab-metric">
          <span>Shift</span>
          <strong>{loading ? "measuring" : `${shiftA} / ${shiftB} px`}</strong>
        </div>
      </div>

      <div className="lab-row">
        <label className="lab-control">
          <span className="lab-control-top">
            How long the request takes
            <output>{latency}ms</output>
          </span>
          <input
            type="range"
            min={300}
            max={4000}
            step={100}
            value={latency}
            onChange={(event) => setLatency(Number(event.target.value))}
          />
        </label>
        <p className="sk-code">
          {".row {"}
          {"\n  /* the skeleton and the real card agree on this */"}
          {"\n  min-block-size: 3.4rem;"}
          {"\n}"}
        </p>
      </div>
    </LabShell>
  );
}
