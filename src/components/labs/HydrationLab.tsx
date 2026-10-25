import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

const STEPS = ["HTML arrives", "Painted", "Hydrating", "Interactive"];

export default function HydrationLab() {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [runId, setRunId] = useState(0);
  const [slow, setSlow] = useState(false);
  const [saves, setSaves] = useState(0);
  const [gapClicks, setGapClicks] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setPhase(0);
    setProgress(0);
    setSaves(0);
    setGapClicks(0);

    const scale = slow ? 2.2 : 1;
    const paintAt = (reduceMotion ? 200 : 420) * scale;
    const hydrateAt = (reduceMotion ? 500 : 1200) * scale;
    const readyAt = (reduceMotion ? 850 : 2000) * scale;

    const timers = [
      window.setTimeout(() => setPhase(1), paintAt),
      window.setTimeout(() => setPhase(2), hydrateAt),
      window.setTimeout(() => {
        setProgress(1);
        setPhase(3);
      }, readyAt),
    ];

    let value = 0;
    const step = 1 / Math.max(1, (hydrateAt - paintAt) / 50);
    const progressTimer = window.setInterval(() => {
      value = Math.min(1, value + step);
      setProgress(value);
    }, 50);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(progressTimer);
    };
  }, [runId, slow, reduceMotion]);

  const ready = phase === 3;

  const save = () => {
    if (!ready) {
      setGapClicks((value) => value + 1);
      return;
    }
    setSaves((value) => value + 1);
  };

  return (
    <LabShell
      title="The page looks finished before it can answer"
      description="This simulated island paints from HTML, then downloads and hydrates its JavaScript. Click the save button at any point and watch the gap between looking ready and being ready."
      accent="#40518c"
      foot="Measure first paint and hydration separately; the distance between them is the gap users feel."
    >
      <div className="hyd-stage" data-phase={phase}>
        <div className="hyd-frame">
          <div className="hyd-chrome" aria-hidden="true">
            <span className="hyd-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="hyd-url">ohaio.example/field-notes/retry-storm</span>
            <span className="hyd-chip" data-state={ready ? "ready" : "waiting"}>
              {ready ? "Interactive" : STEPS[phase]}
            </span>
          </div>

          <div className="hyd-page">
            <div className="hyd-page-head">
              <span className="hyd-kicker">Field notes</span>
              <h4>The retry that never stopped</h4>
            </div>
            <div className="hyd-lines" aria-hidden="true">
              <span />
              <span />
              <span className="hyd-line-short" />
            </div>
            <div className="hyd-actions">
              <button
                type="button"
                className="hyd-save"
                data-ready={ready}
                onClick={save}
                aria-describedby="hyd-feedback"
              >
                {ready ? "Save this note" : "Preparing…"}
              </button>
              <span className="hyd-count">{ready ? `${saves} saved` : `${gapClicks} early clicks`}</span>
            </div>
            <div className="hyd-scan" aria-hidden="true" />
          </div>

          <div className="hyd-download">
            <span>Island JavaScript</span>
            <div className="hyd-download-track" aria-hidden="true">
              <motion.span
                initial={false}
                animate={{ scaleX: ready ? 1 : progress }}
                transition={{ duration: reduceMotion ? 0 : 0.1, ease: "linear" }}
              />
            </div>
            <span>{ready ? "attached" : `${Math.round(progress * 100)}%`}</span>
          </div>
        </div>

        <ol className="hyd-timeline">
          {STEPS.map((step, index) => (
            <li
              key={step}
              data-state={index < phase ? "done" : index === phase ? "active" : "waiting"}
            >
              <span className="hyd-step-dot" aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <p className="hyd-feedback" id="hyd-feedback" aria-live="polite">
          {ready
            ? "The island owns the button now. Clicks run the handler."
            : phase === 0
              ? "HTML is still arriving. Nothing is on screen yet."
              : "The page is painted, but the handler is not attached. A click here does nothing."}
        </p>
      </div>

      <div className="lab-row">
        <div className="lab-toggle" role="group" aria-label="Network profile">
          <button type="button" aria-pressed={!slow} onClick={() => setSlow(false)}>
            Fast
          </button>
          <button type="button" aria-pressed={slow} onClick={() => setSlow(true)}>
            Slow network
          </button>
        </div>
        <button type="button" className="lab-button" onClick={() => setRunId((value) => value + 1)}>
          Replay hydration
        </button>
      </div>
    </LabShell>
  );
}
