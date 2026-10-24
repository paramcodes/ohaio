---
title: "Lost update"
slug: "lost-update"
domain: "backend"
layer: "database-concurrency"
layerName: "Database concurrency"
summary: "Two transactions read the same value, both write, and one update silently disappears."
difficulty: 3
status: "published"
resources:
  - type: "docs"
    title: "PostgreSQL: Transaction Isolation"
    url: "https://www.postgresql.org/docs/current/transaction-iso.html"
    free: true
  - type: "article"
    title: "Jepsen: Consistency Models"
    url: "https://jepsen.io/consistency/models"
    free: true
---

Today’s concept is **concurrency control at the application/data level**, specifically the **lost update**. It is deceptively simple, but it connects directly to transactions, MVCC, row locks, optimistic concurrency, distributed systems, and production race conditions.

PostgreSQL, for example, uses MVCC for concurrent access and also provides row-level locking such as `SELECT ... FOR UPDATE` when application-controlled coordination is required. 

---

## 1. What is it?

A **lost update** happens when two concurrent operations read the same old value, independently calculate a new value, and then one overwrites the other's result.

Suppose:

```text
stock = 10
```

Two customers buy one item at almost exactly the same time.

```text
Customer A                 Customer B
    │                          │
    │── read stock = 10 ──────►│
    │                          │
    │                          │── read stock = 10
    │                          │
    │── calculate 9            │
    │                          │
    │                          │── calculate 9
    │                          │
    │── write 9 ───────────────│
    │                          │
    │                          │── write 9
    │                          │
    └────────── stock = 9 ─────┘
```

But **two items were sold**.

The correct result should be:

```text
10 - 1 - 1 = 8
```

The database says:

```text
9
```

One update has effectively disappeared.

That's the **lost update**.

---

## 2. What problem exists without it?

The naive application code looks innocent:

```ts
const product = await db.product.findUnique({
  where: { id }
});

if (product.stock > 0) {
  await db.product.update({
    where: { id },
    data: {
      stock: product.stock - 1
    }
  });
}
```

With one request:

```text
read 10
   ↓
calculate 9
   ↓
write 9
```

Perfect.

With 1,000 requests:

```text
       ┌── Request A ── read 10 ── write 9
       │
DB ────┼── Request B ── read 10 ── write 9
       │
       ├── Request C ── read 10 ── write 9
       │
       └── Request D ── read 10 ── write 9
```

Now concurrency changes everything.

---

## 3. Why does this problem exist?

This is the important part.

A CPU does not magically execute your entire business operation as one indivisible action.

Your code:

```text
READ
↓
THINK
↓
WRITE
```

contains multiple operations.

The operating system, runtime, database, network, connection pool, etc. can interleave other work between them.

So:

```text
A: READ
B: READ
A: WRITE
B: WRITE
```

is perfectly possible.

The fundamental problem is:

> **The application assumed that “read → modify → write” was one operation, but the database sees multiple operations.**

This is a **race condition**.

More precisely:

```text
Correctness depends on timing
        ↓
Two operations overlap
        ↓
They observe the same state
        ↓
They make decisions independently
        ↓
One decision overwrites another
```

This is why concurrency bugs are so nasty.

The code can be completely deterministic.

The **interleaving isn't**.

---

## 4. Why do we need a concept to solve it?

Because production systems are concurrent by default.

You don't need millions of users.

Even two requests are enough:

```text
Request 1 ────────┐
                  ├── database
Request 2 ────────┘
```

And concurrency appears everywhere:

- two users editing the same document
- two purchases of the last item
- two workers processing the same job
- two payments against an account
- two processes updating a counter
- two servers refreshing the same token
- two schedulers executing the same task

So we need some mechanism that establishes:

> **Who gets to observe and modify this state, and under what conditions?**

That's the broader concept of **concurrency control**.

---

## 5. When is this actually needed?

You should start thinking about concurrency control whenever your operation is:

```text
read something
    ↓
make a decision
    ↓
modify something
```

especially when correctness depends on the value you read.

Examples:

### Inventory

```text
if stock > 0:
    stock -= 1
```

### Bank account

```text
if balance >= amount:
    balance -= amount
```

### Seat booking

```text
if seat.available:
    seat.available = false
```

### Job queue

```text
if job.status == "pending":
    job.status = "processing"
```

### Coupon

```text
if remaining_uses > 0:
    remaining_uses -= 1
```

These all contain the dangerous pattern:

```text
CHECK → DECIDE → MODIFY
```

---

## 6. How does the database solve it?

There isn't one universal solution.

There are several concurrency-control strategies.

## Strategy A — Atomic update

Instead of:

```text
READ stock
↓
calculate stock - 1
↓
WRITE stock
```

make the database perform the operation atomically:

```sql
UPDATE products
SET stock = stock - 1
WHERE id = 123
  AND stock > 0;
```

Now the database itself evaluates and modifies the row as one statement.

You can then inspect:

```text
rows affected = 1
```

meaning:

```text
success
```

or:

```text
rows affected = 0
```

meaning:

```text
out of stock
```

This is often the **best solution** for simple counters/inventory operations.

---

## 7. Strategy B — Pessimistic locking

Sometimes you need to perform multiple operations while preventing another transaction from changing the same row.

Conceptually:

```text
Transaction A
     │
     ├── lock row
     │
     ├── read
     │
     ├── perform business logic
     │
     ├── update
     │
     └── commit
              ↓
        lock released
              ↓
Transaction B continues
```

PostgreSQL supports:

```sql
SELECT *
FROM products
WHERE id = 123
FOR UPDATE;
```

`FOR UPDATE` locks the selected rows against conflicting modifications until the transaction ends. 

Then:

```sql
BEGIN;

SELECT stock
FROM products
WHERE id = 123
FOR UPDATE;

-- application decides what to do

UPDATE products
SET stock = stock - 1
WHERE id = 123;

COMMIT;
```

Now another transaction attempting a conflicting operation must wait.

---

## 8. Strategy C — Optimistic concurrency

Instead of locking first, you detect whether somebody changed the data before you commit your change.

For example:

```text
version = 7
```

Client reads:

```text
stock = 10
version = 7
```

Then attempts:

```sql
UPDATE products
SET stock = 9,
    version = 8
WHERE id = 123
  AND version = 7;
```

If someone else already modified it:

```text
version = 8
```

then:

```text
WHERE version = 7
```

matches nothing.

You detect:

```text
0 rows updated
```

and know:

> Someone changed this object while I was working on it.

Then you can retry, reject, or merge.

This is commonly called **optimistic concurrency control (OCC)**.

---

## 9. The deeper connection: MVCC

Here's where this becomes much more interesting.

Modern databases don't necessarily solve concurrency by making every reader wait for every writer.

PostgreSQL uses **MVCC — Multi-Version Concurrency Control**.

The basic idea is:

```text
Instead of:

ONE ROW
   ↓
everyone fights over it

think:

ROW
├── version 1
├── version 2
└── version 3
```

Transactions can see appropriate versions according to their isolation rules.

This allows high concurrency without turning the entire database into:

```text
LOCK
  ↓
WAIT
  ↓
READ
  ↓
UNLOCK
```

PostgreSQL explicitly uses MVCC and also provides explicit locking where MVCC alone isn't enough. 

But here's the subtle point:

> **MVCC does not automatically make your business operation race-free.**

Your application can still have:

```text
read
↓
business decision
↓
write
```

that is logically unsafe.

That's why database concurrency is much deeper than “use transactions.”

---

## 10. The production failure

Imagine an e-commerce site.

Database:

```text
Product: RTX 5090
Stock: 1
```

At 10:00:00.001:

```text
User A → Buy
User B → Buy
```

Both requests execute:

```text
SELECT stock
```

Both receive:

```text
1
```

Both conclude:

```text
I can purchase this.
```

Both attempt:

```text
stock = 0
```

Now you have:

```text
Database:
stock = 0

Orders:
A = confirmed
B = confirmed
```

But:

```text
physical inventory = 1
```

You sold:

```text
2
```

You own:

```text
1
```

Congratulations.

You've invented an **overselling bug**.

And this is why these bugs are often invisible during development.

Your developer laptop:

```text
1 request
↓
works
```

Production:

```text
500 requests/sec
↓
concurrent execution
↓
race
↓
incorrect state
```

---

## 11. Trade-offs

There is no universally superior strategy.

| Technique | Strength | Cost |
|---|---|---|
| Atomic SQL update | Simple, fast | Limited for complex workflows |
| Row lock | Strong coordination | Waiting, contention |
| Optimistic concurrency | Great under low contention | Retries/conflicts |
| Serializable isolation | Strong correctness | Potential aborts/retries, lower throughput |
| Distributed lock | Coordinates across processes/services | Failure complexity |
| Queue/actor model | Serializes work naturally | Adds latency/architecture |
| Idempotency | Prevents duplicate effects | Requires careful design |

The engineering skill is choosing the **minimum coordination necessary to preserve the invariant**.

That's a much better mental model than:

> “Whenever there's concurrency, use a lock.”

---

## 12. The key mental model

Remember this:

```text
                    CONCURRENT SYSTEM
                           │
                           ▼
                Multiple operations overlap
                           │
                           ▼
                  Shared mutable state
                           │
                           ▼
                Race conditions possible
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Atomic SQL     Locking       OCC
              │            │            │
              ▼            ▼            ▼
         one operation   serialize    detect conflict
```

And the deeper principle:

> **Concurrency control exists because time creates interleavings, and interleavings can violate invariants.**

That's the sentence worth remembering.

---

## Active recall — don't look anything up yet

1. **Why can `read → modify → write` produce a lost update even though every individual database operation is correct?**

2. **For an inventory counter, why might `UPDATE ... SET stock = stock - 1 WHERE stock > 0` be preferable to reading the stock into application memory first?**

3. **What is the fundamental difference between pessimistic locking and optimistic concurrency control?**

4. **Why doesn't PostgreSQL's MVCC automatically guarantee that a multi-step business operation is race-free?**

5. **Suppose two requests try to reserve the last seat simultaneously. What invariant must your database operation preserve, and what concurrency-control strategy would you choose?**
