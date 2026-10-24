import type { DomainId } from "@/lib/site";

export interface PathStep {
  slug: string;
  why: string;
}

export interface LearningPath {
  slug: string;
  title: string;
  domain: DomainId;
  summary: string;
  description: string;
  steps: PathStep[];
}

export const paths: LearningPath[] = [
  {
    slug: "failure-path",
    title: "The failure path",
    domain: "backend",
    summary:
      "How a healthy service starts falling over, and the controls that keep one bad dependency from taking everything with it.",
    description:
      "Read this in order the next time a service feels fragile. Each entry is one link in the chain: slow calls become retries, retries become a storm, the pool fills, and the queue grows without a ceiling. The last two entries move from surviving failure to keeping data correct while you do it.",
    steps: [
      {
        slug: "tail-latency",
        why: "The average hides the requests people actually remember. Start by learning why the tail is the system.",
      },
      {
        slug: "retry-storm",
        why: "Retries feel safe per request and become a load multiplier across a fleet. This is the first place overload compounds.",
      },
      {
        slug: "circuit-breaker",
        why: "When a dependency is already down, the kindest thing you can do is stop calling it.",
      },
      {
        slug: "bulkhead-pattern",
        why: "Isolate the blast radius before one slow dependency borrows every thread you have.",
      },
      {
        slug: "backpressure",
        why: "A queue without a ceiling is a delayed outage. Make the producer listen to the consumer.",
      },
      {
        slug: "cache-stampede",
        why: "A cache is also a traffic control system. One expired key can send the whole fleet to the database.",
      },
      {
        slug: "idempotency",
        why: "Once you retry, the same request will arrive twice. Design for the second arrival.",
      },
      {
        slug: "lost-update",
        why: "Under concurrency, two correct reads can produce one silently missing write.",
      },
      {
        slug: "write-skew",
        why: "Some invariants cannot be protected by a single row lock. Learn where transactions stop being enough.",
      },
    ],
  },
  {
    slug: "slow-frontend",
    title: "Making the web feel fast",
    domain: "frontend",
    summary:
      "The browser is a distributed system with a main thread. This path follows the work from request to paint.",
    description:
      "Performance is not a single number. It is a sequence of waits: the network, the main thread, layout, paint, and the state you chose to render. Follow this path when a page is technically loading but still feels heavy.",
    steps: [
      {
        slug: "request-waterfall",
        why: "Most slow pages are waiting on a chain of requests they did not need to serialize.",
      },
      {
        slug: "hydration",
        why: "HTML can arrive before the page can respond. Hydration is the gap between looking ready and being ready.",
      },
      {
        slug: "long-task",
        why: "One long task blocks every interaction behind it. The main thread is a single lane.",
      },
      {
        slug: "layout-thrashing",
        why: "Reading layout after writing it forces the browser to recalculate the same page twice.",
      },
      {
        slug: "main-thread-blocking",
        why: "Identify the work that has no business competing with input, animation, and paint.",
      },
      {
        slug: "optimistic-update",
        why: "The fastest network request is the one the interface does not wait for.",
      },
      {
        slug: "code-splitting",
        why: "Ship the code for the page in front of the person, not the whole product.",
      },
      {
        slug: "core-web-vitals",
        why: "Learn the field metrics that describe what people experienced, not what the lab measured.",
      },
    ],
  },
  {
    slug: "interaction-layer",
    title: "The interaction layer",
    domain: "ui",
    summary:
      "A vocabulary for the small decisions that make an interface feel deliberate: motion, focus, and where a surface comes from.",
    description:
      "This path is for the details that are hard to name in a review. Each entry gives you the word for a behavior, then the reason it exists. Read it before designing a component with a popover, a transition, or a keyboard path.",
    steps: [
      {
        slug: "easing",
        why: "The curve tells the eye whether an interface is arriving, moving, or settling.",
      },
      {
        slug: "spring",
        why: "Springs handle interruption and momentum in a way fixed durations cannot.",
      },
      {
        slug: "hover",
        why: "Hover is a preview, not a requirement. It needs a touch and keyboard equivalent.",
      },
      {
        slug: "focus",
        why: "Focus is the keyboard user's cursor. Make it visible, ordered, and restored.",
      },
      {
        slug: "popover",
        why: "A surface that opens from a trigger should return to that trigger, visually and physically.",
      },
      {
        slug: "scroll-snap",
        why: "Native scrolling already has momentum, keyboard support, and touch behavior. Snap it instead of replacing it.",
      },
      {
        slug: "shared-element-transition",
        why: "When an element survives a view change, keeping it continuous preserves the user's place.",
      },
      {
        slug: "command-palette",
        why: "A searchable action surface is a navigation pattern, not just a shortcut for power users.",
      },
    ],
  },
  {
    slug: "living-world",
    title: "The living world",
    domain: "gamedev",
    summary:
      "How a game keeps time, simulates a world, and makes the result feel like it is responding to you.",
    description:
      "Game development is where performance, simulation, and perception meet. This path starts with the loop that drives everything else, then moves through the systems that make a world coherent under load.",
    steps: [
      {
        slug: "game-loop",
        why: "Everything else depends on when update, simulation, and render run.",
      },
      {
        slug: "fixed-timestep",
        why: "Deterministic physics needs a stable step, not whatever frame rate the machine delivered.",
      },
      {
        slug: "scene-graph",
        why: "A world is a hierarchy of transforms before it is a list of meshes.",
      },
      {
        slug: "client-prediction",
        why: "A networked game cannot wait for the server before it moves.",
      },
      {
        slug: "interest-management",
        why: "At scale, the network can only care about the part of the world near each player.",
      },
      {
        slug: "lod",
        why: "Distance is a budget. Spend detail where it can be seen.",
      },
      {
        slug: "instancing",
        why: "The fastest draw call is the one you did not have to issue separately.",
      },
      {
        slug: "aabb",
        why: "Cheap bounds reject most collision candidates before the expensive test begins.",
      },
    ],
  },
  {
    slug: "attackers-view",
    title: "Think like an attacker",
    domain: "security",
    summary:
      "A short path through the failures attackers look for, and the evidence defenders use afterward.",
    description:
      "Security is a way of reading a system, not a separate checklist. Start with the web vulnerabilities that are still common, then move outward to binaries, networks, and the artifacts an incident leaves behind.",
    steps: [
      {
        slug: "sql-injection",
        why: "The oldest class of injection still exists because string-built queries still exist.",
      },
      {
        slug: "csrf",
        why: "An authenticated browser will happily send a request the user never intended.",
      },
      {
        slug: "binary-exploitation",
        why: "Memory safety is a system property. Learn what happens when the abstraction leaks.",
      },
      {
        slug: "reverse-engineering",
        why: "Understanding a binary is how you answer what it actually does, not what it claims.",
      },
      {
        slug: "pcap-analysis",
        why: "Packets do not lie about timing, direction, or payload — even when logs do.",
      },
      {
        slug: "malware-analysis",
        why: "Incident work begins with evidence. Learn to observe behavior before changing it.",
      },
    ],
  },
];

export function getPath(slug: string): LearningPath | undefined {
  return paths.find((path) => path.slug === slug);
}
