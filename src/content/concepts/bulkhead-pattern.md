---
title: "Bulkhead pattern"
slug: "bulkhead-pattern"
domain: "backend"
layer: "production-failure-overload"
layerName: "Production failure / overload"
summary: "Isolate resources so one slow dependency cannot sink every request."
difficulty: 3
status: "published"
resources:
  - type: "article"
    title: "Azure: Bulkhead pattern"
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead"
    free: true
---

## Bulkhead Pattern: How to Stop One Slow Dependency from Taking Down Your Entire Backend

**Date:** October 15, 2026  
**Domain:** Production engineering, distributed systems, reliability, resource isolation.

Yesterday, we learned about circuit breakers. Today, we're studying a closely related but fundamentally different mechanism: the **Bulkhead Pattern**.

Imagine you're building a backend with three features:

- Checkout
- Product recommendations
- User profiles

All three share the same pool of 200 worker threads.

Suddenly, the recommendations service becomes slow. Its requests begin occupying worker threads for several seconds.

Eventually, all 200 threads are busy.

Now checkout fails, too—even though the checkout service and payment provider are perfectly healthy.

**The original problem was recommendations latency. The actual outage affects the entire application.**

The Bulkhead Pattern prevents this kind of failure from spreading by isolating resources and workloads into separate pools. 

---

## Understand the problem
## 1. What is the Bulkhead Pattern?

A bulkhead isolates workloads into separate resource pools so that one workload's failure or resource exhaustion does not consume the capacity required by other workloads.

The name comes from ships.

Ships have watertight compartments. If one compartment floods, the bulkheads limit how much of the ship is affected.

Software systems can use the same principle.

```text
                  BACKEND APPLICATION
                          |
             ┌────────────┼────────────┐
             |            |            |
             v            v            v
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Checkout│  │Recommend│  │ Profiles│
        │  Pool   │  │  Pool   │  │  Pool   │
        └─────────┘  └─────────┘  └─────────┘
             |            |            |
             v            v            v
         Payments      Search       User DB
```

Each workload has a defined resource boundary.

If the recommendations pool becomes saturated, it cannot consume all the worker capacity reserved for checkout.

Microsoft's architecture guidance describes bulkheads as a way to isolate application components into pools so that one component's failure does not bring down the others. 

**The core objective is fault containment, not preventing every individual failure.**

---

## Why does the problem exist?
## 2. Shared resources create shared failure boundaries

Suppose your application uses a worker pool containing 200 threads.

Every incoming request uses one thread while processing its work.

Your three features have the following workload:

| Feature | Concurrent requests | Average processing time |
|---|---:|---:|
| Checkout | 40 | 100 ms |
| Recommendations | 150 | 5 seconds |
| Profiles | 30 | 100 ms |

Initially, everything works.

Then the recommendations service slows down further.

Its requests begin taking 20 seconds.

The requests remain in flight for much longer, holding worker threads while waiting for the downstream service.

Eventually, 200 requests occupy all 200 threads.

New checkout requests cannot acquire a thread.

Profile requests cannot acquire one either.

```text
Shared worker pool: 200 threads

Recommendations: 180 occupied
Checkout:         15 occupied
Profiles:          5 occupied
                  ─────────────
Total:            200 occupied
```

The pool is saturated.

Now the application is unable to process new requests, regardless of whether those requests need recommendations at all.

This is **resource contention leading to a cascading failure**.

The important detail is that a slow dependency can cause resource exhaustion even when the incoming request rate hasn't increased. Longer request durations create more concurrent work. AWS describes this failure mechanism in its guidance on dependency isolation. 

## 3. Why does latency consume resources?

Consider a synchronous backend operation:

```ts
async function getRecommendations(userId: string) {
  return await recommendationsClient.fetch(userId);
}
```

Even though this function uses `async`, the surrounding request may still occupy resources while awaiting the dependency. The exact resources depend on the runtime and execution model.

In a traditional blocking server, a worker thread might remain occupied throughout the wait.

In an asynchronous server, the thread might be released, but the operation can still consume:

- A connection from an HTTP connection pool.
- Memory for the in-flight request.
- A pending task or promise.
- Queue capacity.
- Other concurrency-limited resources.

Non-blocking I/O can reduce thread occupancy, but it does not eliminate every resource constraint.

Now apply Little's Law:

\[
L = \lambda W
\]

Where:

- \(L\) is the average number of in-flight operations.
- \(\lambda\) is the arrival rate.
- \(W\) is the average time spent processing an operation.

Suppose recommendations receives 50 requests per second.

At 200 ms average latency:

\[
L = 50 \times 0.2 = 10
\]

There are approximately 10 in-flight requests on average.

If latency increases to 4 seconds:

\[
L = 50 \times 4 = 200
\]

Now there are approximately 200 in-flight requests.

The arrival rate hasn't changed. The duration has.

This is why slow dependencies can exhaust resource pools.

The Bulkhead Pattern addresses the problem by limiting how much shared capacity any one workload can consume.

---

## Try the interactive experiment
## 🧪 Bulkhead Isolation Lab

I've built an interactive simulator that compares shared resources against isolated resource pools.

Experiment with the following:

1. Select **Shared pool for every dependency**.
2. Increase the slow dependency's demand.
3. Observe how much capacity remains for healthy work.
4. Switch to **Bulkheads: isolated pools**.
5. Run the same scenario again.

The simulator demonstrates a simplified resource-allocation model. Real production systems also need to account for request duration, queueing, connection limits, and workload variability.

The question to keep in mind is:

**Should a slow, non-critical feature be allowed to consume resources required by a critical feature?**

Usually, the answer is no.

---

## How bulkheads work internally
The pattern can be implemented at several levels.

## 4. Technique A: Separate concurrency limits

Suppose your application calls three dependencies:

- Payment API
- Recommendation API
- User profile API

Instead of allowing every call to compete for one unlimited shared concurrency pool, assign each dependency a limit.

```text
                 API SERVICE
                      |
          ┌───────────┼───────────┐
          |           |           |
          v           v           v
      Payments   Recommendations  Profiles
       Limit: 40     Limit: 30    Limit: 50
          |           |           |
          v           v           v
       Provider      Search       User DB
```

If recommendations reaches its limit, new recommendation calls must wait within a bounded queue or be rejected.

They cannot consume additional concurrency reserved for payments.

A semaphore is one way to implement this.

Conceptually:

```ts
async function callRecommendationService(userId: string) {
  if (!recommendationSemaphore.tryAcquire()) {
    throw new Error("Recommendation capacity exhausted");
  }

  try {
    return await recommendationsClient.fetch(userId);
  } finally {
    recommendationSemaphore.release();
  }
}
```

This is illustrative TypeScript. The actual semaphore implementation must be concurrency-safe, and production code should use appropriate error types and deadlines.

The important property is that the permit is released even when the operation fails.

Otherwise, permits can leak, eventually making the pool appear permanently exhausted.

### Why use a semaphore?

A semaphore limits the number of operations that can execute concurrently.

If the recommendation limit is 30, the service cannot have more than 30 operations holding recommendation permits simultaneously.

This is useful even if the runtime uses asynchronous I/O, because the limit can protect connection pools, memory, downstream concurrency, or other scarce resources.

---

## 5. Technique B: Separate connection pools

A common implementation is to allocate different HTTP or database connection pools to different dependencies.

For example:

```text
Order Service
    |
    ├── Payment HTTP client
    │      └── Connection pool: 40
    │
    ├── Recommendation HTTP client
    │      └── Connection pool: 20
    │
    └── Profile DB client
           └── Connection pool: 30
```

Suppose the recommendation provider stops responding.

Its connections remain occupied until requests complete or time out.

If the pools are properly isolated, the recommendation client can exhaust its own pool without consuming every connection reserved for payment requests.

This is one of the concrete bulkhead implementations described by Microsoft. 

However, separate connection pools don't isolate everything automatically.

If all requests still share one exhausted worker pool, one global memory limit, or one unbounded queue, the application can still fail.

**A bulkhead must isolate the resource that actually forms the bottleneck.**

---

## 6. Technique C: Separate queues and worker pools

Consider a background processing system.

Your application processes:

- Payment reconciliation jobs.
- Email notifications.
- Analytics events.

If all three job types use one queue and one worker pool, a huge backlog of analytics events can delay payment reconciliation.

You can isolate them:

```text
                 PRODUCER
                    |
          ┌─────────┼─────────┐
          |         |         |
          v         v         v
      Payments    Emails   Analytics
       Queue      Queue     Queue
          |         |         |
          v         v         v
      Workers    Workers   Workers
       (8)         (4)      (12)
```

Now a large analytics backlog cannot consume all the payment-reconciliation workers.

Each queue should also have appropriate capacity limits and overload policies. Otherwise, a workload can exhaust memory or storage by accumulating an unlimited backlog.

This approach is particularly useful for event-driven systems, where different event types have different latency and priority requirements.

---

## 7. Technique D: Isolate entire service instances

Bulkheads can operate at a larger scale than threads and connection pools.

Imagine a multi-tenant SaaS platform with thousands of customers.

One tenant generates an unusually large volume of expensive queries.

If all tenants share the same database resources and worker capacity, that tenant may degrade service for everyone.

You can partition workloads into isolated cells or service instances.

```text
               Incoming requests
                       |
                Tenant routing
                       |
          ┌────────────┼────────────┐
          |            |            |
          v            v            v
       Cell A        Cell B        Cell C
      Tenants       Tenants       Tenants
       1–100        101–200       201–300
```

If Cell B fails, the intended failure boundary is limited to Cell B and its workload.

This is related to **cell-based architecture**, a larger-scale application of fault isolation.

The isolation is only as strong as the shared dependencies. If every cell still depends on the same saturated database or overloaded global queue, the failure can escape the cell boundary.

AWS recommends using fault-isolated boundaries to restrict the scope of impact from failures. 

---

## Bulkheads versus circuit breakers
These patterns are related, but they solve different problems.

We studied circuit breakers yesterday. Let's compare them directly.

| Property | Bulkhead | Circuit breaker |
|---|---|---|
| Primary purpose | Limit resource consumption and isolate workloads | Stop calls to a dependency that appears unhealthy |
| Trigger | Concurrency, capacity, or resource limit | Failure or slow-call threshold |
| Typical action | Reject excess work, isolate it, or queue within a limit | Open the circuit and fail calls fast |
| Must detect failures first? | No | Usually yes |
| Protects against healthy but excessive traffic? | Yes, if capacity limits are configured | Not necessarily |
| Protects against repeated calls to an unhealthy dependency? | Limits their resource footprint | Stops calls after the breaker opens |

Consider a service that is healthy but receives too many requests.

A bulkhead can limit concurrent work before the service becomes overloaded.

A circuit breaker might never open because the service is returning successful responses.

Now consider a dependency that has started returning errors.

A circuit breaker can open after observing failures.

A bulkhead can still protect the caller's resources while the dependency is failing.

**Use bulkheads to control resource consumption; use circuit breakers to react to unhealthy dependencies.**

For many production systems, the two patterns work best together.

---

## Trade-offs and design mistakes
## 8. Bulkheads are not free

Isolation introduces costs and configuration decisions.

### Trade-off A: Unused capacity

Suppose you divide 100 worker slots into three pools:

- Checkout: 50
- Recommendations: 30
- Profiles: 20

During a traffic spike, checkout might need 70 slots while recommendations needs only 5.

If the allocations are strict, checkout cannot automatically use the 25 idle recommendation slots.

This is the cost of reserving capacity.

Possible approaches include:

- Static partitions for critical workloads.
- Dynamic allocation with enforced per-workload limits.
- Separate hard limits combined with a shared reserve.
- Priority-based admission control.

The correct choice depends on how much isolation the business requires.

### Trade-off B: Poorly sized pools

If a pool is too small, it rejects legitimate work unnecessarily.

If it is too large, it may allow enough concurrent requests to overload the dependency.

Pool sizes should reflect measured latency, expected concurrency, downstream capacity, and the importance of each workload.

### Trade-off C: Hidden shared bottlenecks

Separate HTTP connection pools do not help if all requests are blocked behind one saturated executor.

Separate worker pools do not help if every worker is waiting for the same exhausted database connection pool.

A bulkhead must protect the relevant failure boundary, not merely create separate configuration objects.

### Trade-off D: More operational complexity

Multiple pools require independent monitoring.

At minimum, monitor:

- Active concurrency per pool.
- Pool utilization.
- Queue depth and queue wait time.
- Rejected requests.
- Request latency per workload.
- Dependency timeout rates.
- Resource utilization.

Without these metrics, a pool can become a bottleneck while the overall application still appears healthy.

Microsoft's guidance also emphasizes considering isolation granularity, operational overhead, and the cost of underutilized resources when designing bulkheads. 

---

## Production incident walkthrough
## 9. Incident: Recommendations takes down checkout

Imagine you're operating an e-commerce backend.

Your API serves checkout, recommendations, and profile requests through the same worker pool.

The pool has 200 threads.

### 10:00 — Everything is healthy

Checkout requests finish quickly.

Recommendations usually takes 300 ms.

The worker pool has enough capacity for all workloads.

### 10:02 — The search dependency becomes slow

A deployment causes the recommendation service to make expensive search queries.

Recommendation latency rises from 300 ms to 8 seconds.

The order service continues sending requests.

Each slow request occupies resources for much longer.

### 10:03 — The shared pool saturates

The application has 200 occupied threads.

Most are waiting for recommendations.

New checkout requests cannot acquire workers.

The payment provider is healthy, but checkout requests cannot reach it promptly.

### 10:04 — The incident spreads

Checkout latency rises.

Clients time out and retry.

The retry traffic adds more work to the already saturated service.

Now the original recommendations issue has become an application-wide availability problem.

This combines two failure mechanisms:

1. **Resource contention:** Slow requests consume shared capacity.
2. **Retry amplification:** Failed requests generate additional traffic.

### How would bulkheads change the outcome?

Suppose you isolate the resources:

```text
Total capacity: 200 worker slots

Checkout pool:         80
Recommendations pool:  40
Profiles pool:         40
Shared reserve:         40
```

The numbers are illustrative, not universal production recommendations.

Recommendations can occupy its 40 slots, but cannot consume the 80 slots allocated to checkout.

The system may reject excess recommendation requests or serve a fallback.

Checkout retains the capacity it needs to continue operating.

```text
Recommendation outage
         |
         v
Recommendation pool reaches limit
         |
         v
Excess recommendation work rejected
         |
         v
Checkout pool remains available
         |
         v
Critical purchasing functionality continues
```

The system has not eliminated the recommendation failure.

It has **contained its blast radius**.

That's the fundamental objective of fault isolation.

---

## How to apply this in your own backend
Suppose you're building a Node.js backend using Express, PostgreSQL, Redis, and external AI APIs.

You might design the resource boundaries like this:

```text
Express API
    |
    ├── PostgreSQL pool
    │      └── Bounded DB connections
    |
    ├── Redis client
    │      └── Independent connection limits
    |
    ├── AI inference client
    │      └── Concurrency limit + deadline
    |
    └── Background jobs
           ├── Critical queue
           └── Best-effort queue
```

For an AI application, for example, you might prevent a long-running document-ingestion workload from consuming all the capacity needed for interactive chat requests.

Possible controls include:

- Separate worker pools for ingestion and interactive inference.
- Per-model concurrency limits.
- Bounded queues.
- Request deadlines.
- Circuit breakers for failing external dependencies.
- Retry budgets for transient errors.
- Load shedding when a workload exceeds its capacity.

These are examples of resource isolation at different layers, not a requirement to implement every mechanism.

Start by identifying the resources that are shared and the failures that could exhaust them.

Then choose the smallest isolation boundary that meaningfully limits the impact.

---

## The mental model to retain

```text
           WITHOUT BULKHEADS

Slow workload
      |
      v
Consumes shared capacity
      |
      v
Other workloads starved
      |
      v
Application-wide failure

           WITH BULKHEADS

Slow workload
      |
      v
Reaches its own limit
      |
      v
Excess work rejected or bounded
      |
      v
Other workloads retain capacity
```

The most important idea is:

> **A production system should not allow one workload to consume every resource needed by unrelated critical workloads.**

Bulkheads turn resource isolation into an explicit architectural decision.

They are especially valuable when services share worker pools, connection pools, queues, compute resources, or multi-tenant infrastructure.

---

## Active recall — today's questions

Try answering these without looking back at the lesson.

1. Why can a slow dependency exhaust an application's resources even when incoming traffic remains constant?

2. How does a semaphore-based bulkhead differ from a circuit breaker?

3. Why might separate HTTP connection pools fail to protect checkout if all requests share one saturated worker pool?

4. What is the trade-off between statically reserving capacity for each workload and dynamically sharing a common pool?

5. You're building an AI backend where document ingestion and interactive chat share the same workers. How would you isolate the two workloads, and which metrics would tell you whether the isolation is working?

---
