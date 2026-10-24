---
title: "Cache stampede"
slug: "cache-stampede"
domain: "backend"
layer: "production-failure-overload"
layerName: "Production failure / overload"
summary: "One expired key sends every request to the database at the same moment."
difficulty: 3
status: "published"
resources:
  - type: "article"
    title: "AWS: Caching best practices"
    url: "https://aws.amazon.com/caching/best-practices/"
    free: true
---

## Cache Stampede: How One Expired Cache Entry Can Overload Your Entire Backend

**Date:** October 18, 2026  
**Domain:** Distributed systems, caching, performance engineering, production reliability.

Imagine you run an API that serves a popular product page.

Your cache makes the response extremely cheap to retrieve. Thousands of requests per second can be served without querying the database every time.

Then the cache entry expires.

Suddenly, thousands of requests miss the cache simultaneously. They all query the database to regenerate the same response.

Your database becomes overloaded, request latency increases, and clients start retrying. A performance optimization has now become the starting point of an outage.

This is called a **cache stampede**, also known as a *thundering herd* or, in some contexts, a *cache dogpile*.

Today we'll understand why it happens, how to prevent it, and when each solution is appropriate.

I've also built an interactive experiment so you can observe how different caching strategies affect the origin service.

---

## Understand the problem
## 1. What happens when a cache entry expires?

Suppose your application uses  data store"] to cache product details.

Your request path looks like this:

```text
Client
  |
  v
API Server
  |
  v
Redis Cache
  |
  +---- Cache hit ----> Return cached response
  |
  +---- Cache miss ---> PostgreSQL
                              |
                              v
                       Generate response
                              |
                              v
                         Store in cache
```

Under normal conditions, most requests find the response in Redis.

The database handles only cache misses.

Now imagine a popular product receives 2,000 requests per second.

Its cache entry expires.

All 2,000 requests arrive within the same short interval and discover that the entry is missing.

If each request independently queries PostgreSQL, the database receives approximately 2,000 regeneration requests per second for the same logical value.

The database may previously have handled only a handful of queries per second for that product.

**The cache miss has transformed one expensive computation into thousands of simultaneous computations.**

That's the stampede.

## 2. Why does this happen from first principles?

A cache reduces repeated work by storing the result of an earlier computation.

For example:

```sql
SELECT id, name, price
FROM products
WHERE id = 42;
```

Without caching, the database executes the query whenever the application needs the result.

With caching:

```text
First request:
    Cache miss
        |
        v
    Query database
        |
        v
    Store result

Later requests:
    Cache hit
        |
        v
    Return stored result
```

The problem is that a cache miss doesn't inherently coordinate concurrent callers.

Suppose 1,000 requests arrive simultaneously.

Each request checks the cache before any request has completed regeneration.

Every request observes the same fact:

```text
Key does not exist.
```

Each request then independently starts the expensive operation.

```text
Request A ── Cache miss ──► Database query
Request B ── Cache miss ──► Database query
Request C ── Cache miss ──► Database query
Request D ── Cache miss ──► Database query
...
Request N ── Cache miss ──► Database query
```

The missing property is **coordination around regeneration**.

Caching coordinates the reuse of completed results, but a basic cache-aside implementation doesn't automatically coordinate the creation of a missing result.

---

## Quantify the damage
## 3. Why does a short expiration window matter?

Let's assume:

- Request rate for a popular key: 2,000 requests/second.
- Time needed to regenerate the cached value: 2 seconds.
- Each request independently starts regeneration when it sees a miss.

The approximate number of requests that can arrive during the regeneration window is:

\[
N \approx \lambda T
\]

Where:

- \(N\) is the number of requests arriving during the window.
- \(\lambda\) is the request arrival rate.
- \(T\) is the regeneration duration.

Substituting:

\[
N \approx 2000 \times 2 = 4000
\]

Approximately 4,000 requests could arrive during the two-second window.

If each independently queries the database, thousands of redundant database operations can be initiated.

This is an approximation. The actual number depends on request timing, cache behavior, concurrency limits, and whether requests are rejected or queued.

### Why can this become a cascading failure?

```text
Popular cache key expires
          |
          v
Thousands of cache misses
          |
          v
Thousands of database queries
          |
          v
Database latency increases
          |
          v
Application requests wait longer
          |
          v
Connections and queues fill
          |
          v
Requests time out
          |
          v
Clients retry
          |
          v
Even more load
```

Notice the connection to our October 13 lesson.

A cache stampede can initiate a retry storm.

The cache stampede creates duplicate work. The retry storm creates additional work after failures.

Together, they can overwhelm a database that was perfectly healthy before the cache entry expired.

---

## Interactive experiment
## 🧪 Cache Stampede Lab

The simulator lets you change:

- Incoming request volume.
- Origin-service capacity.
- Cache-refresh duration.
- Cache strategy.
- Number of hot keys.

Compare these strategies:

1. Plain caching without coordination.
2. Request coalescing, also called *singleflight*.
3. Stale-while-revalidate.
4. TTL jitter across multiple keys.

### Experiment A: Plain cache

Start with one hot key and a high request rate.

Observe the burst of requests reaching the origin when the key expires.

Increase the fetch duration. The requests remain in flight for longer, making resource contention more likely.

### Experiment B: Request coalescing

Switch to singleflight.

Notice how concurrent requests for the same key share one regeneration operation instead of independently initiating database queries.

### Experiment C: Stale-while-revalidate

Switch to stale-while-revalidate.

The application can serve the previously cached value while a background operation refreshes it.

This can dramatically reduce the number of requests that need to wait for regeneration.

### Experiment D: TTL jitter

Increase the number of hot keys and select TTL jitter.

Notice how spreading expirations across different keys can reduce synchronized bursts.

There is an important limitation: **TTL jitter alone does not prevent simultaneous misses for one extremely popular key.**

The simulator is an illustrative model, not a production benchmark.

---

## Solution 1: Request coalescing
## 4. What is singleflight?

Request coalescing ensures that when several callers need the same missing value simultaneously, only one regeneration operation runs within the relevant coordination scope.

The other callers share its result or wait for it.

This is often called *singleflight*.

Consider the original scenario:

```text
1,000 concurrent requests
          |
          v
      Cache miss
          |
          v
   Request coalescing
          |
          +------> One database query
          |                |
          |                v
          |          Regenerate value
          |                |
          +<---------------+
          |
          v
   Share resulting value
          |
          v
    1,000 responses
```

Instead of 1,000 database queries, the application performs approximately one regeneration operation for that key.

The optimization is conceptually simple:

**Coordinate the expensive computation, not merely the cached result.**

## 5. How does singleflight work internally?

A typical implementation maintains a map of in-flight operations.

The key identifies the value being regenerated.

For example:

```text
inFlight["product:42"] = Promise
```

When the first request encounters a cache miss:

1. It checks whether regeneration is already in progress.
2. If not, it creates an in-flight operation.
3. It records that operation under the cache key.
4. It performs the expensive database query.
5. It stores the result in the cache.
6. It resolves the shared operation.
7. Waiting callers receive the same result.
8. The in-flight entry is removed when the operation completes.

Subsequent requests for the same key find the existing operation and join it instead of starting another query.

Conceptually:

```ts
async function getProduct(productId: string) {
  const key = `product:${productId}`;

  const cached = await cache.get(key);
  if (cached !== null) return cached;

  return singleflight.do(key, async () => {
    // Check again: another request may have populated the cache.
    const secondCheck = await cache.get(key);
    if (secondCheck !== null) return secondCheck;

    const product = await database.getProduct(productId);
    await cache.set(key, product, 60);

    return product;
  });
}
```

Here, `singleflight.do` represents a hypothetical coalescing primitive; it is not a built-in JavaScript function.

The second cache check is important. Another request might have populated the cache between the initial miss and the start of the coalesced operation.

Production implementations also need to handle errors, cancellation, and cleanup correctly.

### The scope limitation

Suppose your API runs on ten application instances.

Each instance has its own in-memory singleflight map.

A popular key expires, and requests reach all ten instances.

Each instance may initiate one database query.

The result could be ten queries instead of one.

That's still much better than thousands of queries, but it is not global coordination.

To coordinate across processes, you may need a shared mechanism such as a distributed lock or another cross-instance request-coordination design.

That introduces additional complexity, including lease expiration, lock contention, and recovery from coordination failures.

Start with local singleflight when it provides sufficient protection.

---

## Solution 2: Stale-while-revalidate
## 6. What if users don't need perfectly fresh data?

Request coalescing reduces duplicated work.

But callers may still wait for regeneration when the cache is empty.

For some applications, a better solution is to serve a slightly stale result while refreshing it in the background.

This is called **stale-while-revalidate**.

Instead of treating cache expiration as an immediate transition from valid data to no data, the application distinguishes between:

- Fresh data.
- Stale but still usable data.
- Data that is too old or unavailable.

For example:

```text
Cache entry created
        |
        v
Fresh period: 60 seconds
        |
        v
Stale-while-revalidate period: 30 seconds
        |
        +---- Serve stale response
        |
        +---- Trigger background refresh
                    |
                    v
              Store new value
                    |
                    v
              Return to fresh
```

During the stale period, the application can return the old value immediately while one refresh operation runs.

The result is lower latency for users and less pressure on the origin service.

## 7. When is stale data acceptable?

Consider different applications.

| Data | Is stale-while-revalidate appropriate? |
|---|---|
| Product descriptions | Often |
| Public documentation | Often |
| Product recommendations | Often |
| News or article listings | Often |
| Account balance | Depends on strict correctness requirements |
| Available inventory during checkout | Requires careful consistency guarantees |
| Authorization or revocation state | Potentially dangerous if stale data permits access that should be denied |

The key question is not simply whether stale data is possible.

It is whether serving that particular stale value violates a business or security invariant.

For example, showing a slightly old product description may be acceptable.

Authorizing a revoked user based on stale permissions may not be.

**Stale-while-revalidate trades freshness for availability and reduced regeneration load.**

It should be used only when the application can tolerate that trade-off.

---

## Solution 3: TTL jitter
## 8. Why do synchronized expirations happen?

Suppose a deployment warms 100,000 cache entries.

Every entry is assigned a TTL of exactly 600 seconds.

Ten minutes later, many entries expire around the same time.

If those entries are popular, the resulting misses can produce a large burst of database traffic.

TTL jitter introduces randomness into expiration times.

Instead of every entry expiring after exactly 600 seconds, assign slightly different TTLs.

For example:

```text
Key A: 570 seconds
Key B: 615 seconds
Key C: 588 seconds
Key D: 632 seconds
Key E: 601 seconds
```

This spreads expiration events over time.

A simple implementation might use:

```ts
const ttlSeconds = 600 + Math.floor(Math.random() * 120);
```

This example produces TTLs from 600 through 719 seconds.

Another approach is to subtract a random amount from the nominal TTL, causing entries to expire earlier within a defined range.

The correct distribution depends on the desired expiration behavior.

### What does jitter solve?

TTL jitter is particularly useful when many different keys would otherwise expire together.

It can reduce synchronized bursts after cache warming, deployments, or batch refreshes.

### What does jitter not solve?

Suppose one product accounts for 40% of all traffic.

Its single cache entry expires.

Even if all other cache keys have randomized TTLs, thousands of requests can still miss this one popular key at the same time.

For that case, request coalescing, stale-while-revalidate, or another per-key regeneration mechanism is more appropriate.

---

## Solution 4: Distributed refresh locks
## 9. When multiple application instances need coordination

Sometimes local singleflight is insufficient.

Imagine ten API instances sharing one cache and one database.

You want only one instance to regenerate a particular popular value.

A distributed lock can coordinate refresh ownership.

```text
API instance A ──┐
API instance B ──┤
API instance C ──┼──► Shared cache key
API instance D ──┤
       ...       │
API instance J ──┘
                       |
                       v
                Distributed lock
                       |
                       v
                One refresh owner
                       |
                       v
                  Database query
                       |
                       v
                 Update cache
```

The refresh owner acquires the lock, regenerates the value, updates the cache, and releases the lock.

Other instances wait, use stale data where acceptable, or retry the cache lookup after a short delay.

However, distributed locks introduce their own failure modes.

For example:

1. Instance A acquires a lease.
2. A pauses for too long.
3. The lease expires.
4. Instance B acquires the lock and refreshes the value.
5. A resumes and attempts to write its older result.

This is the stale-writer problem we studied yesterday.

A lock lease alone does not guarantee that an old owner cannot write after losing ownership.

For correctness-sensitive storage updates, you may need fencing tokens or a storage-native conditional write.

For ordinary cache refreshes, a simpler design may be sufficient, depending on the consequences of an occasional stale write.

### Important design principle

Don't introduce a distributed lock merely because a cache stampede exists.

First consider whether local singleflight, stale-while-revalidate, or TTL jitter adequately solves the problem.

Distributed coordination is useful when the additional global coordination is justified by the workload and correctness requirements.

---

## Alternative: Probabilistic early refresh
## 10. Can we refresh a value before it expires?

Yes.

Instead of waiting for the cache entry to expire, an application can probabilistically trigger a refresh as the entry approaches its expiration time.

This is called **probabilistic early expiration**.

The general idea is to increase the probability of refreshing as the value gets older or as the expected regeneration time becomes significant.

For example:

```text
Cache entry age
     |
     v
Young entry ──► Low refresh probability
     |
     v
Older entry ──► Higher refresh probability
     |
     v
Near expiration ──► Very likely to refresh
```

The exact probability function varies by algorithm.

The objective is to distribute refresh work over time instead of allowing all callers to converge on one expiration instant.

This approach can work well for highly popular keys when serving stale data briefly is acceptable.

However, it is more complex than a simple TTL, and the application must avoid allowing too many probabilistic refresh attempts to become concurrent duplicate work.

A common design combines early refresh with request coalescing.

---

## Production incident walkthrough
## 11. Incident: A popular product page overwhelms PostgreSQL

Imagine an e-commerce platform serving 20,000 requests per second.

One product becomes extremely popular after a promotional campaign.

The product page is cached for five minutes.

During normal operation, the database handles the occasional cache miss.

### 14:00:00 — The cache entry expires

The popular product's cache entry disappears.

Thousands of concurrent requests arrive.

Every request checks the cache and finds no entry.

### 14:00:01 — Duplicate database queries begin

Each application instance starts fetching the product data.

The database receives thousands of equivalent queries.

### 14:00:02 — Database latency increases

Connections remain occupied longer.

Other queries begin waiting for connections.

Unrelated endpoints experience increased latency.

### 14:00:05 — Clients start timing out

Some clients retry failed requests.

The additional traffic amplifies the original overload.

### 14:00:10 — The outage spreads

The cache stampede has become a broader reliability incident.

### What should the engineering team do?

**Immediate response:**

1. Reduce unnecessary retry traffic.
2. Protect database connections and concurrency.
3. Serve a valid stale product response if the application supports it.
4. Stop redundant regeneration work.
5. Monitor database query rates, cache hit rates, and request latency.

**Longer-term fixes:**

1. Add per-key request coalescing.
2. Consider stale-while-revalidate for product data.
3. Add TTL jitter to reduce synchronized expiration across keys.
4. Introduce cross-instance coordination if the workload requires it.
5. Bound queues and enforce appropriate concurrency limits.
6. Load-test expiration events, not merely steady-state cache hits.

The last point is particularly important.

A system can perform beautifully while its cache is warm and still fail catastrophically when a popular key expires.

**Cache expiration is a production workload event, not merely a cache-management detail.**

---

## How to decide which strategy to use
| Situation | Preferred starting point | Why |
|---|---|---|
| Many requests for the same missing key within one application process | Singleflight | Collapses duplicate work |
| Multiple instances regenerate the same expensive key | Singleflight plus an appropriate cross-instance strategy if necessary | Reduces duplication within and across instances |
| Slightly stale data is acceptable | Stale-while-revalidate | Keeps serving responses during regeneration |
| Many unrelated keys expire together | TTL jitter | Spreads expiration events over time |
| One very hot key requires controlled refresh across instances | Cross-instance coordination or another per-key refresh design | Coordinates refresh ownership |
| Refresh computation is expensive and predictable | Consider early refresh | Avoids concentrating work at expiration |
| The origin is already overloaded | Concurrency limits, backpressure, load shedding, and controlled retries | Prevents the cache problem from becoming a system-wide outage |

These approaches are complementary rather than mutually exclusive.

For example, a production product API might combine:

```text
                 Incoming requests
                         |
                         v
                    Cache lookup
                         |
              +----------+----------+
              |                     |
            Fresh                 Stale
              |                     |
              v                     v
        Return immediately    Serve stale value
                                    |
                                    v
                             Singleflight refresh
                                    |
                                    v
                                 Database
```

The cache provides reuse, stale-while-revalidate preserves availability, and singleflight prevents duplicate refresh work.

---

## The mental model to retain

```text
                CACHE STAMPEDE

Cache entry expires
        |
        v
Many requests miss simultaneously
        |
        v
Duplicate regeneration work
        |
        v
Origin becomes overloaded
        |
        v
Latency + timeouts + retries
        |
        v
Cascading failure

                PREVENTION

Cache miss
    |
    v
Coordinate regeneration
    |
    +---- Singleflight
    |
    +---- Stale-while-revalidate
    |
    +---- TTL jitter
    |
    +---- Early refresh
    |
    v
Bounded origin load
```

The most important idea is:

**Caching completed results is not enough. A robust cache design must also control how those results are regenerated when they are missing.**

That distinction becomes increasingly important as request rates grow and applications scale across multiple instances.

---

## Active recall — today's questions

Try answering these without looking back at the lesson.

1. If a popular cache key receives 3,000 requests per second and takes 1.5 seconds to regenerate, approximately how many requests could arrive during the regeneration window?

2. Why does local singleflight reduce duplicate work without necessarily guaranteeing that only one refresh occurs across an entire distributed application?

3. How do stale-while-revalidate and TTL jitter solve different problems?

4. Why can a distributed lock fail to prevent a stale refresh from overwriting a newer value after its lease expires?

5. You're designing a high-traffic product API. Which combination of caching, concurrency control, and overload protection would you choose, and what freshness guarantees would you preserve?

---
