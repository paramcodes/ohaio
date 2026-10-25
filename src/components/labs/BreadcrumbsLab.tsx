import { useCallback, useEffect, useRef, useState } from "react";
import LabShell from "./LabShell";

type Trail = "location" | "path";
type Label = "labelled" | "unlabelled";
type Last = "text" | "link";
type Sep = "css" | "char";
type Width = "wide" | "narrow";

const TRAILS: Record<Trail, { crumb: string; history?: boolean }[]> = {
  location: [{ crumb: "Home" }, { crumb: "Products" }, { crumb: "Audio" }, { crumb: "Headphones" }],
  path: [{ crumb: "Landing" }, { crumb: "Sale" }, { crumb: "Compare" }, { crumb: "Headphones" }],
};

export default function BreadcrumbsLab() {
  const [trail, setTrail] = useState<Trail>("location");
  const [label, setLabel] = useState<Label>("labelled");
  const [last, setLast] = useState<Last>("text");
  const [sep, setSep] = useState<Sep>("css");
  const [width, setWidth] = useState<Width>("wide");

  const [navTotal, setNavTotal] = useState(0);
  const [navNamed, setNavNamed] = useState(0);
  const [thisName, setThisName] = useState("Breadcrumb");
  const [currentAttr, setCurrentAttr] = useState("page");
  const [focusables, setFocusables] = useState(0);
  const [sepAnnounced, setSepAnnounced] = useState("no");
  const [lines, setLines] = useState(1);

  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const measure = useCallback(() => {
    const navs = [...document.querySelectorAll("nav")];
    setNavTotal(navs.length);
    setNavNamed(
      navs.filter((n) => {
        const l = n.getAttribute("aria-label");
        const lledby = n.getAttribute("aria-labelledby");
        return (l && l.trim().length > 0) || (lledby && lledby.trim().length > 0);
      }).length,
    );

    const nav = navRef.current;
    if (nav) {
      const name = nav.getAttribute("aria-label")?.trim();
      setThisName(name && name.length > 0 ? name : "unnamed");
    }

    const list = listRef.current;
    if (list) {
      const items = [...list.querySelectorAll("li")];
      const lastLi = items[items.length - 1];
      const currentEl = lastLi?.querySelector("[aria-current]");
      setCurrentAttr(currentEl?.getAttribute("aria-current") ?? "—");
      setFocusables(list.querySelectorAll("a[href]").length);
      setSepAnnounced(/[\/›>]/.test(list.textContent ?? "") ? "yes" : "no");
      const lh = Number.parseFloat(getComputedStyle(list).lineHeight) || 1;
      setLines(Math.max(1, Math.round(list.getBoundingClientRect().height / lh)));
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [trail, label, last, sep, width, measure]);

  const crumbs = TRAILS[trail];

  return (
    <LabShell
      title="A breadcrumb names a place, not a trip"
      description="Four lines of markup, and almost every one of them has a wrong version that still looks fine. Toggle each decision and read what the accessibility tree actually reports — the failures are invisible until you measure them."
      accent="var(--indigo)"
      foot="Location over history, a named landmark, a current page that is not a link, separators the reader does not speak, and a trail that stays on one line."
    >
      <div className="bc-bar">
        <div className="lab-chips" role="group" aria-label="Trail basis">
          <button type="button" aria-pressed={trail === "location"} onClick={() => setTrail("location")}>
            location
          </button>
          <button type="button" aria-pressed={trail === "path"} onClick={() => setTrail("path")}>
            path (history)
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Landmark name">
          <button type="button" aria-pressed={label === "labelled"} onClick={() => setLabel("labelled")}>
            &lt;nav&gt; labelled
          </button>
          <button type="button" aria-pressed={label === "unlabelled"} onClick={() => setLabel("unlabelled")}>
            unlabelled
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Last step">
          <button type="button" aria-pressed={last === "text"} onClick={() => setLast("text")}>
            current is text
          </button>
          <button type="button" aria-pressed={last === "link"} onClick={() => setLast("link")}>
            current is a link
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Separator">
          <button type="button" aria-pressed={sep === "css"} onClick={() => setSep("css")}>
            CSS separator
          </button>
          <button type="button" aria-pressed={sep === "char"} onClick={() => setSep("char")}>
            literal &quot;/&quot;
          </button>
        </div>
        <div className="lab-chips" role="group" aria-label="Container width">
          <button type="button" aria-pressed={width === "wide"} onClick={() => setWidth("wide")}>
            wide
          </button>
          <button type="button" aria-pressed={width === "narrow"} onClick={() => setWidth("narrow")}>
            narrow
          </button>
        </div>
      </div>

      <div className="bc-stage" data-width={width}>
        <nav
          ref={navRef}
          className="bc-nav"
          data-sep={sep}
          aria-label={label === "labelled" ? "Breadcrumb" : undefined}
        >
          <ol ref={listRef} className="bc-list">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <li key={c.crumb} className="bc-item">
                  {isLast ? (
                    last === "link" ? (
                      <a href="#" aria-current="page" onClick={(e) => e.preventDefault()}>
                        {c.crumb}
                      </a>
                    ) : (
                      <span aria-current="page">{c.crumb}</span>
                    )
                  ) : (
                    <>
                      {sep === "char" && i > 0 ? <span className="bc-sep-char">/ </span> : null}
                      <a href="#" onClick={(e) => e.preventDefault()}>
                        {c.crumb}
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <p className="bc-caption">
          {trail === "path"
            ? "This trail is where you clicked, not where you are — a history breadcrumb duplicates the Back button and lies about the site's structure."
            : "This trail is the site's hierarchy: each step is a real ancestor you could reach from the URL."}
        </p>
      </div>

      <div className="lab-metrics bc-metrics">
        <div className="lab-metric">
          <span>Landmarks on page</span>
          <strong>
            {navTotal} nav · {navNamed} named
          </strong>
        </div>
        <div className="lab-metric">
          <span>This trail's name</span>
          <strong>{thisName}</strong>
        </div>
        <div className="lab-metric">
          <span>aria-current on last</span>
          <strong>{currentAttr}</strong>
        </div>
        <div className="lab-metric">
          <span>Focusable steps</span>
          <strong>{focusables}</strong>
        </div>
        <div className="lab-metric">
          <span>Separator spoken</span>
          <strong>{sepAnnounced}</strong>
        </div>
        <div className="lab-metric">
          <span>Trail lines</span>
          <strong>{lines}</strong>
        </div>
      </div>

      <div className="lab-row">
        <pre className="bc-code">{`<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/products/audio">Audio</a></li>
    <li><span aria-current="page">Headphones</span></li>
  </ol>
</nav>`}</pre>
        <p className="bc-hint">
          Switch to <strong>unlabelled</strong>: the "Landmarks on page" counter drops its named count by one, so the
          breadcrumb becomes one more anonymous <code>navigation</code> region a reader cannot tell from the main menu.
          Switch the last step to <strong>a link</strong>: "Focusable steps" climbs from 3 to 4, and the extra stop is a
          link that goes exactly where you already are. Choose the <strong>literal &quot;/&quot;</strong>: "Separator
          spoken" turns to <em>yes</em>, because the slash is now in the list's text — a CSS <code>::before</code>{" "}
          never enters <code>textContent</code>. Force <strong>narrow</strong>: "Trail lines" goes above 1, the one
          presentation fault a breadcrumb must not commit.
        </p>
      </div>
    </LabShell>
  );
}
