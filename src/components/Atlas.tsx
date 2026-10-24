import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import graphData from "@/data/graph.json";
import {
  DOMAIN_META,
  DOMAIN_ORDER,
  type ConceptStatus,
  type DomainId,
} from "@/lib/site";

type NodeType = "domain" | "layer" | "concept";

interface AtlasNode {
  id: string;
  label: string;
  jp?: string;
  type: NodeType;
  domain: string;
  layer: string;
  layerName?: string;
  status: ConceptStatus;
  url: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface AtlasEdge {
  source: string;
  target: string;
}

interface AtlasData {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}

const isDomainId = (value: string): value is DomainId =>
  (DOMAIN_ORDER as string[]).includes(value);

function isAtlasData(value: unknown): value is AtlasData {
  if (!value || typeof value !== "object") return false;
  const data = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(data.nodes) && Array.isArray(data.edges);
}

const atlas: AtlasData = isAtlasData(graphData)
  ? graphData
  : { nodes: [], edges: [] };

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  domain: "Domain",
  layer: "Layer",
  concept: "Concept",
};

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const bounds = atlas.nodes.reduce(
  (acc, node) => ({
    minX: Math.min(acc.minX, node.x),
    maxX: Math.max(acc.maxX, node.x),
    minY: Math.min(acc.minY, node.y),
    maxY: Math.max(acc.maxY, node.y),
  }),
  { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
);

const graphSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;

interface FocusPoint {
  x: number;
  y: number;
  ratio: number;
}

const graphCenterX = (bounds.minX + bounds.maxX) / 2;
const graphCenterY = (bounds.minY + bounds.maxY) / 2;

const focusPoints = new Map<DomainId, FocusPoint>();
for (const domain of DOMAIN_ORDER) {
  const nodes = atlas.nodes.filter((node) => node.domain === domain);
  if (nodes.length === 0) continue;
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const span = Math.max(maxX - minX, maxY - minY, 200);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  focusPoints.set(domain, {
    x: 0.5 + (centerX - graphCenterX) / graphSpan,
    y: 0.5 + (centerY - graphCenterY) / graphSpan,
    ratio: Math.min(1, Math.max(0.18, (span / graphSpan) * 1.12)),
  });
}

type Filter = "all" | DomainId;

export default function Atlas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<{
    refresh: () => void;
    kill: () => void;
    setNodeState: (key: string, state: Record<string, unknown>) => unknown;
    setEdgeState: (key: string, state: Record<string, unknown>) => unknown;
    getCamera: () => {
      animate: (state: Record<string, number>, options?: Record<string, unknown>) => Promise<void>;
      zoomIn: (options?: Record<string, unknown>) => Promise<void>;
      zoomOut: (options?: Record<string, unknown>) => Promise<void>;
      reset: (options?: Record<string, unknown>) => Promise<void>;
    };
    getNodeState: (key: string) => { isHovered: boolean };
  } | null>(null);
  const graphRef = useRef<{
    areNeighbors: (a: string, b: string) => boolean;
    extremities: (edge: string) => [string, string];
  } | null>(null);
  const moveRef = useRef<(action: "in" | "out" | "reset") => void>(() => {});
  const hoveredRef = useRef<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<AtlasNode | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const reduceMotion = useReducedMotion();

  const durations = useMemo(
    () => (reduceMotion ? { duration: 0 } : { duration: 520 }),
    [reduceMotion],
  );

  const applyFilter = useCallback((next: Filter) => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    for (const node of atlas.nodes) {
      const hidden = next !== "all" && node.domain !== next;
      sigma.setNodeState(node.id, { isHidden: hidden });
    }

    const visible = new Set(
      atlas.nodes.filter((node) => next === "all" || node.domain === next).map((node) => node.id),
    );
    for (const edge of atlas.edges) {
      const id = `${edge.source}->${edge.target}`;
      const hidden = !visible.has(edge.source) || !visible.has(edge.target);
      sigma.setEdgeState(id, { isHidden: hidden });
    }

    if (next === "all") {
      void sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, durations);
    } else {
      const point = focusPoints.get(next);
      if (point) {
        void sigma.getCamera().animate(
          { x: point.x, y: point.y, ratio: point.ratio },
          durations,
        );
      }
    }

    sigma.refresh();
  }, [durations]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    const boot = async () => {
      const [{ default: Sigma, DEFAULT_STYLES }, { default: Graph }] = await Promise.all([
        import("sigma"),
        import("graphology"),
      ]);
      if (disposed || !containerRef.current) return;

      const graph = new Graph();
      for (const node of atlas.nodes) {
        const meta = isDomainId(node.domain) ? DOMAIN_META[node.domain] : null;
        graph.addNode(node.id, {
          ...node,
          color: meta?.atlas ?? node.color,
          opacity: node.type === "concept" ? 0.82 : node.type === "layer" ? 0.92 : 1,
        });
      }
      for (const edge of atlas.edges) {
        if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
        const node = graph.getNodeAttributes(edge.source) as AtlasNode;
        const meta = isDomainId(node.domain) ? DOMAIN_META[node.domain] : null;
        graph.addEdgeWithKey(`${edge.source}->${edge.target}`, edge.source, edge.target, {
          color: hexToRgba(meta?.atlas ?? "#8b8fa3", 0.32),
          size: 1.05,
        });
      }

      graphRef.current = {
        areNeighbors: (a, b) => graph.areNeighbors(a, b),
        extremities: (edge) => graph.extremities(edge),
      };

      try {
        const sigma = new Sigma(graph, containerRef.current, {
          settings: {
            autoRescale: true,
            autoRescaleContent: "positions",
            renderEdgeLabels: false,
            enableEdgeEvents: false,
            labelDensity: 1.15,
            labelGridCellSize: 120,
            labelRenderedSizeThreshold: 0,
            stagePadding: window.matchMedia("(max-width: 720px)").matches ? 58 : 34,
            minCameraRatio: 0.1,
            maxCameraRatio: 2.6,
            hideLabelsOnMove: true,
            inertiaDuration: 380,
            zoomDuration: 280,
          },
          styles: {
            ...DEFAULT_STYLES,
            stage: { background: "transparent" },
            nodes: [
              {
                ...DEFAULT_STYLES.nodes,
                labelVisibility: {
                  whenState: "isHovered",
                  then: "visible",
                  else: "hidden",
                },
                labelColor: "#ded9cd",
                labelFont: "JetBrains Mono Variable, monospace",
                labelSize: 11,
                cursor: "pointer",
              },
              {
                whenState: "isHovered",
                then: {
                  labelSize: 13,
                  labelColor: "#f7f3e9",
                  opacity: 1,
                  backdropVisibility: "visible",
                  backdropColor: "#1a1b27",
                  backdropBorderColor: "#43465f",
                  backdropBorderWidth: 1,
                  backdropCornerRadius: 3,
                  backdropPadding: 4,
                  backdropShadowColor: "rgba(0, 0, 0, 0.6)",
                  backdropShadowBlur: 9,
                },
              },
              {
                when: (attrs) => attrs.type === "domain",
                then: {
                  labelVisibility: "visible",
                  labelSize: 15,
                  labelColor: "#f4f0e6",
                  opacity: 1,
                },
              },
              {
                when: (attrs) => attrs.type === "layer",
                then: { opacity: 0.92 },
              },
            ],
            edges: [
              {
                ...DEFAULT_STYLES.edges,
                color: { attribute: "color" },
                size: { attribute: "size", defaultValue: 1.05 },
                opacity: 0.82,
              },
            ],
          },
          nodeReducer: (key, data) => {
            const hovered = hoveredRef.current;
            if (!hovered) return data;
            if (key === hovered) return { ...data, opacity: 1 };
            const graphRefValue = graphRef.current;
            if (graphRefValue?.areNeighbors(hovered, key)) {
              return { ...data, opacity: 1 };
            }
            return {
              ...data,
              opacity: 0.2,
              labelVisibility: "hidden",
              backdropVisibility: "hidden",
            };
          },
          edgeReducer: (edge, data) => {
            const hovered = hoveredRef.current;
            if (!hovered) return data;
            const [source, target] = graphRef.current?.extremities(edge) ?? ["", ""];
            if (source === hovered || target === hovered) {
              return { ...data, opacity: 1, size: 1.8 };
            }
            return { ...data, opacity: 0.12 };
          },
        });

        const moveCamera = (action: "in" | "out" | "reset") => {
          const camera = sigma.getCamera();
          const options = reduceMotion ? { duration: 0 } : { duration: 260 };
          if (action === "in") void camera.zoomIn(options);
          if (action === "out") void camera.zoomOut(options);
          if (action === "reset") {
            setFilter("all");
            applyFilter("all");
          }
        };
        moveRef.current = moveCamera;

        const onEnter = ({ node }: { node: string }) => {
          hoveredRef.current = node;
          const attrs = graph.getNodeAttributes(node) as AtlasNode;
          setPreview(attrs);
          sigma.refresh();
        };

        const onLeave = () => {
          hoveredRef.current = null;
          setPreview(null);
          sigma.refresh();
        };

        const onClick = ({
          node,
          event,
        }: {
          node: string;
          event: { original: MouseEvent | TouchEvent };
        }) => {
          const attrs = graph.getNodeAttributes(node) as AtlasNode;
          if (!attrs.url) return;
          const pointer = event.original;
          const modified =
            pointer instanceof MouseEvent && (pointer.metaKey || pointer.ctrlKey);
          if (modified) {
            window.open(attrs.url, "_blank", "noopener");
          } else {
            window.location.assign(attrs.url);
          }
        };

        sigma.on("enterNode", onEnter);
        sigma.on("leaveNode", onLeave);
        sigma.on("clickNode", onClick);

        sigmaRef.current = {
          refresh: () => sigma.refresh(),
          kill: () => sigma.kill(),
          setNodeState: (key, state) => sigma.setNodeState(key, state),
          setEdgeState: (key, state) => sigma.setEdgeState(key, state),
          getCamera: () => {
            const camera = sigma.getCamera();
            return {
              animate: (state, options) => camera.animate(state, options),
              zoomIn: (options) => camera.zoomIn(options),
              zoomOut: (options) => camera.zoomOut(options),
              reset: (options) => camera.reset(options),
            };
          },
          getNodeState: (key) => {
            const state = sigma.getNodeState(key);
            return { isHovered: state.isHovered };
          },
        };

        setReady(true);

        cleanup = () => {
          sigma.off("enterNode", onEnter);
          sigma.off("leaveNode", onLeave);
          sigma.off("clickNode", onClick);
          sigma.kill();
          sigmaRef.current = null;
          graphRef.current = null;
          moveRef.current = () => {};
        };
      } catch (error) {
        console.error("Atlas failed to initialise", error);
        if (!disposed) setFailed(true);
      }
    };

    void boot();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [reduceMotion]);

  const filterLabel = filter === "all" ? "All domains" : DOMAIN_META[filter].name;

  return (
    <>
      <div className="atlas-shell">
        <div ref={containerRef} className="atlas-canvas" aria-hidden="true" />

        <div className="atlas-toolbar" role="group" aria-label="Filter the atlas by domain">
          <button
            type="button"
            className="atlas-filter"
            style={{ "--dc": "#d7d2c6" } as CSSProperties}
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              applyFilter("all");
            }}
          >
            <i />
            All
          </button>
          {DOMAIN_ORDER.map((domain) => {
            const meta = DOMAIN_META[domain];
            return (
              <button
                key={domain}
                type="button"
                className="atlas-filter"
                style={{ "--dc": meta.atlas } as CSSProperties}
                aria-pressed={filter === domain}
                onClick={() => {
                  setFilter(domain);
                  applyFilter(domain);
                }}
              >
                <i />
                {meta.name}
              </button>
            );
          })}
        </div>

        <div className="atlas-controls">
          <button
            type="button"
            className="atlas-control"
            onClick={() => moveRef.current("in")}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="atlas-control"
            onClick={() => moveRef.current("out")}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="atlas-control"
            onClick={() => moveRef.current("reset")}
            aria-label="Reset view"
            title="Reset view"
          >
            ⌂
          </button>
        </div>

        <p className="atlas-hint">Drag to move · Scroll to zoom · Click to open</p>

        <AnimatePresence>
          {preview ? (
            <motion.aside
              key={preview.id}
              className="atlas-preview"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
              aria-live="polite"
            >
              <div className="atlas-preview-top">
                <span>
                  {isDomainId(preview.domain) ? DOMAIN_META[preview.domain].name : "Atlas"} ·{" "}
                  {NODE_TYPE_LABEL[preview.type]}
                </span>
                {preview.status === "published" ? (
                  <span className="status-tag status-tag--published">Field note</span>
                ) : null}
              </div>
              <div className="atlas-preview-title">
                {preview.label}
                {preview.jp ? <span className="jp"> {preview.jp}</span> : null}
              </div>
              {preview.type !== "domain" ? (
                <p className="atlas-preview-copy">
                  {preview.type === "layer"
                    ? `${preview.label} is one layer in this domain. Open it to see the concepts filed there.`
                    : `Filed under ${preview.layerName ?? preview.layer}. Open the entry for the working definition.`}
                </p>
              ) : (
                <p className="atlas-preview-copy">
                  {isDomainId(preview.domain) ? DOMAIN_META[preview.domain].tagline : ""}
                </p>
              )}
              <div className="atlas-preview-foot">
                <a href={preview.url}>
                  {preview.type === "concept"
                    ? "Open entry →"
                    : preview.type === "layer"
                      ? "Open layer →"
                      : "Open domain →"}
                </a>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {failed ? (
          <div className="atlas-error" role="status">
            <strong>The atlas needs WebGL.</strong>
            <span>
              Your browser could not start the canvas. Every domain still works as a plain page.
            </span>
            <a className="text-link" href="/concepts">
              Browse the index →
            </a>
          </div>
        ) : null}

        {!ready && !failed ? (
          <div className="atlas-error" role="status" aria-live="polite">
            <span>Plotting the map…</span>
          </div>
        ) : null}
      </div>

      <div className="atlas-legend">
        <span className="atlas-legend-label">Showing {filterLabel}</span>
        <ul className="atlas-legend-list">
          {DOMAIN_ORDER.map((domain) => {
            const meta = DOMAIN_META[domain];
            return (
              <li key={domain} style={{ "--dc": meta.atlas } as CSSProperties}>
                <i />
                {meta.name}
              </li>
            );
          })}
        </ul>
        <p>
          Each dot is a filed concept, grouped by layer and domain. Published field notes sit
          brighter in the map.
        </p>
      </div>
    </>
  );
}
