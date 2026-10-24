import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { cardBySlug, DOMAIN_META } from "@/lib/site";

export default function ConceptHoverLayer() {
  const [slug, setSlug] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const anchorRef = useRef<HTMLElement | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const show = (element: HTMLElement) => {
      const nextSlug = element.getAttribute("data-concept");
      if (!nextSlug || !cardBySlug.has(nextSlug)) return;
      if (element === anchorRef.current) return;
      anchorRef.current = element;
      setSlug(nextSlug);
      setVisible(true);
    };

    const hide = () => {
      setVisible(false);
      setSlug(null);
      anchorRef.current = null;
    };

    const closestLink = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-concept]")
        : null;

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const link = closestLink(event.target);
      if (link) show(link);
    };

    const onPointerOut = (event: PointerEvent) => {
      const link = closestLink(event.target);
      if (!link) return;
      const related = event.relatedTarget;
      if (related instanceof Node && link.contains(related)) return;
      hide();
    };

    const onFocusIn = (event: FocusEvent) => {
      const link = closestLink(event.target);
      if (link) show(link);
    };

    const onFocusOut = (event: FocusEvent) => {
      const link = closestLink(event.target);
      if (!link) return;
      const related = event.relatedTarget;
      if (related instanceof Node && link.contains(related)) return;
      hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", hide);

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", hide);
    };
  }, []);

  useEffect(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!visible || !anchor || !floating) return;

    const update = () => {
      computePosition(anchor, floating, {
        placement: "top",
        strategy: "fixed",
        middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12 })],
      }).then(({ x, y, placement }) => {
        setCoords({ x, y });
        floating.dataset.placement = placement;
      });
    };

    update();
    return autoUpdate(anchor, floating, update);
  }, [visible, slug]);

  const card = slug ? cardBySlug.get(slug) : undefined;
  const domain = card ? DOMAIN_META[card.domain] : undefined;

  return (
    <AnimatePresence>
      {visible && card && domain ? (
        <motion.div
          ref={floatingRef}
          className="hover-card"
          role="presentation"
          aria-hidden="true"
          style={{ left: coords.x, top: coords.y }}
          initial={{
            opacity: 0,
            y: reduceMotion ? 0 : 4,
            scale: reduceMotion ? 1 : 0.985,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 2, scale: reduceMotion ? 1 : 0.99 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="hover-card-top">
            <span className="domain-chip" style={{ "--dc": domain.color } as CSSProperties}>
              <i className="domain-dot" />
              {domain.name}
            </span>
            <span className={card.status === "published" ? "status-tag status-tag--published" : "status-tag"}>
              {card.status === "published" ? "Field note" : "Filed entry"}
            </span>
          </div>
          <div className="hover-card-title">{card.title}</div>
          <p className="hover-card-copy">{card.summary}</p>
          <div className="hover-card-foot">
            {card.layerName}
            {card.status === "published" ? " · open to read" : " · open filed entry"}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
