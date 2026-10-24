#!/usr/bin/env python3
"""Build the OHAIO concept catalogue, MDX/MD pages, graph and search data."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "source"
CONTENT = ROOT / "src" / "content" / "concepts"
DATA = ROOT / "src" / "data"

CONTENT.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = value.replace("&", " and ")
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[\s_]+", "-", value).strip("-").lower()
    return value or "concept"


def clean_term(term: str) -> str:
    term = term.replace("`", "").replace("★", "").strip()
    term = re.sub(r"\s+", " ", term)
    return term


def terms_from_markdown(path: Path) -> dict[str, dict]:
    text = path.read_text()
    sections: dict[str, dict] = {}
    current = None
    in_fence = False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        heading = re.match(r"^#{1,3} (\d+)\.\s+(.+)$", line)
        if heading and not in_fence:
            num = heading.group(1)
            name = heading.group(2).strip()
            current = f"{num}. {name}"
            sections[current] = {"name": name, "terms": []}
            continue
        if current is None or in_fence:
            continue
        if "`" in line:
            term = clean_term(line)
            if (
                term
                and not term.startswith(("http", "text", "bash", "sql", "js", "ts"))
                and "::" not in term
                and len(term) < 90
            ):
                sections[current]["terms"].append(term)
    for section in sections.values():
        seen = set()
        section["terms"] = [t for t in section["terms"] if not (t in seen or seen.add(t))]
    return sections


BACKEND = terms_from_markdown(SRC / "backend.md")
FRONTEND = terms_from_markdown(SRC / "frontend.md")
GAMEDEV = terms_from_markdown(SRC / "gamedev.md")

GAMEDEV_SUPPLEMENT = {
    "3": ["Mesh", "Geometry", "Material", "Texture", "BoxGeometry", "SphereGeometry", "BufferGeometry", "Vertex", "Normal", "UV", "Tangent"],
    "21": ["Instancing", "InstancedMesh", "Instance matrix", "GPU instancing"],
    "23": ["Draw call", "State change", "Material switch", "Batch", "Instancing"],
    "25": ["Bloom", "Depth of field", "Motion blur", "Color grading", "SSAO", "SSGI", "Vignette", "MRT"],
    "30": ["Canvas", "WebGL", "WebGPU", "WebAssembly", "Web Workers", "OffscreenCanvas", "Gamepad API", "Pointer Lock", "Web Audio", "WebXR"],
    "33": ["Entity", "Component", "System", "ECS", "Transform", "Velocity", "Health", "Renderable"],
    "35": ["Client prediction", "Server reconciliation", "Input sequence", "Authoritative server", "Rollback"],
    "41": ["Procedural generation", "Level design", "POI", "Encounter", "Mission", "Route", "Landmark"],
    "46": ["Draw calls", "GPU bound", "CPU bound", "Fill rate", "Overdraw", "Frustum culling", "Occlusion culling", "LOD", "HLOD", "Instancing", "Batching", "Texture atlas", "Texture compression", "Mesh compression", "Asset streaming", "World streaming", "Object pooling", "BVH", "Spatial partitioning", "Worker threads", "OffscreenCanvas", "GPU particles", "Shader compilation"],
    "47": ["Pipeline caching", "Shader warm-up", "Precompilation", "Material reuse", "Pipeline variants"],
    "48": ["Three.js", "React Three Fiber", "Babylon.js", "PlayCanvas", "Godot", "Unity", "Unreal", "WebGPU", "WebGL"],
}
for key, extra in GAMEDEV_SUPPLEMENT.items():
    for section_key, section in GAMEDEV.items():
        if section_key.startswith(f"{key}."):
            section["terms"] = list(dict.fromkeys(extra + section["terms"]))
            break

UI = {
    "1. Motion": ["Easing", "Ease-out", "Ease-in", "Cubic Bézier", "Spring", "Damping", "Stiffness", "Stagger", "Microinteraction", "Shared-element transition", "Morphing", "Enter/exit animation", "Layout animation"],
    "2. Scroll": ["Smooth scroll", "Momentum/inertial scrolling", "Scroll snap", "Scroll-linked animation", "Scroll-triggered animation", "Scroll progress", "Scroll spy", "Scroll reveal", "Parallax", "Sticky positioning", "Pinning", "Scrub", "Overscroll", "Scroll chaining", "Scroll restoration", "Infinite scroll", "Virtual scrolling", "Scroll-driven storytelling"],
    "3. Components": ["Modal", "Dialog", "Drawer", "Sheet", "Bottom sheet", "Popover", "Tooltip", "Hover card", "Command palette", "Context menu", "Dropdown menu", "Accordion", "Collapsible", "Tabs", "Segmented control", "Carousel", "Pagination", "Breadcrumbs", "Toast", "Snackbar", "Banner", "Alert", "Skeleton", "Spinner", "Progress indicator", "Empty state", "Error state", "Confirmation dialog"],
    "4. Interaction": ["Hover", "Focus", "Pressed state", "Active state", "Drag", "Swipe", "Long press", "Double click", "Pinch", "Zoom", "Pan", "Drag-to-dismiss", "Swipe-to-dismiss", "Pull-to-refresh", "Keyboard shortcut", "Pointer capture", "Direct manipulation", "Gesture feedback"],
    "5. Feedback": ["Hover feedback", "Press feedback", "Focus ring", "Loading state", "Skeleton loading", "Optimistic UI", "Success feedback", "Error feedback", "Undo", "Toast", "Progressive disclosure", "Inline validation", "Autosave indicator", "Copy confirmation", "Drag preview", "Drop indicator", "Selected state", "Disabled state", "Pending state"],
    "6. Navigation": ["Command palette", "Breadcrumbs", "Tabs", "Segmented control", "Sidebar navigation", "Sticky navigation", "Scroll spy", "Anchor navigation", "Deep linking", "Route transition", "View transition", "Shared-element transition", "Progressive navigation"],
    "7. Layout": ["Visual hierarchy", "Whitespace", "Rhythm", "Spacing scale", "Density", "Alignment", "Grid", "Subgrid", "Container", "Container query", "Responsive layout", "Fluid layout", "Fluid typography", "Aspect ratio", "Intrinsic sizing", "Clamping", "Breakpoint", "Max-width", "Content column", "Full-bleed", "Edge-to-edge", "Nested layout"],
    "8. Visual hierarchy": ["Primary action", "Secondary action", "Tertiary action", "Visual hierarchy", "Contrast", "Emphasis", "De-emphasis", "Density", "Whitespace", "Negative space", "Grouping", "Proximity", "Alignment", "Baseline alignment", "Gestalt", "Card hierarchy", "Content hierarchy", "Focus", "Visual weight"],
    "9. Loading": ["Skeleton", "Shimmer", "Spinner", "Progress bar", "Determinate progress", "Indeterminate progress", "Optimistic UI", "Placeholder content", "Progressive loading", "Streaming", "Suspense fallback", "Stale-while-revalidate", "Progressive disclosure"],
    "10. React UI": ["Server Component", "Client Component", "Suspense", "Streaming", "Hydration", "Hydration mismatch", "Transition", "Concurrent rendering", "React Scheduler", "Deferred update", "Activity", "Layout animation", "Shared element", "View Transition", "React Compiler", "Performance Tracks"],
    "11. Accessibility": ["Focus management", "Focus trap", "Focus restoration", "Keyboard navigation", "Screen reader", "ARIA", "Accessible name", "Accessible description", "Roving tabindex", "Escape-to-dismiss", "Reduced motion", "Touch target", "Keyboard equivalent", "Live region"],
    "12. Ecosystem": ["shadcn/ui", "Radix", "Motion", "React Flow", "ELK", "D3"],
    "13. Prompting": ["Minimal editorial layout", "Visual hierarchy", "Whitespace", "Hover elevation", "Ease-out", "Microinteractions", "Scroll-linked animation", "Parallax", "Sticky navigation", "Scroll-spy", "Scroll-progress indicator", "Staggered entrance", "Hover transform", "Pressed state", "Shared-element transition", "Anchored popover", "Collision-aware positioning", "Light dismiss", "Focus management", "Accessible dialog", "Focus trap/restoration", "Backdrop fade", "Scroll locking", "Reduced-motion fallback"],
    "14. Principle": ["State transitions", "Interaction feedback", "Spatial continuity"],
    "15. Learn first": ["Visual hierarchy", "Whitespace", "Microinteraction", "Easing", "Spring", "Stagger", "Shared-element transition", "Scroll-linked animation", "Scroll-triggered animation", "Parallax", "Sticky", "Scroll snap", "Scroll spy", "Overscroll/scroll chaining", "Command palette", "Popover", "Drawer/Sheet", "Skeleton", "Optimistic UI", "Progressive disclosure", "View Transition", "Container query", "Virtualization", "Focus management", "Reduced motion"],
}
UI_SECTIONS = {f"{k}": {"name": re.sub(r"^\d+\.\s*", "", k), "terms": v} for k, v in UI.items()}

SECURITY = {
    "1. Offensive security": ["Hack The Box", "TryHackMe", "CTF", "Privilege escalation", "Lateral movement", "Pivoting", "Kerberoasting", "Active Directory", "Red team", "Bug bounty"],
    "2. Web security": ["SQL injection", "XSS", "CSRF", "SSRF", "Request smuggling", "Prototype pollution", "JWT none vulnerability", "OAuth flaws", "GraphQL vulnerabilities", "Race conditions"],
    "3. Blue team": ["PCAP analysis", "Malware analysis", "Digital forensics", "SIEM", "Threat hunting", "Incident response", "Log analysis", "Endpoint artifacts", "Cloud incidents"],
    "4. Binary and reverse engineering": ["Binary exploitation", "Reverse engineering", "Shellcode", "Memory corruption", "Exploit development", "Cryptography"],
    "5. Practice and career": ["HackerOne", "PortSwigger Web Security Academy", "pwn.college", "CyberDefenders", "Safe harbor"],
}
SECURITY_SECTIONS = {k: {"name": re.sub(r"^\d+\.\s*", "", k), "terms": v} for k, v in SECURITY.items()}

NARRATIVE_SECTIONS = {"What should YOU probably use?", "The mental model I want you to retain"}

DOMAINS = [
    ("backend", "Backend", "基盤", "The production vocabulary tutorials skip.", "Concurrency, databases, networking, queues, and the failure modes that only appear under load."),
    ("frontend", "Frontend", "前面", "The browser is a distributed system too.", "Caching, rendering, hydration, memory, and the races hiding between state and paint."),
    ("ui", "Interface", "界面", "The words that make interaction legible.", "Motion, scroll, components, feedback, layout, and the vocabulary that turns intent into prompts."),
    ("gamedev", "Game Dev", "遊戯", "Simulation, rendering, and feel.", "Scene graphs, physics, netcode, shaders, and the craft that makes a world respond."),
    ("security", "Security", "守り", "Break it carefully, then understand why.", "Offensive, defensive, and binary security concepts with sandboxed ways to practice."),
]

PRIORITY = {
    "Partial failure", "Tail latency", "TIME_WAIT", "Connection pool exhaustion", "Write skew", "WAL", "N+1 query problem", "Compaction", "Split brain", "Transactional outbox", "Idempotency", "Cache stampede", "False sharing", "Goroutine leak", "OOM killer", "CrashLoopBackOff", "Tail sampling", "Error budget", "Trace-context propagation", "Canary deployment", "Expand-and-contract migration", "Saga", "SSRF", "Property-based testing", "Heisenbug", "Event sourcing", "Strangler fig pattern", "Cache invalidation race", "Write amplification", "PagedAttention", "Hermetic build", "Fan-out explosion", "Noisy neighbor", "Token bucket", "Clock skew", "Backpressure", "strace", "Silent data corruption",
    "Query cache", "Stale-while-revalidate", "bfcache", "RSC payload", "Hydration", "Concurrent rendering", "Automatic memoization", "Layout thrashing", "Long task", "Request waterfall", "AbortController", "Optimistic mutation", "Store tearing", "Detached DOM tree", "IndexedDB", "Service Worker", "Island architecture", "Tree shaking", "srcset", "Cascade layers", "Focus management", "Virtual scrolling", "Stale closure", "Optimistic update", "XSS", "Core Web Vitals", "Hydration-only bug", "Background tab throttling",
    "Easing", "Spring", "Scroll-linked animation", "Scroll snap", "Popover", "Command palette", "Skeleton", "Shared-element transition", "Container query", "View Transition", "Focus trap", "Anchored popover", "Microinteraction", "Progressive disclosure",
    "Game loop", "Scene graph", "PBR", "Shader", "Fixed timestep", "Determinism", "Rigid body", "AABB", "Skeletal animation", "Character controller", "Camera smoothing", "Gamepad", "Behavior tree", "NavMesh", "Level", "World streaming", "LOD", "Frustum culling", "InstancedMesh", "Batching", "Draw call", "Overdraw", "Bloom", "Particle system", "Spatial audio", "glTF", "Texture atlas", "WebGPU", "WASM", "OffscreenCanvas", "Entity", "Client prediction", "Snapshot interpolation", "Rollback", "Interest management", "Save state", "Procedural generation", "Game feel", "Anticipation", "HUD", "Object pooling", "Shader warm-up", "Three.js",
}

LESSONS = [
    {
        "number": "1",
        "slug": "lost-update",
        "title": "Lost update",
        "layer_prefix": "5.",
        "summary": "Two transactions read the same value, both write, and one update silently disappears.",
        "difficulty": 3,
        "resources": [
            ("docs", "PostgreSQL: Transaction Isolation", "https://www.postgresql.org/docs/current/transaction-iso.html"),
            ("article", "Jepsen: Consistency Models", "https://jepsen.io/consistency/models"),
        ],
    },
    {
        "number": "2",
        "slug": "idempotency",
        "title": "Idempotency",
        "layer_prefix": "11.",
        "summary": "Retrying a request without accidentally repeating its side effects.",
        "difficulty": 3,
        "resources": [
            ("docs", "Stripe: Idempotent requests", "https://docs.stripe.com/api/idempotent_requests"),
            ("article", "AWS Builders' Library: Retries and backoff", "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"),
        ],
    },
    {
        "number": "3",
        "slug": "write-skew",
        "title": "Write skew",
        "layer_prefix": "5.",
        "summary": "Every transaction is individually valid, yet together they violate a business rule.",
        "difficulty": 4,
        "resources": [
            ("docs", "PostgreSQL: Serializable isolation", "https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE"),
            ("article", "Jepsen: Consistency Models", "https://jepsen.io/consistency/models"),
        ],
    },
    {
        "number": "4",
        "slug": "transactional-outbox",
        "title": "Transactional outbox",
        "layer_prefix": "22.",
        "summary": "Commit the database write and the event to publish in one atomic step.",
        "difficulty": 4,
        "resources": [
            ("article", "AWS: Transactional outbox pattern", "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"),
        ],
    },
    {
        "number": "5",
        "slug": "saga-pattern",
        "title": "Saga pattern",
        "layer_prefix": "22.",
        "summary": "Coordinate a multi-service transaction with compensations instead of one global lock.",
        "difficulty": 4,
        "resources": [
            ("article", "AWS: Saga orchestration pattern", "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html"),
        ],
    },
    {
        "number": "6",
        "slug": "retry-storm",
        "title": "Retry storm",
        "layer_prefix": "1.",
        "summary": "Retries multiply load while a dependency is already failing.",
        "difficulty": 3,
        "resources": [
            ("article", "AWS Builders' Library: Timeouts, retries, and backoff", "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"),
        ],
    },
    {
        "number": "7",
        "slug": "circuit-breaker",
        "title": "Circuit breaker",
        "layer_prefix": "1.",
        "summary": "Stop calling a failing dependency before it takes the whole system down.",
        "difficulty": 3,
        "resources": [
            ("article", "Azure: Circuit Breaker pattern", "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker"),
        ],
    },
    {
        "number": "8",
        "slug": "bulkhead-pattern",
        "title": "Bulkhead pattern",
        "layer_prefix": "1.",
        "summary": "Isolate resources so one slow dependency cannot sink every request.",
        "difficulty": 3,
        "resources": [
            ("article", "Azure: Bulkhead pattern", "https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead"),
        ],
    },
    {
        "number": "9",
        "slug": "backpressure",
        "title": "Backpressure",
        "layer_prefix": "1.",
        "summary": "Let a slow consumer tell a fast producer to slow down before the queue explodes.",
        "difficulty": 3,
        "resources": [
            ("docs", "Reactive Streams", "https://www.reactive-streams.org/"),
        ],
    },
    {
        "number": "10",
        "slug": "fencing-tokens",
        "title": "Fencing tokens",
        "layer_prefix": "9.",
        "summary": "A distributed lock is not enough when a stale owner can still write.",
        "difficulty": 5,
        "resources": [
            ("article", "Martin Kleppmann: How to do distributed locking", "https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html"),
        ],
    },
    {
        "number": "11",
        "slug": "cache-stampede",
        "title": "Cache stampede",
        "layer_prefix": "12.",
        "summary": "One expired key sends every request to the database at the same moment.",
        "difficulty": 3,
        "resources": [
            ("article", "AWS: Caching best practices", "https://aws.amazon.com/caching/best-practices/"),
        ],
    },
]


USED_SLUGS: set[str] = set()


def pick_terms(section: dict, count: int = 2) -> list[str]:
    terms = section["terms"]
    ordered = [t for t in terms if t in PRIORITY] + [t for t in terms if t not in PRIORITY]
    out = []
    seen = set()
    for term in ordered:
        key = slugify(term)
        if key in seen or key in USED_SLUGS:
            continue
        if term.lower() in {"world", "systems", "movement", "physics", "health", "render", "read"}:
            continue
        seen.add(key)
        USED_SLUGS.add(key)
        out.append(term)
        if len(out) >= count:
            break
    return out


def layer_id(name: str) -> str:
    return slugify(re.sub(r"^\d+\.\s*", "", name))


def build_domain(domain_id: str, name: str, jp: str, tagline: str, description: str, sections: dict) -> dict:
    layers = []
    for key in sorted(sections, key=lambda x: int(x.split(".")[0])):
        section = sections[key]
        if section["name"] in NARRATIVE_SECTIONS:
            continue
        terms = pick_terms(section, 2)
        layer = {
            "id": layer_id(key),
            "number": key.split(".")[0],
            "name": section["name"],
            "description": f"{section['name']} — the {name.lower()} concepts worth knowing before production teaches them the hard way.",
            "concepts": [],
        }
        for term in terms:
            layer["concepts"].append(
                {
                    "slug": slugify(term),
                    "title": term,
                    "summary": f"{term} belongs to {section['name']} in {name.lower()}. A catalogue entry for the vocabulary tutorials skip.",
                    "status": "stub",
                    "difficulty": 3 if domain_id in {"backend", "frontend", "gamedev", "security"} else 2,
                }
            )
        layers.append(layer)
    return {
        "id": domain_id,
        "name": name,
        "jp": jp,
        "tagline": tagline,
        "description": description,
        "layers": layers,
    }


catalogue = {
    "domains": [
        build_domain("backend", "Backend", "基盤", DOMAINS[0][3], DOMAINS[0][4], BACKEND),
        build_domain("frontend", "Frontend", "前面", DOMAINS[1][3], DOMAINS[1][4], FRONTEND),
        build_domain("ui", "Interface", "界面", DOMAINS[2][3], DOMAINS[2][4], UI_SECTIONS),
        build_domain("gamedev", "Game Dev", "遊戯", DOMAINS[3][3], DOMAINS[3][4], GAMEDEV),
        build_domain("security", "Security", "守り", DOMAINS[4][3], DOMAINS[4][4], SECURITY_SECTIONS),
    ]
}

# Add the eleven fully written lessons as published concepts in their layers.
lessons = json.loads((SRC / "lessons.json").read_text())
lesson_by_slug = {item["slug"]: item for item in LESSONS}

for lesson in LESSONS:
    target = None
    prefix = lesson["layer_prefix"].rstrip(".")
    for domain in catalogue["domains"]:
        for layer in domain["layers"]:
            if domain["id"] == "backend" and layer["number"] == prefix:
                target = (domain, layer)
                break
        if target:
            break
    if not target:
        continue
    domain, layer = target
    existing = next((c for c in layer["concepts"] if c["slug"] == lesson["slug"]), None)
    if existing:
        existing.update(
            title=lesson["title"],
            summary=lesson["summary"],
            status="published",
            difficulty=lesson["difficulty"],
        )
    else:
        layer["concepts"].append(
            {
                "slug": lesson["slug"],
                "title": lesson["title"],
                "summary": lesson["summary"],
                "status": "published",
                "difficulty": lesson["difficulty"],
            }
        )

# Deduplicate concepts globally by slug, keeping the published version.
seen = {}
for domain in catalogue["domains"]:
    for layer in domain["layers"]:
        kept = []
        for concept in layer["concepts"]:
            slug = concept["slug"]
            if slug in seen:
                if concept["status"] == "published":
                    seen[slug]["status"] = "published"
                    seen[slug]["title"] = concept["title"]
                    seen[slug]["summary"] = concept["summary"]
                continue
            concept["domain"] = domain["id"]
            concept["domainName"] = domain["name"]
            concept["layer"] = layer["id"]
            concept["layerName"] = layer["name"]
            concept["layerId"] = layer["id"]
            concept["url"] = f"/concepts/{slug}"
            seen[slug] = concept
            kept.append(concept)
        layer["concepts"] = kept

for domain in catalogue["domains"]:
    domain["layers"] = [layer for layer in domain["layers"] if layer["concepts"]]

all_concepts = list(seen.values())

# Lesson cleanup
CITE = re.compile(r"[\ue000-\uf8ff][^\s]*")
SANDBOX = re.compile(r"\[[^\]]*\]\(sandbox:[^)]*\)")


def clean_lesson(raw: str, title: str) -> str:
    lines = raw.splitlines()
    out = []
    in_fence = False
    for line in lines:
        s = line.strip()
        if s.startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence:
            if s.startswith("# Backend Concept of the Day"):
                continue
            if "sandbox:" in s:
                continue
            line = SANDBOX.sub("", line)
            line = CITE.sub("", line)
            if re.match(r"^#{1,6}\s+Spaced[- ]repetition (record|log)\b", s, re.I):
                break
        out.append(line)
    text = "\n".join(out)

    # Drop the previous day's recall block, keeping whatever introduced it.
    text = re.sub(
        r"(?ms)^#{1,2}\s*Part 1\s*[—-]\s*Spaced repetition.*?(?=^#{1,2}\s*Part \d+\b|^#\s|\Z)",
        "",
        text,
    )
    text = re.sub(
        r"^.*First, let'?s review yesterday'?s concept using active recall\.\s*$",
        "",
        text,
        flags=re.M,
    )

    # Turn "Part N — Title" into a normal section heading.
    text = re.sub(
        r"(?m)^#{1,2}\s*Part \d+\s*[—-]\s*(Today'?s new concept:\s*)?(.+?)\s*$",
        lambda m: "" if m.group(1) else f"## {m.group(2).strip()}",
        text,
    )
    text = re.sub(r"^#{1,2}\s*The connection to yesterdays? concept\s*$", "## Connection to adjacent concepts", text, flags=re.M)
    text = re.sub(r"^#{1,2}\s*The connection to yesterdays? concept\s*$", "## Connection to adjacent concepts", text, flags=re.M)
    text = re.sub(r"^#{1,2}\s*The connection to yesterday's concept\s*$", "## Connection to adjacent concepts", text, flags=re.M)
    text = re.sub(r"^#{1,2}\s*Spaced[- ]repetition record\s*$", "", text, flags=re.M)

    # Demote all top-level headings so the page owns the h1.
    cleaned = []
    in_fence = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
            cleaned.append(line)
            continue
        if not in_fence and re.match(r"^#\s+", line):
            line = "## " + re.sub(r"^#\s+", "", line)
        cleaned.append(line)
    text = "\n".join(cleaned)

    # Remove obvious empty sections and excessive blank lines.
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^##\s+$\n?", "", text, flags=re.M)
    return text.strip() + "\n"


def md_escape(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_concept(concept: dict) -> None:
    slug = concept["slug"]
    resources = []
    body = ""
    if concept["status"] == "published":
        lesson = lesson_by_slug[slug]
        body = clean_lesson(lessons[lesson["number"]], concept["title"])
        for kind, title, url in lesson["resources"]:
            resources.append({"type": kind, "title": title, "url": url, "free": True})
    else:
        body = (
            f"## What it is\n\n"
            f"**{concept['title']}** is a catalogue entry in the **{concept['layerName']}** layer of "
            f"{concept['domain']} engineering.\n\n"
            f"## Why it matters\n\n"
            f"The interesting failures usually live at the boundary between this concept and the rest of the system: "
            f"under load, during partial failure, or when state drifts from the happy path.\n\n"
            f"## Active recall\n\n"
            f"- Where have you seen **{concept['title']}** show up?\n"
            f"- What breaks if you ignore it?\n"
            f"- What would you measure to detect it in production?\n"
        )
    front = [
        "---",
        f"title: {md_escape(concept['title'])}",
        f"slug: {md_escape(slug)}",
        f"domain: {md_escape(concept['domain'])}",
        f"layer: {md_escape(concept['layerId'])}",
        f"layerName: {md_escape(concept['layerName'])}",
        f"summary: {md_escape(concept['summary'])}",
        f"difficulty: {concept['difficulty']}",
        f"status: {md_escape(concept['status'])}",
        "resources:",
    ]
    if resources:
        for resource in resources:
            front.append(f"  - type: {md_escape(resource['type'])}")
            front.append(f"    title: {md_escape(resource['title'])}")
            front.append(f"    url: {md_escape(resource['url'])}")
            front.append(f"    free: {str(resource.get('free', True)).lower()}")
    else:
        front[-1] = "resources: []"
    front.append("---")
    (CONTENT / f"{slug}.md").write_text("\n".join(front) + "\n\n" + body)


for concept in all_concepts:
    write_concept(concept)

# Domain summaries
for domain in catalogue["domains"]:
    domain["conceptCount"] = sum(len(layer["concepts"]) for layer in domain["layers"])
    domain["layerCount"] = len(domain["layers"])
    domain["publishedCount"] = sum(
        1 for layer in domain["layers"] for c in layer["concepts"] if c["status"] == "published"
    )

(DATA / "catalogue.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=2))

# Cards / palette
cards = []
for domain in catalogue["domains"]:
    for layer in domain["layers"]:
        for concept in layer["concepts"]:
            cards.append(
                {
                    "slug": concept["slug"],
                    "title": concept["title"],
                    "summary": concept["summary"],
                    "domain": domain["id"],
                    "domainName": domain["name"],
                    "layer": layer["id"],
                    "layerName": layer["name"],
                    "status": concept["status"],
                    "difficulty": concept["difficulty"],
                    "url": f"/concepts/{concept['slug']}",
                }
            )
(DATA / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2))
(DATA / "palette.json").write_text(
    json.dumps(
        [
            {
                "title": c["title"],
                "summary": c["summary"],
                "domain": c["domainName"],
                "url": c["url"],
                "status": c["status"],
            }
            for c in cards
        ],
        ensure_ascii=False,
        indent=2,
    )
)

# Deterministic constellation layout.
DOMAIN_COLORS = {
    "backend": "#3f6b5b",
    "frontend": "#4d5f9a",
    "ui": "#b36a3c",
    "gamedev": "#7d5a86",
    "security": "#a63d40",
}
nodes = []
edges = []
node_ids = set()


def add_node(node):
    if node["id"] in node_ids:
        return
    node_ids.add(node["id"])
    nodes.append(node)


domain_centers = {}
radius = 430
for i, domain in enumerate(catalogue["domains"]):
    angle = (i / len(catalogue["domains"])) * math.tau - math.pi / 2
    cx = 900 + radius * math.cos(angle)
    cy = 900 + radius * math.sin(angle)
    domain_centers[domain["id"]] = (cx, cy)
    add_node(
        {
            "id": f"domain:{domain['id']}",
            "label": domain["name"],
            "jp": domain["jp"],
            "type": "domain",
            "domain": domain["id"],
            "layer": "",
            "status": "published",
            "url": f"/domains/{domain['id']}",
            "x": cx,
            "y": cy,
            "size": 22,
            "color": DOMAIN_COLORS[domain["id"]],
        }
    )
    for j, layer in enumerate(domain["layers"]):
        layer_angle = angle + (j / max(1, len(domain["layers"]))) * math.tau
        layer_radius = 105 + (j % 3) * 28
        lx = cx + layer_radius * math.cos(layer_angle)
        ly = cy + layer_radius * math.sin(layer_angle)
        add_node(
            {
                "id": f"layer:{domain['id']}:{layer['id']}",
                "label": layer["name"],
                "type": "layer",
                "domain": domain["id"],
                "layer": layer["id"],
                "status": "stub",
                "url": f"/domains/{domain['id']}#{layer['id']}",
                "x": lx,
                "y": ly,
                "size": 8,
                "color": DOMAIN_COLORS[domain["id"]],
            }
        )
        edges.append({"source": f"domain:{domain['id']}", "target": f"layer:{domain['id']}:{layer['id']}"})
        count = len(layer["concepts"])
        for k, concept in enumerate(layer["concepts"]):
            cangle = layer_angle + (k / max(1, count)) * math.tau
            cradius = 25 + count * 3
            x = lx + cradius * math.cos(cangle)
            y = ly + cradius * math.sin(cangle)
            add_node(
                {
                    "id": f"concept:{concept['slug']}",
                    "label": concept["title"],
                    "type": "concept",
                    "domain": domain["id"],
                    "layer": layer["id"],
                    "layerName": layer["name"],
                    "status": concept["status"],
                    "url": f"/concepts/{concept['slug']}",
                    "x": x,
                    "y": y,
                    "size": 11 if concept["status"] == "published" else 5.5,
                    "color": DOMAIN_COLORS[domain["id"]],
                }
            )
            edges.append(
                {"source": f"layer:{domain['id']}:{layer['id']}", "target": f"concept:{concept['slug']}"}
            )

# A few cross-domain bridges make the atlas feel like one system.
bridges = [
    ("lost-update", "concurrency"),
    ("retry-storm", "backpressure"),
    ("cache-stampede", "query-cache"),
    ("idempotency", "transactional-outbox"),
    ("fencing-tokens", "clock-skew"),
    ("write-skew", "lost-update"),
]
by_slug = {c["slug"]: c for c in cards}
for a, b in bridges:
    if a in by_slug and b in by_slug:
        edges.append({"source": f"concept:{a}", "target": f"concept:{b}"})

(DATA / "graph.json").write_text(json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False))

print(f"domains: {len(catalogue['domains'])}")
print(f"layers: {sum(d['layerCount'] for d in catalogue['domains'])}")
print(f"concepts: {len(cards)}")
print(f"published: {sum(1 for c in cards if c['status'] == 'published')}")
print(f"graph nodes: {len(nodes)} edges: {len(edges)}")
