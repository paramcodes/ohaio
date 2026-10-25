import { useCallback, useEffect, useRef, useState } from "react";
import LabShell from "./LabShell";

const BODY_PX = 16;

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const parseRgb = (color: string): [number, number, number] => {
  const n = color.match(/[\d.]+/g);
  return n ? [Number(n[0]), Number(n[1]), Number(n[2])] : [0, 0, 0];
};
const ratio = (a: string, b: string) => {
  const [r1, g1, b1] = parseRgb(a);
  const [r2, g2, b2] = parseRgb(b);
  const L1 = luminance(r1, g1, b1);
  const L2 = luminance(r2, g2, b2);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
};

export default function VisualHierarchyLab() {
  const [textL, setTextL] = useState(38);
  const [bgL, setBgL] = useState(96);
  const [headSize, setHeadSize] = useState(32);
  const [bold, setBold] = useState(true);
  const [gap, setGap] = useState(2.4);

  const [contrast, setContrast] = useState(0);
  const [sizeRatio, setSizeRatio] = useState(0);
  const [intraPx, setIntraPx] = useState(0);
  const [interPx, setInterPx] = useState(0);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const head2Ref = useRef<HTMLHeadingElement>(null);

  const measure = useCallback(() => {
    const surface = surfaceRef.current;
    const head = headRef.current;
    const body = bodyRef.current;
    const head2 = head2Ref.current;
    if (!surface || !head || !body || !head2) return;

    const bg = getComputedStyle(surface).backgroundColor;
    const fg = getComputedStyle(head).color;
    setContrast(ratio(fg, bg));

    const hpx = Number.parseFloat(getComputedStyle(head).fontSize);
    setSizeRatio(hpx / BODY_PX);

    // intra = heading to its own body (within group 1); inter = group 1 body to group 2 heading.
    const intra = Math.round(body.getBoundingClientRect().top - head.getBoundingClientRect().bottom);
    const inter = Math.round(head2.getBoundingClientRect().top - body.getBoundingClientRect().bottom);
    setIntraPx(intra);
    setInterPx(inter);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [textL, bgL, headSize, bold, gap, measure]);

  const isLarge = headSize >= 24 || (bold && headSize >= 18.66);
  const c = contrast;
  const bodyVerdict = c >= 4.5 ? "AA pass" : "AA fail";
  const headVerdict = isLarge ? (c >= 3 ? "AA (large) pass" : "AA (large) fail") : c >= 4.5 ? "AA pass" : "AA fail";
  const proximityRatio = intraPx > 0 ? interPx / intraPx : 0;

  const textColor = `hsl(255 20% ${textL}%)`;
  const bgColor = `hsl(255 24% ${bgL}%)`;

  return (
    <LabShell
      title="Hierarchy is a set of differences you can measure"
      description="Importance is not a vibe — it is contrast, scale, and spacing, and each one is a number. Tune the levers and read what the rendered pixels actually compute to, including the WCAG ratio that decides whether your 'bold statement' is even legible."
      accent="var(--indigo)"
      foot="A heading only outranks its body if something measurable separates them. But push the contrast too far toward 'dramatic' and it stops meeting the accessibility floor — hierarchy never gets to buy attention with legibility."
    >
      <div className="vh-bar">
        <label className="vh-slider">
          <span>Text lightness</span>
          <input type="range" min={0} max={100} value={textL} onChange={(e) => setTextL(Number(e.target.value))} aria-label="Text lightness" />
        </label>
        <label className="vh-slider">
          <span>Background lightness</span>
          <input type="range" min={0} max={100} value={bgL} onChange={(e) => setBgL(Number(e.target.value))} aria-label="Background lightness" />
        </label>
        <label className="vh-slider">
          <span>Heading size</span>
          <input type="range" min={16} max={48} value={headSize} onChange={(e) => setHeadSize(Number(e.target.value))} aria-label="Heading size in pixels" />
          <b>{headSize}px</b>
        </label>
        <div className="lab-chips" role="group" aria-label="Heading weight">
          <button type="button" aria-pressed={bold} onClick={() => setBold(true)}>bold</button>
          <button type="button" aria-pressed={!bold} onClick={() => setBold(false)}>regular</button>
        </div>
        <label className="vh-slider">
          <span>Group gap</span>
          <input type="range" min={4} max={64} value={gap * 10} onChange={(e) => setGap(Number(e.target.value) / 10)} aria-label="Gap between groups in rem" />
        </label>
      </div>

      <div className="vh-surface" ref={surfaceRef} style={{ background: bgColor }}>
        <section className="vh-group">
          <h3 ref={headRef} className="vh-head" style={{ color: textColor, fontSize: `${headSize}px`, fontWeight: bold ? 700 : 400 }}>
            Ship the change
          </h3>
          <p ref={bodyRef} className="vh-body vh-body--1" style={{ color: textColor }}>
            The deploy window closes at six. Merge now and it lands today; after that it waits for Monday.
          </p>
        </section>
        <section className="vh-group" style={{ marginTop: `${gap}rem` }}>
          <h3 ref={head2Ref} className="vh-head" style={{ color: textColor, fontSize: `${headSize}px`, fontWeight: bold ? 700 : 400 }}>
            Then verify
          </h3>
          <p className="vh-body vh-body--2" style={{ color: textColor }}>
            Watch the dashboard for ten minutes. If nothing is red, close the ticket and tell the channel.
          </p>
        </section>
      </div>

      <div className="lab-metrics vh-metrics">
        <div className="lab-metric">
          <span>Text : bg contrast</span>
          <strong>{c.toFixed(2)}:1</strong>
        </div>
        <div className="lab-metric">
          <span>Body (normal) WCAG</span>
          <strong>{bodyVerdict}</strong>
        </div>
        <div className="lab-metric">
          <span>Heading (large) WCAG</span>
          <strong>{headVerdict}</strong>
        </div>
        <div className="lab-metric">
          <span>Heading : body scale</span>
          <strong>{sizeRatio.toFixed(2)}×</strong>
        </div>
        <div className="lab-metric">
          <span>Group : item gap</span>
          <strong>{proximityRatio.toFixed(1)}×</strong>
        </div>
      </div>

      <div className="lab-row">
        <p className="vh-note">
          The <strong>contrast ratio</strong> is computed from the real rendered colours using the WCAG relative-luminance
          formula, not estimated. Drag the two lightness sliders toward each other and watch it fall. Around{" "}
          <strong>3:1</strong> you hit the interesting zone: the heading — being large text — still clears its{" "}
          <code>3:1</code> bar while the body fails its <code>4.5:1</code> bar. That is why "make the title pop" is not
          free: the same colour can be accessible at 32px and inaccessible at 16px.
        </p>
        <p className="vh-note">
          <strong>Scale</strong> is the heading-to-body ratio — a heading only outranks its text if the number is above
          1.00. <strong>Proximity</strong> is the last lever: items in a group sit a fixed small gap apart, and the gap
          between groups is the slider. When <em>group : item</em> climbs above roughly 2×, the eye reads two separate
          blocks without any line, box, or colour doing the work.
        </p>
      </div>
    </LabShell>
  );
}
