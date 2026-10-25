import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

interface Preset extends SpringParams {
  id: string;
  label: string;
}

const PRESETS: Preset[] = [
  { id: "snappy", label: "Snappy", stiffness: 320, damping: 30, mass: 1 },
  { id: "gentle", label: "Gentle", stiffness: 140, damping: 24, mass: 1 },
  { id: "bouncy", label: "Bouncy", stiffness: 260, damping: 18, mass: 1 },
  { id: "heavy", label: "Heavy", stiffness: 180, damping: 26, mass: 2.4 },
];

const GRAPH_W = 260;
const GRAPH_H = 84;
const GRAPH_PAD = 10;

const dampingRatio = ({ stiffness, damping, mass }: SpringParams) =>
  damping / (2 * Math.sqrt(stiffness * mass));

const character = (ratio: number) => {
  if (ratio < 0.95) return "Underdamped";
  if (ratio > 1.05) return "Overdamped";
  return "Critical";
};

export default function SpringLab() {
  const [params, setParams] = useState<SpringParams>({
    stiffness: 260,
    damping: 20,
    mass: 1,
  });
  const [runId, setRunId] = useState(0);
  const [travel, setTravel] = useState(0);
  const [samples, setSamples] = useState<[number, number][]>([]);
  const [result, setResult] = useState<{ settle: number; overshoot: number } | null>(
    null,
  );
  const laneRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<{ stop: () => void } | null>(null);
  const paramsRef = useRef(params);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  paramsRef.current = params;

  useEffect(() => {
    const lane = laneRef.current;
    const ball = ballRef.current;
    const target = targetRef.current;
    if (!lane || !ball || !target) return;
    const measure = () => {
      const styles = getComputedStyle(lane);
      const start =
        lane.clientLeft + parseFloat(styles.paddingInlineStart);
      const targetX =
        target.getBoundingClientRect().left - lane.getBoundingClientRect().left;
      setTravel(Math.max(0, targetX - start - ball.offsetWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(lane);
    return () => observer.disconnect();
  }, []);

  const startSpring = () => {
    if (!travel) return;
    activeRef.current?.stop();
    activeRef.current = null;
    x.set(0);
    setSamples([]);
    setResult(null);

    if (reduceMotion) {
      x.set(travel);
      setResult({ settle: 0, overshoot: 0 });
      return;
    }

    const started = performance.now();
    const points: [number, number][] = [[0, 0]];
    let peak = 0;
    let frame = 0;
    const spring = paramsRef.current;

    const unsubscribe = x.on("change", (value) => {
      peak = Math.max(peak, value - travel);
      points.push([performance.now() - started, value]);
      frame += 1;
      if (frame % 4 === 0) setSamples(points.slice());
    });

    const controls = animate(x, travel, {
      type: "spring",
      stiffness: spring.stiffness,
      damping: spring.damping,
      mass: spring.mass,
      onComplete: () => {
        unsubscribe();
        setSamples(points.slice());
        setResult({
          settle: Math.round(performance.now() - started),
          overshoot: Math.max(0, Math.round(peak)),
        });
      },
    });

    activeRef.current = {
      stop: () => {
        unsubscribe();
        controls.stop();
      },
    };
  };

  useEffect(() => {
    if (travel) startSpring();
  }, [travel]);

  useEffect(() => {
    if (runId > 0) startSpring();
  }, [runId]);

  useEffect(() => () => activeRef.current?.stop(), []);

  const setValue = (key: keyof SpringParams, value: number) =>
    setParams((current) => ({ ...current, [key]: value }));

  const run = () => setRunId((value) => value + 1);

  const reset = () => {
    activeRef.current?.stop();
    activeRef.current = null;
    x.set(0);
    setSamples([]);
    setResult(null);
  };

  const applyPreset = (preset: Preset) => {
    setParams({
      stiffness: preset.stiffness,
      damping: preset.damping,
      mass: preset.mass,
    });
    run();
  };

  const ratio = dampingRatio(params);
  const span = Math.max(360, result?.settle ?? 0, samples.at(-1)?.[0] ?? 0);
  const ceiling = Math.max(
    travel,
    1,
    ...samples.map(([, value]) => value),
  );
  const points = samples
    .map(([time, value]) => {
      const px = GRAPH_PAD + (time / span) * (GRAPH_W - GRAPH_PAD * 2);
      const py =
        GRAPH_H -
        GRAPH_PAD -
        (Math.max(0, value) / ceiling) * (GRAPH_H - GRAPH_PAD * 2);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const targetY =
    GRAPH_H -
    GRAPH_PAD -
    (travel / ceiling) * (GRAPH_H - GRAPH_PAD * 2);

  return (
    <LabShell
      title="Spring or curve?"
      description="A spring has no fixed duration. Pull the three parameters, then run it: the same distance settles differently depending on strength, resistance, and inertia."
      accent="var(--indigo)"
      foot="Damping ratio ζ = damping / (2 × √(stiffness × mass)). Below 1 it overshoots; at 1 it settles as fast as possible without crossing the target."
    >
      <div className="spring-stage">
        <div className="spring-lane" ref={laneRef}>
          <span className="spring-rail" aria-hidden="true" />
          <span className="spring-target" ref={targetRef} aria-hidden="true" />
          <motion.div
            className="spring-ball"
            ref={ballRef}
            style={{ x }}
            data-settled={result ? "true" : "false"}
          >
            <span>spring</span>
            <i aria-hidden="true" />
          </motion.div>
          <span className="spring-end spring-end--start">Start</span>
          <span className="spring-end spring-end--target">Target</span>
        </div>

        <svg
          className="spring-graph"
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          role="img"
          aria-label="Position over time while the spring settles"
        >
          <line
            className="spring-graph-target"
            x1={GRAPH_PAD}
            x2={GRAPH_W - GRAPH_PAD}
            y1={targetY}
            y2={targetY}
          />
          {points ? (
            <polyline className="spring-graph-line" points={points} />
          ) : (
            <circle
              className="spring-graph-dot"
              cx={GRAPH_PAD}
              cy={GRAPH_H - GRAPH_PAD}
              r="3"
            />
          )}
        </svg>

        <div className="spring-metrics lab-metrics">
          <div className="lab-metric">
            <span>Damping ratio</span>
            <strong>{ratio.toFixed(2)}</strong>
          </div>
          <div className="lab-metric">
            <span>Character</span>
            <strong>{character(ratio)}</strong>
          </div>
          <div className="lab-metric">
            <span>Overshoot</span>
            <strong>{result ? `${result.overshoot}px` : "—"}</strong>
          </div>
          <div className="lab-metric">
            <span>Settled in</span>
            <strong>{result ? `${result.settle}ms` : "—"}</strong>
          </div>
        </div>
      </div>

      <div className="lab-chips" aria-label="Spring presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={
              params.stiffness === preset.stiffness &&
              params.damping === preset.damping &&
              params.mass === preset.mass
            }
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="lab-controls">
        <label className="lab-control">
          <span className="lab-control-top">
            Stiffness
            <output>{params.stiffness}</output>
          </span>
          <input
            type="range"
            min="60"
            max="420"
            step="10"
            value={params.stiffness}
            onChange={(event) =>
              setValue("stiffness", Number(event.currentTarget.value))
            }
          />
        </label>
        <label className="lab-control">
          <span className="lab-control-top">
            Damping
            <output>{params.damping}</output>
          </span>
          <input
            type="range"
            min="4"
            max="50"
            step="1"
            value={params.damping}
            onChange={(event) =>
              setValue("damping", Number(event.currentTarget.value))
            }
          />
        </label>
        <label className="lab-control">
          <span className="lab-control-top">
            Mass
            <output>{params.mass.toFixed(1)}</output>
          </span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={params.mass}
            onChange={(event) =>
              setValue("mass", Number(event.currentTarget.value))
            }
          />
        </label>
      </div>

      <div className="lab-row">
        <p className="spring-hint">
          Lower damping adds bounce. Higher mass makes the same spring feel heavier.
        </p>
        <div className="lab-actions">
          <button className="lab-button lab-button--quiet" type="button" onClick={reset}>
            Reset
          </button>
          <button className="lab-button" type="button" onClick={run}>
            Run spring
          </button>
        </div>
      </div>
    </LabShell>
  );
}
