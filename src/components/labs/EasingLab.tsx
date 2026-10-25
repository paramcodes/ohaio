import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

interface EasingPreset {
  id: string;
  label: string;
  value: [number, number, number, number];
  note: string;
}

const EASINGS: EasingPreset[] = [
  { id: "linear", label: "Linear", value: [0, 0, 1, 1], note: "Constant speed. Correct for progress and scrubbed motion." },
  { id: "out", label: "Ease out", value: [0.23, 1, 0.32, 1], note: "Fast start, soft landing. The default for entrances." },
  { id: "inout", label: "Ease in-out", value: [0.77, 0, 0.175, 1], note: "Slow at both ends. Good for movement already on screen." },
  { id: "drawer", label: "Drawer", value: [0.32, 0.72, 0, 1], note: "A steep start that reads as immediate on large surfaces." },
  { id: "overshoot", label: "Overshoot", value: [0.34, 1.4, 0.64, 1], note: "Passes the target and settles back. Use sparingly." },
];

const DOT = 26;
const W = 216;
const H = 132;

const curveX = (value: number) => 10 + value * (W - 20);
const curveY = (value: number) => H - 12 - ((value + 0.12) / 1.4) * (H - 24);

function curvePath([x1, y1, x2, y2]: EasingPreset["value"]) {
  return `M ${curveX(0)} ${curveY(0)} C ${curveX(x1)} ${curveY(y1)}, ${curveX(x2)} ${curveY(y2)}, ${curveX(1)} ${curveY(1)}`;
}

export default function EasingLab() {
  const [easingId, setEasingId] = useState("out");
  const [duration, setDuration] = useState(420);
  const [runId, setRunId] = useState(0);
  const [travel, setTravel] = useState(0);
  const laneRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const easing = EASINGS.find((item) => item.id === easingId) ?? EASINGS[1];

  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    const measure = () => setTravel(Math.max(0, lane.clientWidth - DOT));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(lane);
    return () => observer.disconnect();
  }, []);

  const replay = () => setRunId((value) => value + 1);

  const chooseEasing = (id: string) => {
    setEasingId(id);
    setRunId((value) => value + 1);
  };

  const durationSeconds = duration / 1000;
  const motionDuration = reduceMotion ? 0 : durationSeconds;
  const cssTiming = `cubic-bezier(${easing.value.join(", ")})`;

  return (
    <LabShell
      title="Easing is a shape, not a decoration"
      description="Two dots travel the same distance for the same time. Only the curve differs, so you can see where the motion spends its speed."
      accent="#8d522e"
      foot="Pick the curve that matches the element's job, then keep routine UI under 300ms."
    >
      <div className="ease-stage">
        <div className="ease-graph">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curve for ${easing.label} easing`}>
            <line className="ease-grid" x1={curveX(0)} x2={curveX(1)} y1={curveY(0)} y2={curveY(0)} />
            <line className="ease-grid" x1={curveX(0)} x2={curveX(1)} y1={curveY(1)} y2={curveY(1)} />
            <path className="ease-linear" d={curvePath([0, 0, 1, 1])} />
            <motion.path
              key={easing.id}
              className="ease-curve"
              d={curvePath(easing.value)}
              initial={{ pathLength: reduceMotion ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.23, 1, 0.32, 1] }}
            />
            <text className="ease-axis" x={curveX(0)} y={H - 1}>0</text>
            <text className="ease-axis" x={curveX(1)} y={H - 1} textAnchor="end">time</text>
          </svg>
          <span className="ease-graph-label">{easing.label}</span>
        </div>

        <div className="ease-lanes">
          <div className="ease-lane">
            <div className="ease-track" ref={laneRef}>
              <span className="ease-tick" style={{ insetInlineStart: "25%" }} />
              <span className="ease-tick" style={{ insetInlineStart: "50%" }} />
              <span className="ease-tick" style={{ insetInlineStart: "75%" }} />
              <motion.span
                key={`ghost-${runId}-${duration}`}
                className="ease-dot ease-dot--ghost"
                initial={{ x: 0 }}
                animate={{ x: travel }}
                transition={{ duration: motionDuration, ease: "linear" }}
              />
              <motion.span
                key={`dot-${runId}-${easing.id}-${duration}`}
                className="ease-dot"
                initial={{ x: 0 }}
                animate={{ x: travel }}
                transition={{ duration: motionDuration, ease: easing.value }}
              />
            </div>
            <span className="ease-lane-legend">
              <i className="ease-legend-swatch" /> selected
              <i className="ease-legend-swatch ease-legend-swatch--ghost" /> linear
            </span>
          </div>

          <motion.div
            key={`card-${runId}-${easing.id}-${duration}`}
            className="ease-demo-card"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: motionDuration, ease: easing.value }}
          >
            <span className="ease-demo-icon" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>Saved to your map</strong>
              <small>The same curve, on a real surface.</small>
            </span>
          </motion.div>
        </div>
      </div>

      <p className="ease-note">{easing.note}</p>

      <div className="lab-controls">
        <label className="lab-control" htmlFor="ease-duration">
          <span className="lab-control-top">
            <span>Duration</span>
            <output>{duration}ms</output>
          </span>
          <input
            id="ease-duration"
            type="range"
            min={100}
            max={900}
            step={20}
            value={duration}
            onChange={(event) => {
              setDuration(Number(event.target.value));
              replay();
            }}
          />
        </label>
      </div>

      <div className="lab-chips" aria-label="Easing curves">
        {EASINGS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === easing.id}
            onClick={() => chooseEasing(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="lab-row">
        <code className="ease-code">
          transition: transform {duration}ms {cssTiming};
        </code>
        <button type="button" className="lab-button" onClick={replay}>
          Play again
        </button>
      </div>
    </LabShell>
  );
}
