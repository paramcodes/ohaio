import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import LabShell from "./LabShell";

type Policy = "block" | "drop";

interface Preset {
  id: string;
  label: string;
  arrival: number;
  service: number;
  capacity: number;
  policy: Policy;
}

const TICK_MS = 100;
const HISTORY_POINTS = 72;
const HIGH_WATER = 0.8;
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const PRESETS: Preset[] = [
  { id: "saturated", label: "Sustained overload", arrival: 1000, service: 200, capacity: 120, policy: "block" },
  { id: "burst", label: "Short burst", arrival: 1000, service: 900, capacity: 80, policy: "block" },
  { id: "balanced", label: "Balanced", arrival: 240, service: 240, capacity: 60, policy: "block" },
  { id: "shed", label: "Load shedding", arrival: 1000, service: 200, capacity: 70, policy: "drop" },
];

function formatRate(value: number) {
  return `${value.toLocaleString("en")}/s`;
}

export default function BackpressureLab() {
  const [arrival, setArrival] = useState(1000);
  const [service, setService] = useState(200);
  const [capacity, setCapacity] = useState(120);
  const [policy, setPolicy] = useState<Policy>("block");
  const [running, setRunning] = useState(true);
  const [backlog, setBacklog] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);
  const [totals, setTotals] = useState({ admitted: 0, rejected: 0, completed: 0 });
  const buffer = useRef(0);
  const counters = useRef({ admitted: 0, rejected: 0, completed: 0 });
  const config = useRef({ arrival, service, capacity, policy });
  const reduceMotion = useReducedMotion();

  config.current = { arrival, service, capacity, policy };

  const reset = () => {
    buffer.current = 0;
    counters.current = { admitted: 0, rejected: 0, completed: 0 };
    setBacklog(0);
    setHistory([0]);
    setTotals({ admitted: 0, rejected: 0, completed: 0 });
  };

  const applyPreset = (preset: Preset) => {
    setArrival(preset.arrival);
    setService(preset.service);
    setCapacity(preset.capacity);
    setPolicy(preset.policy);
    config.current = {
      arrival: preset.arrival,
      service: preset.service,
      capacity: preset.capacity,
      policy: preset.policy,
    };
    reset();
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const current = config.current;
      const dt = TICK_MS / 1000;
      const processed = Math.min(current.service * dt, buffer.current);
      const arrived = current.arrival * dt;
      let next = buffer.current - processed + arrived;
      let rejected = 0;

      if (next > current.capacity) {
        rejected = next - current.capacity;
        next = current.capacity;
      }

      buffer.current = next;
      counters.current.admitted += arrived - rejected;
      counters.current.rejected += rejected;
      counters.current.completed += processed;

      setBacklog(next);
      setTotals({ ...counters.current });
      setHistory((previous) => [
        ...previous.slice(-(HISTORY_POINTS - 1)),
        next / current.capacity,
      ]);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [running]);

  const injectBurst = () => {
    buffer.current = Math.min(capacity, buffer.current + 40);
    setBacklog(buffer.current);
    setHistory((previous) => [
      ...previous.slice(-(HISTORY_POINTS - 1)),
      buffer.current / capacity,
    ]);
  };

  const fill = Math.min(1, backlog / Math.max(1, capacity));
  const waitSeconds = backlog / Math.max(1, service);
  const status = fill >= 0.98 ? "At capacity" : fill >= 0.55 ? "Filling" : "Stable";
  const tone = fill >= 0.98 ? "danger" : fill >= 0.55 ? "warn" : "calm";
  const rejectedLabel = policy === "block" ? "Held upstream" : "Dropped";
  const span = Math.max(1, history.length - 1);
  const points = history
    .map((value, index) => {
      const x = (index / span) * 200;
      const y = 44 - Math.min(1, value) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <LabShell
      title="Watch a queue absorb a burst, then stop absorbing it"
      description="The producer and consumer run in real time. Push arrivals past the service rate and the buffer fills; at the capacity line, the policy decides whether work is held upstream or dropped."
      accent="#35604f"
      foot="A queue buys time. It does not add processing capacity."
    >
      <div className="bp-flow" data-tone={tone}>
        <div className="bp-node">
          <span className="bp-node-label">Producer</span>
          <strong>{formatRate(arrival)}</strong>
          <span className="bp-node-note">arrival</span>
        </div>

        <div className="bp-link" data-active={running}>
          <span
            className="bp-packet"
            style={{ "--packet-time": `${Math.max(0.45, 1400 / Math.max(1, arrival))}s` } as CSSProperties}
          />
          <span
            className="bp-packet bp-packet--second"
            style={{ "--packet-time": `${Math.max(0.45, 1400 / Math.max(1, arrival))}s` } as CSSProperties}
          />
        </div>

        <div className="bp-buffer">
          <div className="bp-buffer-head">
            <span>Buffer</span>
            <span>
              {Math.round(backlog)} / {capacity}
            </span>
          </div>
          <div className="bp-buffer-track" aria-hidden="true">
            <motion.span
              className="bp-buffer-fill"
              initial={false}
              animate={{ scaleX: fill }}
              transition={{ duration: reduceMotion ? 0 : TICK_MS / 1000, ease: "linear" }}
            />
            <span className="bp-buffer-mark" style={{ insetInlineStart: `${HIGH_WATER * 100}%` }} />
          </div>
          <div className="bp-buffer-foot">
            <span className={`bp-status bp-status--${tone}`}>{status}</span>
            <span>{waitSeconds.toFixed(1)}s wait</span>
          </div>
        </div>

        <div className="bp-link" data-active={running}>
          <span
            className="bp-packet bp-packet--out"
            style={{ "--packet-time": `${Math.max(0.45, 1400 / Math.max(1, service))}s` } as CSSProperties}
          />
        </div>

        <div className="bp-node">
          <span className="bp-node-label">Consumer</span>
          <strong>{formatRate(service)}</strong>
          <span className="bp-node-note">drain</span>
        </div>
      </div>

      <div className="bp-trend" aria-hidden="true">
        <svg viewBox="0 0 200 46" preserveAspectRatio="none">
          <line className="bp-trend-hwm" x1="0" x2="200" y1={44 - HIGH_WATER * 40} y2={44 - HIGH_WATER * 40} />
          <polygon className="bp-trend-area" points={`0,44 ${points} 200,44`} />
          <polyline className="bp-trend-line" points={points} />
        </svg>
        <span className="bp-trend-label">Backlog / capacity</span>
      </div>

      <div className="lab-metrics" aria-live="off">
        <div className="lab-metric">
          <span>Backlog</span>
          <strong>{Math.round(backlog)}</strong>
        </div>
        <div className="lab-metric">
          <span>{rejectedLabel}</span>
          <strong>{compact.format(totals.rejected)}</strong>
        </div>
        <div className="lab-metric">
          <span>Admitted</span>
          <strong>{compact.format(totals.admitted)}</strong>
        </div>
        <div className="lab-metric">
          <span>Completed</span>
          <strong>{compact.format(totals.completed)}</strong>
        </div>
      </div>

      <div className="lab-controls">
        <label className="lab-control" htmlFor="bp-arrival">
          <span className="lab-control-top">
            <span>Arrival rate</span>
            <output>{formatRate(arrival)}</output>
          </span>
          <input
            id="bp-arrival"
            type="range"
            min={100}
            max={2000}
            step={50}
            value={arrival}
            onChange={(event) => setArrival(Number(event.target.value))}
          />
        </label>
        <label className="lab-control" htmlFor="bp-service">
          <span className="lab-control-top">
            <span>Service rate</span>
            <output>{formatRate(service)}</output>
          </span>
          <input
            id="bp-service"
            type="range"
            min={50}
            max={2000}
            step={50}
            value={service}
            onChange={(event) => setService(Number(event.target.value))}
          />
        </label>
        <label className="lab-control" htmlFor="bp-capacity">
          <span className="lab-control-top">
            <span>Queue capacity</span>
            <output>{capacity}</output>
          </span>
          <input
            id="bp-capacity"
            type="range"
            min={20}
            max={300}
            step={10}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="lab-row">
        <div className="lab-toggle" role="group" aria-label="Overload policy">
          <button
            type="button"
            aria-pressed={policy === "block"}
            onClick={() => setPolicy("block")}
          >
            Hold producer
          </button>
          <button
            type="button"
            aria-pressed={policy === "drop"}
            onClick={() => setPolicy("drop")}
          >
            Drop excess
          </button>
        </div>
        <div className="lab-actions">
          <button type="button" className="lab-button lab-button--quiet" onClick={injectBurst}>
            Burst +40
          </button>
          <button type="button" className="lab-button lab-button--quiet" onClick={reset}>
            Reset
          </button>
          <button type="button" className="lab-button" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Run"}
          </button>
        </div>
      </div>

      <div className="lab-chips" aria-label="Scenarios">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
    </LabShell>
  );
}
