---
title: "Retry storm"
slug: "retry-storm"
domain: "backend"
layer: "production-failure-overload"
layerName: "Production failure / overload"
summary: "Retries multiply load while a dependency is already failing."
difficulty: 3
status: "published"
resources:
  - type: "article"
    title: "AWS Builders' Library: Timeouts, retries, and backoff"
    url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
    free: true
---

## Retry Storms and Cascading Failures: How Retries Can Take Down a Healthy System

**Date:** October 13, 2026  
**Domain:** Distributed systems, production reliability, Site Reliability Engineering (SRE).

Today's concept connects almost everything we've learned so far: idempotency, transaction recovery, the transactional outbox, and distributed workflows.

Here's the paradox:

**A retry can make one request more likely to succeed while making the entire system less likely to recover.**

We'll explore why this happens, simulate a failure, and build a practical strategy for preventing it.

## What is a retry storm?
A **retry storm** occurs when a large number of failed or timed-out requests are retried, creating additional load that causes even more failures.

A **cascading failure** is a broader failure pattern in which one part of a system's failure increases the probability of failures elsewhere, potentially bringing down the entire system.

The two are closely related: retry storms can initiate or amplify cascading failures.

The  Site Reliability Engineering","Google SRE engineering practices"] book describes cascading failures as failures that grow over time through positive feedback. It identifies overload as a common cause. 

## 1. Start with a healthy service

Imagine you're operating an API that handles requests for your application.

Its capacity is:

```text
Maximum sustainable throughput: 1,000 requests/second
```

Normal incoming traffic is:

```text
Incoming traffic: 800 requests/second
```

The system has 200 requests/second of spare capacity.

Everything works.

Now imagine a temporary traffic spike or a brief slowdown in a database dependency.

The service starts handling requests more slowly.

Some requests exceed their deadlines and time out.

Your client library automatically retries them.

At first, this seems sensible. Perhaps the failure was temporary.

But consider what happens next.

## 2. The positive-feedback loop

```text
          Service becomes overloaded
                    |
                    v
             Requests time out
                    |
                    v
             Clients retry
                    |
                    v
         More requests reach service
                    |
                    v
          Service gets more overloaded
                    |
                    └──────────────┐
                                   |
                                   v
                            More timeouts
```

The system is now generating additional work because it is failing.

This is **positive feedback**: the output of a failing system feeds back into the system in a way that amplifies the original problem.

The dangerous part is that retries can keep the service overloaded even after the original traffic spike has ended. Google's SRE documentation and the AWS Builders' Library both describe this risk. 

---

## Why does this happen from first principles?
## 3. A timeout does not mean the server did no work

Suppose a request reaches your API.

The API queries PostgreSQL, but the query takes longer than expected.

The client reaches its timeout deadline and sends another request.

Meanwhile, the original database query is still running.

```text
Time ───────────────────────────────────────►

Client:
  Request A ─────────────────── Timeout
                                  |
                                  └── Retry B ──────────►

Server:
  Request A ───────────── Still executing
  Request B ───────────── Waiting / executing
```

The client believes it has stopped waiting for Request A. But unless cancellation propagates and the server cooperates, the original work may continue consuming resources.

The retry adds more work without necessarily removing the first operation.

This can consume:

- CPU time.
- Memory.
- Worker threads.
- Database connections.
- File descriptors.
- Network bandwidth.
- Queue capacity.

The result is more concurrent work, which can increase latency and exhaust resources.

Google's SRE book explains that slow requests can increase the number of in-flight operations, exhaust resources, miss deadlines, and trigger further retries. 

### A useful mental model: Little's Law

A foundational queueing relationship is:

\[
L = \lambda W
\]

Where:

- \(L\) is the average number of requests in the system.
- \(\lambda\) is the average throughput, in requests per second.
- \(W\) is the average time spent in the system, in seconds.

Suppose a service receives 800 requests per second and average request latency is 0.1 seconds.

\[
L = 800 \times 0.1 = 80
\]

Approximately 80 requests are in the system on average.

Now suppose latency increases to 1 second while throughput remains 800 requests per second.

\[
L = 800 \times 1 = 800
\]

The number of in-flight requests increases to approximately 800.

This relationship does not mean that every latency increase necessarily causes a failure. It shows why latency can become a resource problem: when work takes longer, more work accumulates concurrently.

Retries can increase the arrival rate just when the system has the least spare capacity.

---

## Try the interactive experiment
## 🧪 Retry Storm Lab

The simulator lets you change:

- Incoming request volume.
- Healthy service capacity.
- How much capacity remains during an incident.
- Incident duration.
- Maximum request attempts.
- Retry strategy.

Compare three approaches:

1. Synchronized retries.
2. Exponential backoff with jitter.
3. Exponential backoff with jitter and a retry budget.

Watch the offered load as the service moves from an incident into recovery.

The model is illustrative rather than a production capacity calculator. Its purpose is to make the feedback loop visible.

### Experiment 1: Synchronized retries

Set incoming traffic close to healthy capacity and reduce the service's capacity during the incident.

Run the simulation.

Observe how failed requests return together and compete with fresh requests.

### Experiment 2: Add jitter

Change the retry strategy to exponential backoff with jitter.

Run the same scenario again.

Observe how retries are spread across time instead of arriving in synchronized waves.

### Experiment 3: Limit retry traffic

Choose the retry-budget strategy.

Observe what happens when the system limits the number of retries instead of allowing every failed request to try again.

The important lesson is that recovery sometimes requires rejecting work that could otherwise be retried.

---

## Why retries can multiply across service layers
Consider a typical backend request path:

```text
Browser
   |
   v
API Gateway
   |
   v
Backend Service
   |
   v
Database
```

Suppose every layer independently retries its downstream call.

If each layer allows three total attempts, one logical request can generate as many as:

\[
3 \times 3 \times 3 = 27
\]

database attempts in the worst case under nested retries.

If each layer instead allows four total attempts:

\[
4^3 = 64
\]

One user action could generate up to 64 database attempts.

The exact number depends on where failures occur, which layers retry, and when they stop. These figures illustrate the worst-case multiplication, not the expected number of requests.

Google's SRE book gives a similar example involving a frontend, backend, and JavaScript layer, showing how four attempts at each of three layers can produce 64 database attempts. 

### Why this matters

Imagine the database is already struggling.

Each service layer thinks it is helping by retrying.

But collectively, they amplify traffic.

This is called **retry amplification**.

It is one reason production systems need a deliberate retry policy across the request path, rather than independent, unlimited retries in every component.

---

## How do we prevent retry storms?
There is no single mechanism that solves every overload scenario. A robust design combines several controls.

## 4. Timeouts and deadlines

A timeout limits how long a caller waits for an operation.

A deadline represents the overall time by which the operation must finish.

For example:

```text
Incoming request deadline: 2 seconds

API processing:             300 ms
Inventory call:             400 ms
Payment call:               600 ms
Remaining budget:           700 ms
```

Each downstream call should respect the remaining deadline rather than starting a fresh, arbitrary timeout.

If a request has already exceeded its deadline, continuing expensive work may waste resources.

However, a timeout alone does not stop the underlying operation. You need cancellation propagation and cooperative cancellation where supported.

## 5. Exponential backoff

Instead of retrying immediately, increase the delay after each failed attempt.

A simplified formula is:

\[
d_n = \min(d_{\max}, d_0 \times 2^{n-1})
\]

Where:

- \(d_n\) is the delay before attempt \(n\).
- \(d_0\) is the initial delay.
- \(d_{\max}\) is the maximum delay.

For example, with a 100 ms initial delay and a 1,000 ms cap:

| Retry | Delay |
|---|---:|
| 1 | 100 ms |
| 2 | 200 ms |
| 3 | 400 ms |
| 4 | 800 ms |
| 5 | 1,000 ms |
| 6 | 1,000 ms |

The cap prevents the delay from growing indefinitely.

But exponential backoff has a subtle weakness.

If thousands of clients fail at approximately the same time, they can all follow the same delay schedule.

That means they may all retry together again.

Which leads us to jitter.

## 6. Jitter

**Jitter adds randomness to retry delays.**

Instead of every client retrying after exactly 400 ms, they might retry at different times within an allowed window.

```text
Without jitter:

Client A ───────── 400 ms ─────────► Retry
Client B ───────── 400 ms ─────────► Retry
Client C ───────── 400 ms ─────────► Retry
Client D ───────── 400 ms ─────────► Retry

With jitter:

Client A ───── 270 ms ───► Retry
Client B ───────── 410 ms ───► Retry
Client C ─── 190 ms ───► Retry
Client D ─────────── 470 ms ───► Retry
```

The goal is to spread retry traffic over time, reducing synchronized bursts.

A common implementation uses **full jitter**:

\[
d_n \sim U(0,\min(d_{\max},d_0 2^{n-1}))
\]

Here, \(U(0,x)\) means choosing a random delay between zero and \(x\).

The exact algorithm depends on the system and client library. What matters is that clients do not all retry on the same deterministic schedule.

The AWS Builders' Library recommends combining timeouts, retries, exponential backoff, and jitter to improve resilience without overwhelming struggling dependencies. Its article was updated on June 15, 2026. 

## 7. Retry budgets

Even backoff and jitter cannot make unlimited retries safe.

A **retry budget** limits how much additional traffic a client or service can generate through retries.

For example:

```text
Normal requests:  1,000 per second
Retry budget:       100 retries per second
```

When the budget is exhausted, the system stops issuing additional retries and returns failures instead.

A token-bucket implementation is one way to enforce such a budget. Tokens are consumed when retries are allowed and replenished according to a configured policy.

AWS SDK retry strategies include retry quotas that can stop further attempts when failures become widespread. 

### Why is failing fast sometimes better?

Suppose the database can handle 1,000 requests per second, but clients are trying to send 2,000 attempts per second.

Continuing to retry may keep the database overloaded.

Failing some requests quickly can preserve capacity for other requests and give the service a chance to recover.

A failed request is undesirable. A system-wide outage is usually worse.

---

## Other mechanisms that protect a service
Retries are only one part of overload control.

| Mechanism | Purpose | Important limitation |
|---|---|---|
| **Circuit breaker** | Temporarily stops calls to a failing dependency | Can delay recovery or behave poorly if thresholds are misconfigured |
| **Load shedding** | Rejects selected work before the service collapses | Some requests will fail deliberately |
| **Bounded queues** | Limits queued work and memory consumption | Requests beyond the limit must be rejected or handled differently |
| **Concurrency limits** | Caps simultaneous work | May reduce throughput if set too low |
| **Bulkheads** | Isolates resource pools so one workload cannot consume everything | Requires thoughtful resource partitioning |
| **Graceful degradation** | Performs less work or returns a cheaper result | The degraded behavior must still be useful and correct |
| **Deadline propagation** | Stops work that can no longer finish within the caller's time budget | Requires cooperation throughout the call chain |

Google's SRE guidance recommends load shedding, controlled queue lengths, and early rejection of requests when a service is overloaded. It also warns that retries can amplify an outage. 

These mechanisms complement one another.

For example, a bounded queue prevents unbounded accumulation of work, while a retry budget prevents clients from endlessly regenerating requests that the service has already rejected.

---

## How this connects to our previous concepts
Today's lesson ties together several important production patterns.

```text
                    DISTRIBUTED RELIABILITY
                              |
              ┌───────────────┼───────────────┐
              |               |               |
              v               v               v
         Correct state   Safe repetition   Controlled load
              |               |               |
              v               v               v
         Atomic updates   Idempotency     Backoff + jitter
         Serializable     Deduplication   Retry budgets
         transactions
                              |
                              v
                      Reliable workflows
                              |
                              v
                    Transactional outbox
                    + Saga coordination
```

The distinctions matter:

- **Lost update:** Two concurrent operations interfere with shared state.
- **Write skew:** Two individually valid transactions violate a cross-record invariant.
- **Idempotency:** Repeating one logical operation should not repeat its intended side effect.
- **Transactional outbox:** The intent to publish an event is stored atomically with a local business change.
- **Saga:** Multiple local transactions are coordinated into a recoverable business workflow.
- **Retry storm:** Recovery attempts overload a dependency and amplify the original failure.

These concepts address different problems, but they interact in production.

For example, a Saga might retry a failed service call. If every Saga participant retries independently and the dependency is overloaded, the workflow can amplify the outage. The Saga needs retry limits, deadlines, and a durable recovery policy just as much as any other distributed workflow.

---

## Production incident walkthrough
Imagine an e-commerce backend serving 10,000 requests per second.

Its database normally handles the load comfortably.

A deployment introduces a query regression, increasing database latency.

The timeline unfolds:

**09:00:00 — Latency increases**

Database queries that normally take 50 ms begin taking 700 ms.

**09:00:10 — Clients start timing out**

The API gateway and backend clients have aggressive timeouts. They begin retrying failed requests.

**09:00:20 — Concurrent work increases**

Some original queries are still running while retries start additional queries.

Database connections remain occupied for longer. Request queues grow.

**09:00:30 — Error rate rises**

More requests exceed their deadlines. Clients retry again.

**09:00:40 — The database becomes severely overloaded**

The database completes less useful work, despite receiving more query attempts.

**09:01:00 — Recovery stalls**

Even after the initial traffic spike subsides, retry traffic continues to consume capacity.

This is a retry-amplified cascading failure.

### What should the incident response do?

1. Reduce or eliminate unnecessary retry traffic.
2. Stop the query regression or roll back the problematic deployment.
3. Shed low-priority work if the database remains overloaded.
4. Preserve capacity for critical requests.
5. Check connection-pool utilization, queue length, query latency, timeout rates, and retry rates.
6. Restore normal retry behavior only when the dependency is stable.

Google's SRE guidance describes this class of failure and notes that recovery can require substantially reducing load until retries stop and the backend stabilizes. 

### What should you measure?

Monitor at least:

- Incoming request rate.
- Successful request throughput.
- Retry rate and retries per logical request.
- Timeout rate.
- Latency percentiles.
- In-flight requests.
- Queue depth and queue wait time.
- Database connection-pool saturation.
- Dependency error rate.
- Rejected requests and load-shedding rate.

One particularly useful signal is the ratio:

\[
\text{Retry ratio} =
\frac{\text{Retry attempts}}{\text{Original request attempts}}
\]

A rapidly increasing retry ratio while successful throughput falls is a warning that the system may be amplifying its own failure.

However, retry ratio alone does not prove a cascading failure. Interpret it alongside latency, capacity, and error metrics.

---

## Practical checklist: Before adding automatic retries

For every remote call, ask:

- **Is the failure transient?** Don't retry validation errors or other failures that will not improve with another attempt.
- **Is the operation safe to retry?** Use idempotency or another suitable mechanism for operations with side effects.
- **Is there a timeout?** Bound how long resources remain occupied.
- **Is the deadline propagated?** Avoid work that can no longer satisfy the original request.
- **Is backoff used?** Avoid immediate retry loops.
- **Is jitter used?** Prevent synchronized retry bursts.
- **Are attempts limited?** Avoid indefinite retries.
- **Is there a retry budget?** Bound additional traffic during widespread failures.
- **Is retrying happening at multiple layers?** Prevent multiplicative amplification.
- **Can the dependency reject excess work?** Use bounded queues, concurrency limits, or load shedding.
- **Can the failure be observed?** Monitor retries separately from original requests.

For further reading, these two primary sources are especially useful:

-  SRE Book: Addressing Cascading Failures
-  Builders' Library: Timeouts, Retries, and Backoff with Jitter

---
