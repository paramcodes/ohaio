Yes. **Frontend absolutely has the same hidden engineering layer**.

And the pagination example you gave is a very good one. What you're describing is usually called **client-side server-state caching / query caching**. With TanStack Query, for example, page 1 and page 6 can be separate cache entries because the page number is part of the query key:

```text
queryKey: ["projects", 1]
queryKey: ["projects", 6]
```

So the flow can become:

```text
Page 1
   │
   ├── API request
   ↓
client query cache
   │
   ↓
Page 6
   │
   ├── API request
   ↓
client query cache
   │
   ↓
Back to Page 1
   │
   ├── cache hit → show immediately
   │
   └── possibly background refetch
```

TanStack Query explicitly treats this as a cache with freshness, deduplication, background refetching and garbage collection. citeturn635306search9turn635306search6

One subtle distinction: **`keepPreviousData`/`placeholderData` is not the same thing as caching page 1**. It keeps the previous page visible while the new page is fetching, avoiding the loading-state jump between pages. citeturn635306search10turn635306search0

## The frontend equivalent of our backend list

I'd divide it into these layers:

```text
                         FRONTEND ENGINEERING
                                  │
          ┌───────────────────────┼────────────────────────┐
          ↓                       ↓                        ↓
     DATA / NETWORK          RENDERING / UI            BROWSER
          │                       │                        │
     client cache             React scheduler          HTTP cache
     query cache              reconciliation            bfcache
     prefetching              hydration                 Service Worker
     deduplication            Suspense                  Cache API
     optimistic UI            streaming SSR             IndexedDB
     stale data               Server Components         storage quotas
     invalidation             transitions
          │                       │
          └───────────────┬───────┘
                          ↓
                  PERFORMANCE
                          │
              ┌───────────┼────────────┐
              ↓           ↓            ↓
          network       CPU          memory
              │           │            │
           waterfalls   long tasks   leaks
           waterfalls   INP          GC
           compression  layout       heap
           preloading   thrashing     retention
```

And here is the **actual hidden vocabulary** I'd learn.

---

# 1. Client/server-state caching

This is probably the most important category for modern React applications.

`Client-side cache`  
`Server-state cache`  
`Query cache`  
`Cache key`  
`Query key`  
`Cache hit`  
`Cache miss`  
`Cache invalidation`  
`Cache freshness`  
`Stale data`  
`Stale-while-revalidate`  
`Background refetch`  
`Request deduplication`  
`Request coalescing`  
`Garbage collection of cached queries`  
`Cache eviction`  
`Cache lifetime`  
`staleTime`  
`gcTime`  
`Optimistic update`  
`Cache reconciliation`  
`Cache normalization`  
`Structural sharing`  
`Partial cache hydration`  
`Prefetching`  
`Cache warming`  
`Dependent queries`  
`Infinite query cache`  
`Paginated query cache`  
`Cursor cache`  
`Cache invalidation fan-out`  
`Cross-component cache sharing`

TanStack Query's current documentation essentially treats this as **server-state management**, not ordinary local React state: the cache coordinates fetching, sharing, retries, refetching, mutations and garbage collection. citeturn635306search9

---

# 2. Your pagination example has several deeper concepts hiding inside it

Suppose:

```text
Page 1 → Page 2 → Page 3 → Page 4
```

There are actually several distinct techniques available:

### Cache previously fetched pages

```text
["products", 1]
["products", 2]
["products", 3]
["products", 4]
```

Then revisiting page 1 can use the existing cache. citeturn635306search9

### Keep the previous page visible

```text
Page 1
   ↓ click
Page 2 request
   ↓
keep Page 1 visible
   ↓
Page 2 arrives
   ↓
swap
```

TanStack Query's `placeholderData`/`keepPreviousData` pattern exists specifically for this transition. citeturn635306search10

### Prefetch the next page

```text
User is on Page 1
        │
        ├── display Page 1
        │
        └── background fetch Page 2
                     ↓
                  cache
                     ↓
user clicks Page 2
                     ↓
               almost instant
```

TanStack Query supports explicit prefetching, while Next.js also prefetches routes automatically in production. citeturn635306search12turn936043search2

### Speculative prefetching

You can go further:

```text
Page 1
  ↓
predict Page 2 is likely
  ↓
prefetch
```

But now you've introduced a trade-off:

```text
faster UX
    VS
extra bandwidth
extra server load
extra client memory
```

That **trade-off thinking** is exactly what I want the frontend learning system to teach.

---

# 3. Browser caching — different from your query cache

There are multiple caches that people casually call "the cache".

```text
                    CACHE
                      │
      ┌───────────────┼────────────────┐
      ↓               ↓                ↓
Browser HTTP      Client query      bfcache
   cache             cache
      │               │                │
HTTP responses    application data   full page snapshot
```

### HTTP cache

The browser can reuse HTTP responses according to HTTP caching semantics such as `Cache-Control`, validators, etc.

### Query cache

Your React data library stores application-level server state.

### bfcache

This one is especially interesting.

The browser can store an **entire page snapshot**, including the JavaScript heap, and restore it almost instantly during back/forward navigation. This is fundamentally different from normal HTTP caching. citeturn635306search5

So:

```text
HTTP cache
    =
"Do I already have this response?"

Query cache
    =
"Do I already have this application's server data?"

bfcache
    =
"Can I restore the page exactly as it was?"
```

That's a fantastic frontend interview/production concept.

---

# 4. Next.js / modern routing internals

This is an entire hidden layer.

`Route prefetching`  
`Client Router Cache`  
`RSC payload cache`  
`Segment cache`  
`Layout reuse`  
`Incremental prefetching`  
`Prefetch scheduling`  
`Route-level code splitting`  
`Streaming navigation`  
`Server Components`  
`Client Components`  
`RSC payload`  
`RSC serialization`  
`Hydration`  
`Hydration mismatch`  
`Hydration boundary`  
`Server/client boundary`  
`Partial Prerendering`  
`Cache Components`  
`CDN cache key`  
`Revalidation`  
`On-demand invalidation`  
`Tag-based invalidation`

Next.js 16's current navigation system incrementally prefetches only pieces not already in the client cache and reuses shared layouts during navigation. citeturn936043search5turn936043search2

That's exactly the kind of thing you don't see when someone teaches:

> "Use `<Link>` instead of `<a>`."

The interesting question is:

> **Why does clicking a Next.js link sometimes feel almost instantaneous?**

Answering that takes you into prefetching, caching, RSC payloads, layout reuse and client-side navigation.

---

# 5. React rendering internals

`Reconciliation`  
`Fiber tree`  
`Render phase`  
`Commit phase`  
`Concurrent rendering`  
`Interruptible rendering`  
`Scheduler`  
`Update priority`  
`Transitions`  
`Urgent update`  
`Non-urgent update`  
`Yielding`  
`Bailout`  
`Referential equality`  
`Structural sharing`  
`Memoization`  
`Render waterfall`  
`Effect waterfall`  
`State preservation`  
`Unmount/remount cost`  
`Suspense boundary`  
`Suspense waterfall`  
`Suspense reveal ordering`  
`Activity`  
`View Transition`  
`Effect cleanup`  
`Stale closure`  
`Dependency-array instability`

React 19.2 now exposes **React Performance Tracks**, including Scheduler and Components tracks, so you can actually inspect which work React is doing, what priority it has, and where rendering is blocked. citeturn936043search1

React 19.2 also includes `<Activity>`, which can preserve state for hidden UI and defer work in the background. citeturn936043search1turn936043search0

That is definitely a “learn from production/debugging” concept.

---

# 6. React Compiler / memoization

Another modern category:

`React Compiler`  
`Automatic memoization`  
`Memoization boundary`  
`Referential stability`  
`Object identity`  
`Function identity`  
`Dependency tracking`  
`Compiler-assisted optimization`  
`Memoization invalidation`  
`Over-memoization`  
`Under-memoization`

React Compiler reached stable v1.0 in 2025, so the old blanket advice of manually sprinkling `useMemo` and `useCallback` everywhere is increasingly outdated. citeturn936043search4

The deeper question is:

```text
Why does a component rerender?
          ↓
What actually changed?
          ↓
How does React know?
          ↓
What can be reused?
          ↓
Should we manually memoize?
          ↓
Can the compiler do it?
```

---

# 7. Browser rendering pipeline

This is one of my favorite hidden frontend subjects.

```text
DOM
 ↓
Style calculation
 ↓
Layout
 ↓
Paint
 ↓
Rasterization
 ↓
Compositing
 ↓
Screen
```

Concepts:

`Style recalculation`  
`Layout`  
`Reflow`  
`Repaint`  
`Compositing`  
`Rasterization`  
`Layout thrashing`  
`Forced synchronous layout`  
`Layout invalidation`  
`Paint invalidation`  
`Compositor thread`  
`Main thread`  
`GPU compositing`  
`Layer promotion`  
`CSS containment`  
`content-visibility`  
`contain`  
`will-change`  
`DOM depth`  
`Large DOM`  
`Layout shift`

The classic nasty one:

```text
read layout
   ↓
write style
   ↓
read layout
   ↓
write style
   ↓
read layout
```

can repeatedly force the browser to perform layout.

That's **layout thrashing**.

---

# 8. Main-thread performance

`Main-thread blocking`  
`Long task`  
`Task queue`  
`Microtask queue`  
`Event loop`  
`Task starvation`  
`Microtask starvation`  
`Input delay`  
`Event-handler cost`  
`JS execution cost`  
`Parse cost`  
`Compile cost`  
`Execution cost`  
`Hydration cost`  
`Script evaluation cost`  
`CPU contention`  
`Long animation frame`

And the most important modern user-facing metric here is:

`INP — Interaction to Next Paint`

along with:

`LCP — Largest Contentful Paint`  
`CLS — Cumulative Layout Shift`

These are far more useful than simply saying:

> "The website feels slow."

---

# 9. Network performance

`Request waterfall`  
`Request dependency chain`  
`Network waterfall`  
`Request prioritization`  
`Connection reuse`  
`HTTP/2 multiplexing`  
`HTTP/3 / QUIC`  
`Compression`  
`Brotli`  
`Content negotiation`  
`Preload`  
`Prefetch`  
`DNS prefetch`  
`Preconnect`  
`Early Hints`  
`Resource hints`  
`Critical request chain`  
`Critical rendering path`  
`Request coalescing`  
`Duplicate request`  
`Request cancellation`  
`AbortController`  
`Race between requests`  
`Stale response overwriting fresh response`

That final one causes **real frontend bugs**.

Example:

```text
User searches: "rea"
      ↓
request A

User types: "react"
      ↓
request B
```

But:

```text
B returns first
A returns later
```

If you aren't careful:

```text
new result
    ↓
old result overwrites it
```

That's a **request race condition**.

---

# 10. Data fetching architecture

`Fetch waterfall`  
`Parallel fetching`  
`Dependent fetching`  
`Request deduplication`  
`Request cancellation`  
`Abort signal propagation`  
`Race cancellation`  
`Retry policy`  
`Exponential backoff`  
`Polling`  
`Long polling`  
`SSE`  
`WebSocket`  
`Reconnect strategy`  
`Connection state machine`  
`Offline queue`  
`Optimistic mutation`  
`Rollback`  
`Reconciliation`  
`Conflict resolution`

---

# 11. State management — much deeper than Redux

The important distinction is:

```text
             STATE
               │
       ┌───────┴────────┐
       ↓                ↓
 Client state       Server state
       │                │
 modal open          API data
 form input          cache
 selected tab        freshness
 theme               retries
```

Concepts:

`Client state`  
`Server state`  
`UI state`  
`URL state`  
`Derived state`  
`Persistent state`  
`Ephemeral state`  
`Normalized state`  
`State synchronization`  
`State ownership`  
`State colocation`  
`State lifting`  
`State duplication`  
`Derived-state inconsistency`  
`Store tearing`  
`External store`  
`Concurrent store`  
`Subscription granularity`

A huge architectural lesson is:

> **Not everything that looks like “state” should live in the same state-management system.**

---

# 12. Memory and browser runtime

`Memory leak`  
`Detached DOM tree`  
`Retained closure`  
`Event listener leak`  
`Subscription leak`  
`Timer leak`  
`WebSocket leak`  
`Unreleased Blob URL`  
`Heap growth`  
`Heap snapshot`  
`Retainer path`  
`Garbage collection`  
`GC pause`  
`ArrayBuffer memory`  
`TypedArray memory`  
`GPU memory`  
`Image bitmap memory`  
`Cache memory pressure`  
`Storage quota`  
`Storage eviction`

A classic hidden bug:

```text
component mounts
    ↓
WebSocket created

component unmounts
    ↓
UI disappears

but socket not closed
    ↓
socket remains
    ↓
references remain
    ↓
memory leak
```

---

# 13. Web storage

`localStorage`  
`sessionStorage`  
`IndexedDB`  
`Cache API`  
`Origin storage`  
`Storage quota`  
`Storage eviction`  
`Persistent storage`  
`Storage partitioning`  
`Origin isolation`

The Cache API itself stores `Request`/`Response` pairs and is available to window contexts and workers; service workers often use it, but the API isn't inherently restricted to them. citeturn635306search11

---

# 14. Service workers / offline-first

Now we're getting into seriously interesting frontend engineering.

`Service Worker`  
`Service-worker lifecycle`  
`Install`  
`Activate`  
`Fetch interception`  
`Cache-first`  
`Network-first`  
`Network-only`  
`Stale-while-revalidate`  
`Offline-first`  
`Background sync`  
`Background fetch`  
`Offline queue`  
`Replay queue`  
`Service-worker update race`  
`Old/new worker coexistence`  
`Cache versioning`  
`Cache migration`

You can basically build:

```text
                 Browser
                    │
             Service Worker
              /           \
             ↓             ↓
          Network        Cache
             │             │
             └──────┬──────┘
                    ↓
                 App
```

---

# 15. bfcache / navigation internals

This deserves its own study topic.

`bfcache`  
`Page snapshot`  
`Back navigation restoration`  
`Forward navigation restoration`  
`Page lifecycle`  
`freeze`  
`resume`  
`pagehide`  
`pageshow`  
`notRestoredReasons`  
`Navigation restoration`

A page coming back instantly does **not necessarily mean your API was cached**. The browser may have restored the entire page snapshot from bfcache. citeturn635306search5

That's exactly the kind of thing people discover while debugging rather than in beginner tutorials.

---

# 16. Rendering architecture

`CSR`  
`SSR`  
`SSG`  
`ISR`  
`Streaming SSR`  
`Server Components`  
`Client Components`  
`Hydration`  
`Partial hydration`  
`Selective hydration`  
`Progressive hydration`  
`Island architecture`  
`Resumability`  
`RSC payload`  
`Server/client boundary`  
`Hydration mismatch`  
`Double rendering`  
`Server/client divergence`

React 19.2 added more support around streaming SSR, while Next.js 16 has moved further toward segment-based prefetching and newer server-rendering/cache mechanisms. citeturn936043search1turn936043search5

---

# 17. Code delivery

`Code splitting`  
`Route splitting`  
`Component splitting`  
`Dynamic import`  
`Lazy loading`  
`Tree shaking`  
`Dead-code elimination`  
`Chunk graph`  
`Chunk duplication`  
`Bundle bloat`  
`Dependency bloat`  
`Duplicate dependencies`  
`Module federation`  
`Preload`  
`Prefetch`  
`Priority hints`  
`Resource scheduling`

The hidden problem:

```text
You reduce JS from 2 MB → 500 KB

but

500 KB is still executed on the main thread
            ↓
CPU bottleneck remains
```

So:

**network optimization ≠ execution optimization**

This is a very important frontend principle.

---

# 18. Images / media

`Image decoding`  
`Image preloading`  
`Responsive images`  
`srcset`  
`Sizes`  
`Lazy loading`  
`LCP image priority`  
`Image compression`  
`AVIF`  
`WebP`  
`Decode cost`  
`Raster memory`  
`Layout reservation`  
`Aspect-ratio stabilization`

---

# 19. CSS engineering

`Specificity`  
`Cascade layers`  
`Style invalidation`  
`Selector cost`  
`Layout containment`  
`Paint containment`  
`Size containment`  
`CSS containment`  
`content-visibility`  
`Subpixel layout`  
`Compositing`  
`Stacking context`  
`Layer promotion`  
`GPU compositing`  
`Paint storm`

---

# 20. Accessibility as engineering constraints

People often treat accessibility as a separate checkbox.

But many of the interesting concepts are engineering concepts:

`Focus management`  
`Focus trap`  
`Focus restoration`  
`Keyboard navigation`  
`Screen-reader tree`  
`ARIA state synchronization`  
`Reduced-motion preference`  
`Dynamic-content announcement`  
`Virtualized-list accessibility`  
`Accessible loading states`  
`Semantic DOM`

Especially:

```text
virtualization
      ↓
only 20 DOM nodes exist
      ↓
screen reader expects 1,000 items
      ↓
accessibility model breaks
```

So optimization can change semantics.

---

# 21. Virtualization

`Windowing`  
`List virtualization`  
`Virtual scrolling`  
`Overscan`  
`Variable-height virtualization`  
`Layout measurement`  
`Recycling`  
`DOM node reuse`  
`Virtualized accessibility`  
`Scroll anchoring`

Imagine:

```text
100,000 rows
```

Naive:

```text
100,000 DOM nodes
```

Virtualized:

```text
~30 DOM nodes
       +
scroll position
       ↓
different rows reused
```

Huge performance difference—but now you inherit complexity around measurement, scrolling and accessibility.

---

# 22. Race conditions in frontend state

`Stale closure`  
`Stale state`  
`Out-of-order response`  
`Request race`  
`Double submission`  
`Duplicate mutation`  
`Optimistic update conflict`  
`Rollback race`  
`Unmounted-component update`  
`Abort race`  
`Navigation race`  
`Async effect race`

Example:

```text
click Save
   │
   ├── request A
   │
click Save again
   │
   └── request B

B succeeds
A succeeds later

Which state wins?
```

That is not a UI problem.

That's **distributed concurrency inside the browser**.

---

# 23. Optimistic UI

`Optimistic update`  
`Speculative UI`  
`Temporary state`  
`Rollback`  
`Compensation`  
`Mutation invalidation`  
`Mutation reconciliation`  
`Conflict resolution`  
`Optimistic concurrency`

Flow:

```text
click Like
   ↓
UI immediately says ❤️
   ↓
API request
   ├── success → keep ❤️
   └── failure → rollback
```

The deeper problem:

```text
What if two devices changed the same object?
```

Now frontend caching starts touching distributed consistency.

---

# 24. Security

`XSS`  
`DOM XSS`  
`Stored XSS`  
`Reflected XSS`  
`CSP`  
`Trusted Types`  
`CSRF`  
`CORS`  
`SameSite cookies`  
`Cookie prefixes`  
`HttpOnly`  
`Secure cookies`  
`Clickjacking`  
`Frame-ancestors`  
`Subresource Integrity`  
`Dependency attacks`  
`Prototype pollution`  
`Open redirect`  
`Token leakage`  
`Browser storage attack surface`

And one important architecture question:

```text
Where should an authentication token live?
```

That question leads into:

```text
localStorage
      vs
HttpOnly cookie
      vs
memory
      vs
BFF
```

There is no simplistic universal answer; the threat model matters.

---

# 25. Frontend observability

`Real User Monitoring (RUM)`  
`Synthetic monitoring`  
`Core Web Vitals`  
`INP`  
`LCP`  
`CLS`  
`Long task monitoring`  
`Navigation timing`  
`Resource timing`  
`User timing`  
`Performance marks`  
`Performance measures`  
`Long Animation Frame API`  
`Error boundary telemetry`  
`Session replay`  
`Frontend tracing`  
`Release correlation`  
`Source maps`  
`Error fingerprinting`

The fascinating part is:

```text
backend monitoring
      ↓
server latency

frontend monitoring
      ↓
actual user-perceived latency
```

Those can be very different.

---

# 26. Frontend debugging phenomena

`Heisenbug`  
`Flaky UI test`  
`Timing-dependent bug`  
`Race condition`  
`Production-only bug`  
`Browser-specific bug`  
`Viewport-specific bug`  
`Device-specific bug`  
`Hydration-only bug`  
`Cold-cache bug`  
`Warm-cache bug`  
`Slow-network-only bug`  
`Fast-network-only bug`  
`Memory-pressure-only bug`  
`Low-end-device bug`  
`Background-tab behavior`  
`Battery-saving throttling`

These are the frontend equivalent of the backend weirdness we discussed earlier.

---

# 27. Browser throttling

Very underrated.

`Background tab throttling`  
`Timer throttling`  
`CPU throttling`  
`Battery saver effects`  
`Page freezing`  
`Page lifecycle`  
`Visibility state`  
`Hidden-document behavior`  
`Suspended execution`

Your laptop may work perfectly while:

```text
background tab
    ↓
browser throttles execution
    ↓
timer drifts
    ↓
polling behaves differently
    ↓
"bug"
```

---

# 28. Modern React-specific hidden concepts

I'd especially put these on your study list:

```text
Fiber
Reconciliation
Render vs commit
Concurrent rendering
Scheduler
Update priority
Transitions
Suspense
Suspense waterfalls
Hydration
Hydration mismatch
Streaming SSR
Server Components
RSC payload
Activity
View Transitions
React Performance Tracks
React Compiler
Referential equality
Stale closures
Effect lifecycle
External-store tearing
State preservation
```

React 19.2's Activity and Performance Tracks make several of these directly inspectable rather than purely theoretical. citeturn936043search1

---

# The really important abstraction

Frontend engineering has a beautiful hidden hierarchy:

```text
                    USER INTERACTION
                           │
                           ▼
                     EVENT LOOP
                           │
                           ▼
                    REACT SCHEDULER
                           │
                           ▼
                     RENDER / COMMIT
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                  DOM           STATE
                    │             │
                    ▼             ▼
                 BROWSER       QUERY CACHE
                    │             │
                    └──────┬──────┘
                           ▼
                         NETWORK
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          HTTP cache   API server   Service Worker
              │
              ▼
            DATA
```

And then there is a second loop:

```text
USER
 ↓
interaction
 ↓
main-thread work
 ↓
render
 ↓
network
 ↓
data
 ↓
state update
 ↓
render
 ↓
paint
 ↓
USER sees result
```

**Every arrow can become a performance problem, race condition, caching problem, or consistency problem.**

---

# The frontend concepts I'd prioritize for you

Given what you've been learning on the backend side, I wouldn't start with basic React concepts.

I'd start here:

```text
01  Client-side server-state caching
02  Cache invalidation
03  staleTime vs gcTime
04  Request deduplication
05  Prefetching
06  Optimistic updates
07  Request race conditions
08  Abort/cancellation
09  Render waterfalls
10  Network waterfalls
11  Main-thread blocking
12  Event-loop starvation
13  Layout thrashing
14  Virtualization
15  Hydration
16  Hydration mismatch
17  Streaming SSR
18  React Server Components
19  RSC payload
20  React Scheduler
21  Concurrent rendering
22  Suspense
23  React Compiler
24  Browser HTTP cache
25  bfcache
26  Service Worker caching
27  IndexedDB
28  Storage eviction
29  Memory leaks
30  Core Web Vitals / INP
31  WebSocket/SSE reconnection
32  Offline-first
33  Optimistic concurrency
34  State synchronization
35  Browser throttling
36  Frontend observability
```

And there is a particularly nice connection between the two learning tracks:

```text
                    BACKEND
                       │
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
      caching       queues        concurrency
         │             │             │
         └─────────────┼─────────────┘
                       │
                    FRONTEND
                       │
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
    query cache    request race   optimistic UI
         │             │             │
         └─────────────┼─────────────┘
                       ↓
                distributed behavior
```

That's the part I think will be especially valuable for you: **frontend isn't separate from distributed systems**. The moment a browser caches server data, retries an API, races two requests, optimistically updates state, reconnects a WebSocket, or restores a page from bfcache, you're already dealing with distributed-systems-style problems—just on the client side.

Also, one modern Next.js detail is worth remembering: **Next.js 16's navigation cache/prefetching behavior is distinct from your own API/query cache**. A page can be fast because of route prefetching, while its underlying API data may still be fetched or independently cached. citeturn936043search2turn936043search5

This frontend list is large enough that I would **add it as a second daily spaced-repetition track**, rather than mixing 300+ backend concepts and frontend concepts into one stream.