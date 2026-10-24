---
title: "Fencing tokens"
slug: "fencing-tokens"
domain: "backend"
layer: "distributed-systems"
layerName: "Distributed systems"
summary: "A distributed lock is not enough when a stale owner can still write."
difficulty: 5
status: "published"
resources:
  - type: "article"
    title: "Martin Kleppmann: How to do distributed locking"
    url: "https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html"
    free: true
---

## Fencing Tokens: Why a Distributed Lock Can Still Let Two Workers Corrupt Your Data

**Date:** October 17, 2026  
**Domain:** Distributed systems, concurrency control, fault tolerance, storage consistency.

Today's concept addresses a subtle production failure: **a worker can lose ownership of a distributed lock and still continue executing operations that modify shared data.**

Imagine two workers processing the same invoice.

Worker A acquires a lock and starts processing. Its process pauses for 30 seconds. Meanwhile, the lock expires, and worker B acquires it and completes the job.

Then A wakes up and writes its old result.

Both workers have modified the same resource, even though the locking service correctly granted ownership to only one worker at a time.

The solution involves a mechanism called a **fencing token**.

I've also built an interactive experiment that lets you reproduce this stale-writer failure.

---

## The problem with distributed locks
## 1. What is a distributed lock?

A distributed lock is a coordination mechanism that helps multiple processes agree on which process should access a shared resource.

For example, suppose you have three application instances running a scheduled invoice-generation job.

You don't want all three instances to generate the same invoice simultaneously.

A lock can coordinate ownership:

```text
             Lock Service
                  |
          Grants ownership to A
                  |
                  v
             Worker A
                  |
                  v
          Generate invoice
```

Worker A acquires the lock, performs the work, and releases the lock.

If worker B tries to acquire the same lock while A owns it, B must wait or fail to acquire it.

This is useful when multiple processes operate on the same logical resource.

However, production systems also need to handle crashes, pauses, and network failures.

That is where the problem begins.

## 2. Why do locks often have expiration times?

Suppose worker A acquires a lock and then crashes.

If the lock never expires, other workers might wait indefinitely.

A common solution is a **lease**: ownership lasts for a limited period and must be renewed to continue.

For example:

```text
Worker A acquires lease
        |
        v
Lease valid for 15 seconds
        |
        v
Worker renews lease periodically
        |
        v
If renewal stops, lease expires
        |
        v
Another worker can acquire ownership
```

A lease provides a useful liveness property: a failed worker doesn't necessarily block the resource forever.

But it creates a subtle safety problem.

**The lock service can expire a lease without physically stopping the process that previously held it.**

That distinction is the foundation of today's lesson.

---

## Reproduce the failure
## 3. The stale-writer scenario

Imagine worker A acquires a 15-second lease.

It begins calculating the result of an expensive operation.

Then its process experiences a long garbage-collection pause, VM suspension, or severe CPU starvation.

The process stops making progress for 30 seconds.

During that pause, the lease expires.

Worker B acquires a new lease and completes the operation.

Then worker A resumes.

It doesn't automatically know that its lease expired and another worker took ownership.

Its code might continue running and submit its result.

Consider the timeline:

```text
Time ─────────────────────────────────────────►

Worker A:
Acquire lock ── Start work ── PAUSE ────────── Resume ── Write old result
     |
     | Lease expires
     |
Worker B:
                 Acquire lock ── Work ── Write new result
```

Both workers may now issue writes to the same resource.

If the storage system simply accepts writes from whichever request arrives last, worker A can overwrite worker B's newer result.

This is a **stale-writer problem**.

Martin Kleppmann's analysis of distributed locking explains why a lease alone cannot prevent a paused client from continuing to act after its ownership has expired. 

## 4. Why can't worker A detect that it lost the lock?

You might think the application could simply check whether its lease is still valid before writing.

For example:

```ts
if (await lock.isValid()) {
  await saveResult(result);
}
```

Unfortunately, this has a race condition.

Consider:

```text
1. Worker A checks the lease.
2. The lease is valid.
3. Worker A pauses.
4. The lease expires.
5. Worker B acquires the lease and writes.
6. Worker A resumes and writes.
```

The check was correct when it occurred.

But ownership changed before the write.

This is a time-of-check-to-time-of-use problem, commonly called **TOCTOU**.

The critical interval is:

```text
Check ownership ───────────────► Modify resource
                   ^
                   |
           Ownership can change
           during this interval
```

Checking ownership in the client cannot, by itself, make the subsequent operation safe.

We need a way for the resource receiving the write to distinguish a current owner from an old owner.

---

## What is a fencing token?
## 5. The core idea

A **fencing token** is a monotonically increasing value issued when ownership of a protected resource is granted.

For example:

```text
First lock acquisition:   Token 41
Second lock acquisition:  Token 42
Third lock acquisition:   Token 43
Fourth lock acquisition:  Token 44
```

Every new owner receives a higher token than the previous owner.

The worker must include its token when writing to the protected resource.

The storage system remembers the highest token it has accepted and rejects writes carrying an older token.

This transforms the problem.

Instead of trusting the worker's belief that it still owns the lock, the storage system uses an ordered ownership generation to identify stale writes.

The key idea is described in  Kleppmann","distributed systems researcher and author"] article on distributed locking. 

## 6. See how it works

Suppose worker A receives token 41.

It pauses, and its lease expires.

Worker B then receives token 42 and writes its result.

The storage system records that it has accepted token 42.

When worker A resumes and sends a write with token 41, the storage system compares the tokens.

```text
                  Shared Storage
                        |
                        v
                Highest token = 42
                        |
              ┌─────────┴─────────┐
              |                   |
         Worker B              Worker A
         Token 42              Token 41
              |                   |
              v                   v
         Accept write          Reject write
              |                   |
              v                   v
           Current              Stale
```

The comparison is:

\[
41 < 42
\]

Therefore, the stale write is rejected.

Worker A may still be running. It may still believe its lease is valid. It may even have completed all its calculations correctly.

None of that matters to the storage system.

**The protected resource enforces the ownership ordering.**

---

## How fencing tokens work internally
## 7. Step one: Issue an ordered token

The coordination system must issue a token that increases with each successful ownership acquisition.

For example:

```text
Acquire resource R
        |
        v
Lock service grants ownership
        |
        v
Token = 41
```

When the lease expires and another worker acquires ownership:

```text
Acquire resource R again
        |
        v
Lock service grants ownership
        |
        v
Token = 42
```

The tokens must be ordered reliably.

A random UUID is not sufficient because the storage system cannot determine whether one UUID represents an older or newer owner.

For correctness-sensitive coordination, the token source must provide a reliable ordering across acquisitions and relevant failover scenarios.

For example,  key-value store"] provides transactional and revision-based coordination primitives that can be used to construct ownership checks and ordering mechanisms. Its official documentation describes distributed locks and how lock ownership can be tied to a lease. 

The exact token-generation mechanism depends on the coordination system.

## 8. Step two: Include the token in every protected write

A worker should propagate its token to the resource it is modifying.

Conceptually:

```ts
await storage.write({
  resourceId: "invoice-42",
  result: generatedInvoice,
  fencingToken: 42,
});
```

The token isn't useful merely because the worker attaches it to the request.

The storage system must actively validate it.

If the token is dropped by an intermediary, ignored by the database, or checked only by the client, it provides no effective fencing protection.

## 9. Step three: Enforce the token atomically

Suppose you maintain a table containing the latest accepted token for each resource.

```sql
CREATE TABLE invoice_state (
    invoice_id TEXT PRIMARY KEY,
    result JSONB NOT NULL,
    last_fencing_token BIGINT NOT NULL
);
```

A simplified conditional update might look like this:

```sql
UPDATE invoice_state
SET
    result = $1,
    last_fencing_token = $2
WHERE
    invoice_id = $3
    AND last_fencing_token <= $2;
```

The application checks the number of affected rows.

- If a row was updated, the token passed the comparison.
- If no row was updated, the write may have been rejected because its token was stale, or because the resource didn't exist.

The application must distinguish those cases where necessary.

The important operation is the comparison and update occurring atomically within the database.

A separate `SELECT` followed by an unconditional `UPDATE` would reintroduce a race.

### What happens in our example?

The database has already recorded:

```text
last_fencing_token = 42
```

Worker A attempts:

```text
incoming fencing token = 41
```

The condition becomes:

\[
42 \leq 41
\]

This is false.

The database rejects the update.

The stale worker cannot overwrite the state protected by the newer token.

### An important limitation

A fencing token is not a magical, instantaneous revocation mechanism.

Suppose worker A's lease expires, but its delayed write reaches the database before the database has accepted any write carrying worker B's newer token.

If the database knows only the highest token it has previously accepted, it may not yet know that A is stale.

The fencing mechanism prevents an older token from overwriting state after the resource has observed a newer token. It does not necessarily reject every old-token write from the exact instant the lease expires.

If your correctness requirement demands immediate enforcement of current ownership, the protected resource must also validate ownership against an authoritative state or use a storage-native concurrency mechanism that provides the required guarantee.

This distinction is important when protecting irreversible external side effects.

---

## Why not just use a shorter lease?
## 10. The lease-duration trade-off

Suppose your lease lasts 30 seconds.

You might shorten it to 5 seconds to reduce the time before another worker can take over after a failure.

That improves recovery speed in some scenarios.

But it also makes temporary pauses and delayed renewals more likely to cause legitimate workers to lose their leases.

And no finite timeout can guarantee that a process will never pause longer than the configured lease duration.

Consider:

```text
Lease duration: 5 seconds

Worker pauses:  10 seconds
```

The worker can still resume after its lease has expired.

Now suppose you choose a 60-second lease.

That reduces the likelihood of accidental expiry during short pauses, but a crashed worker might prevent another worker from taking over for longer.

The trade-off is:

| Strategy | Advantage | Limitation |
|---|---|---|
| Short lease | Faster takeover after failure | More frequent ownership loss during pauses |
| Long lease | More tolerance for temporary delays | Slower takeover after failure |
| Lease + fencing | Allows recovery while rejecting stale writes once a newer token is enforced | Requires token propagation and enforcement at the protected resource |

**A lease duration is a liveness and recovery parameter. It is not, by itself, a proof that a writer is still authorized to modify the resource.**

---

## When should you use fencing tokens?
Fencing tokens are especially valuable when a distributed lock protects correctness-sensitive writes and processes may pause, lose connectivity, or continue running after ownership expires.

Common examples include:

| System | Protected operation | Failure fencing helps prevent |
|---|---|---|
| Invoice processing | Updating invoice state | An old worker overwriting a newer result |
| Distributed schedulers | Updating job state | A previous job owner committing stale output |
| File processing | Replacing a generated artifact | An old worker overwriting a newer artifact |
| Leader-based systems | Updating shared state | A stale leader modifying state after a newer leader takes over |
| Resource provisioning | Updating infrastructure state | An old controller overwriting a newer reconciliation result |

However, you don't necessarily need a distributed lock and fencing tokens for every concurrent update.

If a database can enforce the required invariant through a conditional update, row lock, unique constraint, optimistic version check, or serializable transaction, that may be simpler.

For example, optimistic concurrency control can reject updates whose expected version no longer matches the stored version.

The right choice depends on the actual correctness requirement.

---

## How fencing tokens connect to concepts we've already learned
Today's concept builds on several earlier lessons.

### Connection 1: Lost updates

A lost update occurs when one write overwrites another because it is based on stale state.

Fencing tokens can prevent an old lock holder from overwriting state after a newer token has been accepted.

Both mechanisms involve protecting a shared resource from stale writes, but fencing tokens specifically encode the ordering of distributed ownership generations.

### Connection 2: Idempotency

Suppose worker A sends an external payment request, pauses, and loses its lease.

Worker B takes over and submits the same payment operation.

A fencing token may not help if the external payment provider doesn't understand or enforce it.

You may need an idempotency key to prevent duplicate payment effects.

Fencing and idempotency solve different problems:

- **Fencing:** Reject stale writers based on ownership ordering.
- **Idempotency:** Prevent repeated attempts at the same logical operation from duplicating its effect.

### Connection 3: Saga Pattern

A Saga may use multiple workers to coordinate a business workflow.

If a worker loses ownership while processing a Saga, a stale write might incorrectly advance the workflow state.

Fencing can protect the workflow's shared state, while idempotency and durable recovery handle repeated operations and incomplete compensations.

The broader principle is that distributed correctness often requires several mechanisms working together.

---

## Production incident walkthrough
## 11. Incident: Two workers update the same invoice

Imagine a billing system processes millions of invoices every day.

A distributed lock ensures that only one worker should process a given invoice at a time.

### 09:00:00 — Worker A acquires the lock

Worker A receives a lease for invoice `INV-42`.

It starts calculating the invoice and receives fencing token 81.

### 09:00:10 — Worker A pauses

The process experiences a long runtime pause.

Its lease expires because it cannot renew it.

### 09:00:15 — Worker B acquires the lock

Worker B receives token 82.

It calculates the invoice and writes the latest result.

The storage system records token 82.

### 09:00:30 — Worker A resumes

Worker A completes its old calculation.

It attempts to write the result using token 81.

### Without fencing

The storage system accepts the write because it doesn't know that worker A is stale.

The old invoice result overwrites worker B's newer result.

### With fencing

The storage system compares the incoming token with the highest accepted token.

```text
Stored token:   82
Incoming token: 81

81 < 82

Result: REJECT
```

Worker A's stale write is rejected.

The application can stop that attempt and record the stale-write rejection for diagnosis.

### What should the system monitor?

Useful signals include:

- Lease acquisition and expiration counts.
- Lease-renewal failures.
- Fencing-token rejection counts.
- Job retries and duplicate attempts.
- Stale-write errors.
- Time spent in long-running operations.
- Worker pauses and resource saturation.

A rising count of fencing rejections can reveal slow workers, excessive pauses, coordination problems, or workloads that frequently outlive their leases.

Not every rejection indicates a bug: some are the expected result of safe recovery. The important point is to measure and understand them.

---

## The mental model to retain

```text
        Worker A acquires lease
                 |
                 v
          Token = 41
                 |
                 v
             A pauses
                 |
                 v
            Lease expires
                 |
                 v
        Worker B acquires lease
                 |
                 v
          Token = 42
                 |
                 v
          B writes successfully
                 |
                 v
       Storage records token 42
                 |
                 v
        A resumes and writes
                 |
                 v
        Token 41 is rejected
```

The essential idea is:

> **A distributed lock coordinates ownership, but fencing makes stale ownership detectable at the resource that must remain correct.**

If a system depends on exclusive ownership to protect shared state, ask not only whether a worker acquired a lock, but also how the resource rejects writes from an obsolete owner.

That is the difference between coordinating workers and protecting data correctness.

---

## Active recall — today's questions

Try to answer these without looking back at the lesson.

1. Why can a worker continue modifying shared state after its distributed lock lease has expired?

2. What makes a fencing token different from a random UUID or a lease expiration timestamp?

3. Why must the protected storage system enforce fencing tokens atomically instead of trusting a client-side ownership check?

4. What limitation remains if a stale write arrives before the storage system has observed the newer owner's token?

5. You're building a distributed invoice-processing system. How would you combine fencing tokens, idempotency, and durable workflow state to protect against stale writes and duplicate external effects?

---
