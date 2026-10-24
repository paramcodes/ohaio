---
title: "Circuit breaker"
slug: "circuit-breaker"
domain: "backend"
layer: "production-failure-overload"
layerName: "Production failure / overload"
summary: "Stop calling a failing dependency before it takes the whole system down."
difficulty: 3
status: "published"
resources:
  - type: "article"
    title: "Azure: Circuit Breaker pattern"
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker"
    free: true
---

## Circuit Breakers: How to Prevent One Failing Service from Taking Down Your Entire Backend

**Date:** October 14, 2026  
**Domain:** Distributed systems, reliability engineering, production infrastructure.

Yesterday, we learned about retry storms: how retrying failed requests can overload a service and make an outage worse.

Today, we'll study a complementary mechanism: the **Circuit Breaker Pattern**.

The central idea is:

> When a dependency is failing, stop sending it ordinary traffic temporarily. Fail fast, give it time to recover, and then test whether it is safe to resume normal traffic.

This is a fundamental pattern for building reliable backend systems.

## Understand the problem
## 1. What is a circuit breaker?

A circuit breaker is a software mechanism that monitors failures when calling a dependency and temporarily prevents calls when that dependency appears unhealthy.

The name comes from electrical circuit breakers.

An electrical breaker interrupts a circuit when current exceeds a safe limit. A software circuit breaker interrupts requests when failures or excessive latency indicate that continuing to call a dependency may be harmful.

Consider this backend:

```text
                    Your API
                       |
                       v
                Order Service
                       |
                       v
                 Payment API
                       |
                       v
                Payment Provider
```

Suppose the payment provider becomes slow or starts returning errors.

Without protection, your Order Service might continue sending requests.

Each request might wait for several seconds, consume a connection, occupy a worker, and eventually time out.

Meanwhile, new requests continue arriving.

Eventually, your Order Service can run out of available workers or connections—even though the original problem is in the payment provider.

A circuit breaker introduces a control point:

```text
                Order Service
                       |
                       v
                 Circuit Breaker
                       |
                +------+------+
                |             |
              CLOSED          OPEN
                |             |
                v             v
          Call dependency   Reject locally
```

When the breaker is closed, requests can pass through.

When it is open, ordinary requests are rejected locally instead of being sent to the failing dependency.

**The goal is to protect both the caller and the struggling dependency.**

---

## Why do we need it?
## 2. Why isn't a timeout enough?

Imagine your payment provider normally responds in 100 milliseconds.

Your application sets a timeout of 2 seconds.

Now the provider becomes unhealthy and takes 10 seconds to respond.

Your application waits for 2 seconds before timing out.

That request has occupied resources for much longer than usual.

If 500 requests arrive concurrently, many may remain in flight while waiting for the provider.

```text
Normal operation:

Request ── 100 ms ──► Success

During outage:

Request ───────────── 2 seconds ────────────► Timeout
Request ───────────── 2 seconds ────────────► Timeout
Request ───────────── 2 seconds ────────────► Timeout
```

A timeout limits how long an individual call waits.

It does not automatically prevent the next request from making the same expensive call.

Even worse, some timed-out operations may continue running in the dependency if cancellation does not propagate.

A circuit breaker changes the behavior after evidence of repeated failures.

```text
Without circuit breaker:

Request ──► Payment Provider ──► Timeout
Request ──► Payment Provider ──► Timeout
Request ──► Payment Provider ──► Timeout
Request ──► Payment Provider ──► Timeout

With circuit breaker:

Request ──► Payment Provider ──► Failure
Request ──► Payment Provider ──► Failure
                       |
                       v
                Breaker opens
                       |
                       v
Request ──► Local failure, no provider call
Request ──► Local failure, no provider call
Request ──► Local failure, no provider call
```

The breaker prevents every new request from repeating the same expensive failure.

## 3. Why does this matter from first principles?

Backend services have finite resources.

A service has limited:

- Worker threads or execution slots.
- Database connections.
- Memory.
- Network connections.
- CPU capacity.
- Queue capacity.

When a downstream dependency becomes slow, requests spend more time waiting.

That increases the number of in-flight operations.

A useful relationship from queueing theory is Little's Law:

\[
L = \lambda W
\]

Where:

- \(L\) is the average number of operations in the system.
- \(\lambda\) is the arrival rate.
- \(W\) is the average time spent in the system.

Suppose your service receives 200 requests per second, and each request spends an average of 0.1 seconds in the system.

\[
L = 200 \times 0.1 = 20
\]

Now suppose a failing dependency increases average request duration to 2 seconds.

\[
L = 200 \times 2 = 400
\]

The average number of in-flight requests rises from 20 to 400, assuming the system continues sustaining that arrival rate.

If the service has only 100 execution slots, it cannot keep processing all that work immediately. Requests accumulate in queues, wait for resources, or get rejected.

This is one mechanism behind cascading failures.

A circuit breaker limits repeated calls to a dependency that is unlikely to succeed, reducing the amount of wasted work.

---

## How a circuit breaker works internally
## 4. The three states

A conventional circuit breaker has three states:

1. **CLOSED:** Allow calls and monitor outcomes.
2. **OPEN:** Reject ordinary calls without contacting the dependency.
3. **HALF-OPEN:** Permit a limited number of test calls to check recovery.

The state machine looks like this:

```text
                    Failures exceed threshold
                 ┌────────────────────────────┐
                 │                            v
             CLOSED ───────────────────────► OPEN
                ^                              |
                |                              |
                |                         Wait interval
                |                              |
                |                              v
                └──────────────────────── HALF-OPEN
                     Probes succeed             |
                                                |
                                      Probe fails
                                                |
                                                v
                                               OPEN
```

Let's examine each state.

### State A: CLOSED

The breaker allows requests through.

It records information about their outcomes, such as:

- Successes.
- Failures.
- Timeouts.
- Slow responses.

Suppose the breaker opens when the failure rate exceeds a configured threshold, provided enough calls have been observed.

For example:

```text
Observation window: 20 calls
Failures:           15
Failure rate:       75%
Configured threshold: 50%
```

The breaker may open because the observed failure rate exceeds the threshold.

However, production implementations often use rolling windows and additional safeguards. They may also consider slow-call rates, minimum request volumes, or consecutive failures.

The numbers above are illustrative, not recommended defaults.

### State B: OPEN

The breaker stops ordinary requests from reaching the dependency.

Instead of waiting for another timeout, the caller receives a local failure immediately.

For example:

```text
Client request
      |
      v
Circuit breaker: OPEN
      |
      v
Return dependency-unavailable error
```

This is called **failing fast**.

The dependency receives less traffic, and the calling service avoids repeatedly wasting resources on operations that are unlikely to succeed.

The breaker stays open for a configured interval before allowing recovery probes.

### State C: HALF-OPEN

After the open interval expires, the breaker enters half-open.

It allows a small number of test requests to reach the dependency.

For example:

```text
Normal request volume: 500 calls/second

Breaker opens:
    Ordinary calls blocked

Half-open:
    Permit 2 test calls

If probes succeed:
    Close breaker

If probes fail:
    Reopen breaker
```

The idea is to test whether the dependency has recovered without immediately sending it the full traffic volume.

A half-open breaker does not know that the dependency is healthy. It gathers evidence.

One successful probe may be insufficient if the dependency remains unstable. Real implementations can require multiple successful probes or use a configured success rate before closing.

---

## Try the interactive experiment
## 🧪 Circuit Breaker Lab

The simulator lets you adjust:

- Incoming request volume.
- Dependency capacity during an outage.
- Outage duration.
- Failure threshold.
- Number of half-open probes.
- Whether the circuit breaker is enabled.

Try these experiments.

**Experiment 1: No breaker**

Set the strategy to *No breaker*.

Run the scenario.

Observe how every time slot continues sending requests to the dependency during the outage.

**Experiment 2: Enable the breaker**

Use the same settings but enable the circuit breaker.

Observe when the breaker opens and how many requests it rejects locally.

**Experiment 3: Change the threshold**

Increase the failure threshold and rerun the simulation.

Notice that a higher threshold can delay opening the breaker.

That may allow more requests to reach the dependency before the breaker intervenes.

**Experiment 4: Change the number of half-open probes**

Compare one probe with five probes.

More probes can provide more evidence about recovery, but they also send more traffic to the dependency while it may still be unhealthy.

The simulator is illustrative. Production breakers need careful failure classification, time windows, concurrency control, and recovery policies.

---

## Circuit breakers versus retries
## 5. They solve different problems

This distinction is essential.

A retry policy asks:

> Is another attempt likely to succeed?

A circuit breaker asks:

> Is it currently appropriate to send this request to the dependency at all?

Retries are useful for transient failures.

Circuit breakers are useful when continued calls to an unhealthy dependency are likely to waste resources or amplify an outage.

| Property | Retry | Circuit breaker |
|---|---|---|
| Primary purpose | Recover from transient failures | Stop repeated calls to an unhealthy dependency |
| Behavior after failure | May attempt again | May block subsequent calls |
| Adds traffic? | Yes | Usually reduces traffic to the dependency |
| Main control | Attempts, deadlines, backoff | Failure thresholds, open interval, probes |
| Typical risk | Retry amplification | False opening or premature recovery |
| Recovery mechanism | Try again later | Half-open probes before restoring traffic |

They are often used together.

```text
             Request
                |
                v
          Circuit breaker
                |
          +-----+-----+
          |           |
        CLOSED        OPEN
          |           |
          v           v
     Attempt call   Fail fast
          |
          v
       Failure?
          |
          v
   Limited retry policy
          |
          v
   Backoff + jitter
```

The exact ordering and integration depend on the library and application.

For example, some implementations place a breaker around a retry operation, while others evaluate failures for individual attempts. Those designs can produce different breaker metrics and behavior.

The important rule is to define which failures count toward the breaker and ensure retries do not multiply uncontrollably.

---

## When is a circuit breaker actually needed?
Circuit breakers are most useful when a service makes calls to a dependency that can become slow or unavailable and where repeated calls can consume significant resources.

Common examples include:

| Dependency | Potential failure |
|---|---|
| Payment provider | Requests time out during an outage |
| External API | Rate limits or returns repeated server errors |
| Database service | Connection attempts repeatedly fail |
| Internal microservice | One unhealthy service exhausts caller resources |
| AI inference endpoint | Requests become extremely slow under GPU saturation |
| Search service | Queries repeatedly exceed their latency deadline |

However, a circuit breaker is not necessary for every operation.

For example, if a local function executes in a few microseconds and has no external dependency, a circuit breaker would generally add complexity without meaningful protection.

It is also not a replacement for:

- Timeouts.
- Concurrency limits.
- Retry budgets.
- Bulkheads.
- Load shedding.
- Health monitoring.

These mechanisms address different parts of the reliability problem.

---

## Trade-offs and failure modes
## 6. A circuit breaker can open unnecessarily

Suppose a payment provider briefly experiences a small increase in errors.

The breaker observes a failure rate above its threshold and opens.

But the provider might have recovered almost immediately.

Now your application rejects requests even though the dependency could successfully process them.

This is a **false positive**: the breaker classifies a dependency as unhealthy when it could have handled more requests.

On the other hand, a threshold that is too high may allow excessive traffic through during a genuine outage.

That is a form of delayed detection.

### Important configuration choices

| Configuration | What happens if it's poorly chosen? |
|---|---|
| Failure threshold | Too low: opens unnecessarily. Too high: reacts too slowly. |
| Observation window | Too short: reacts to noise. Too long: reacts slowly. |
| Minimum call volume | Too low: small samples cause unstable decisions. Too high: detection may be delayed at low traffic volumes. |
| Open interval | Too short: repeatedly probes an unhealthy dependency. Too long: delays recovery. |
| Half-open probe count | Too many: can overload recovering dependencies. Too few: may provide insufficient evidence. |
| Failure classification | Counting permanent business errors as dependency failures can open the breaker unnecessarily. |

A robust implementation should distinguish dependency failures from expected business outcomes.

For example, an HTTP `500` from a payment provider may indicate a dependency problem.

An HTTP `400` indicating invalid customer input usually does not.

A `429` rate-limit response requires more nuanced handling: it may indicate that the caller is exceeding a quota, and the appropriate response may involve honoring `Retry-After`, reducing traffic, or applying a separate rate-limit policy.

---

## Production incident walkthrough
Imagine you're building an AI application.

Your backend sends requests to an inference service that generates responses using a large language model.

Under normal conditions:

```text
Request latency:  800 ms
Throughput:       100 requests/second
Error rate:       0.5%
```

Then a large batch of requests arrives, saturating GPU capacity.

Inference latency increases to 12 seconds.

Your API has a 5-second timeout.

Requests begin timing out, and clients retry.

The backend now has more in-flight requests, more occupied connections, and more waiting work.

Even after the initial traffic spike ends, the inference service struggles to recover.

### What happens without a breaker?

```text
User request
     |
     v
Inference service overloaded
     |
     v
Request times out
     |
     v
Client retries
     |
     v
Inference service receives more work
     |
     v
Recovery becomes harder
```

### What happens with a breaker?

The backend observes repeated dependency failures and opens the circuit.

```text
User request
     |
     v
Circuit breaker OPEN
     |
     v
Return controlled error or fallback
     |
     v
Stop sending ordinary inference calls
     |
     v
Inference service recovers
     |
     v
Half-open probes succeed
     |
     v
Restore normal traffic gradually
```

The fallback could be a cached response, a smaller model, a queue for later processing, or a controlled error. The correct choice depends on the application's requirements.

A breaker cannot manufacture GPU capacity. It protects the surrounding system and gives the dependency a better chance to recover.

### What should you monitor?

Useful signals include:

- Dependency success and failure rates.
- Dependency latency percentiles.
- Circuit-breaker state transitions.
- Number of locally rejected calls.
- Half-open probe outcomes.
- Retry attempts per logical request.
- In-flight requests.
- Queue depth.
- Connection-pool saturation.

An especially useful combination is **rising dependency latency, falling successful throughput, and increasing locally rejected requests**. Together, these can help distinguish a protected dependency outage from a system that is still sending every request downstream.

---

## The mental model to retain

```text
          Dependency call
                 |
                 v
        Is the breaker CLOSED?
             /         \
           Yes          No
            |            |
            v            v
      Send request    Fail fast
            |
            v
      Observe outcome
            |
      +-----+------+
      |            |
   Success       Failure
      |            |
      v            v
  Keep closed   Threshold exceeded?
                    |
               +----+----+
               |         |
              No        Yes
               |         |
               v         v
           Keep open?   OPEN
                         |
                    Wait interval
                         |
                         v
                     HALF-OPEN
                         |
                    Probe outcome
                         |
                  +------+------+
                  |             |
               Success        Failure
                  |             |
                  v             v
                CLOSED         OPEN
```

The most important distinction:

> **Retries attempt recovery by doing the work again. Circuit breakers protect the system by temporarily refusing to do work that is unlikely to succeed.**

Together with timeouts, backoff, jitter, and retry budgets, circuit breakers help prevent a temporary dependency failure from becoming a system-wide outage.

---

## Active recall — today's questions

Try to answer these without looking back at the lesson.

1. Why can a circuit breaker protect a backend even when it cannot repair the failing dependency?

2. What are the three circuit-breaker states, and what causes transitions between them?

3. Why is half-open preferable to immediately sending full traffic when an open circuit breaker reaches its timeout?

4. How do a circuit breaker and a retry policy differ, and why can combining them incorrectly make an outage worse?

5. What could happen if a circuit breaker counts every HTTP `400` response as evidence that a downstream dependency is unhealthy?

---
