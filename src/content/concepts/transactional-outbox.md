---
title: "Transactional outbox"
slug: "transactional-outbox"
domain: "backend"
layer: "messaging-queues-kafka"
layerName: "Messaging / queues / Kafka"
summary: "Commit the database write and the event to publish in one atomic step."
difficulty: 3
status: "published"
resources:
  - type: "article"
    title: "AWS: Transactional outbox pattern"
    url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
    free: true
---

## Transactional Outbox: How to Stop Losing Events When Your Service Crashes

**Today's concept:** The Transactional Outbox Pattern.

Yesterday, we studied write skew. Today, we're moving from database concurrency into distributed systems.

Imagine you're building an e-commerce backend. A customer places an order, and your service must:

1. Save the order in PostgreSQL.
2. Publish an `OrderCreated` event to a message broker.
3. Let other services react to the order.

The database and the message broker are separate systems. That creates a surprisingly difficult reliability problem.

### 🧪 First, try the interactive experiment

You'll simulate an application crash between saving an order and publishing its event. Compare the naive implementation with the outbox pattern.

---

## The problem: A database write and a message publish are not one atomic operation
## 1. What is the transactional outbox?

The **Transactional Outbox Pattern** stores a business change and the event that describes that change in the same database transaction.

A separate process then publishes the stored event to a message broker.

The pattern is designed to solve the **dual-write problem**: one business operation needs to write to two independent systems, but those writes cannot ordinarily participate in the same local database transaction. 

For example:

```text
Customer places an order
          │
          ▼
   PostgreSQL transaction
       ├── Save order
       └── Save event in outbox
          │
          ▼
        COMMIT
          │
          ▼
   Background relay
          │
          ▼
    Message broker
          │
          ▼
   Other services react
```

The key idea is simple:

> **First, durably record that an event must be published. Then publish it asynchronously.**

Let's understand why that matters.

---

## 2. What problem exists without it?

Suppose your order service uses this code:

```ts
const order = await db.order.create({
  data: {
    customerId,
    total: 1000,
  },
});

await broker.publish("OrderCreated", {
  orderId: order.id,
});
```

It looks reasonable.

First, create the order. Then publish an event.

But there is a dangerous gap between the two operations.

Consider this execution:

```text
1. Insert order into PostgreSQL
             │
             ▼
2. Database commits successfully
             │
             ▼
3. Application process crashes
             │
             X
4. Event is never published
```

The order exists in the database.

But the message broker never receives the event.

Downstream services might therefore remain unaware of the order.

For example:

- The inventory service doesn't reserve stock.
- The notification service doesn't send an order confirmation.
- The analytics service doesn't record the purchase.
- The fulfillment service doesn't begin preparing the shipment.

Your database says the order exists. The rest of your system behaves as if the order was never announced.

**This is a consistency failure between independently updated systems.**

---

## 3. Why does this happen from first principles?

Let's look at the operations involved.

```text
Operation A: Commit database transaction

Operation B: Publish broker message
```

PostgreSQL can make Operation A atomic within its transaction.

But a normal PostgreSQL transaction does not automatically include the message broker's independent state.

That means the two operations have separate success and failure conditions.

| Database write | Message publish | Result |
|---|---|---|
| Success | Success | Desired outcome |
| Success | Failure | Order exists, event missing |
| Failure | Success | Event exists, order missing |
| Failure | Failure | Neither operation succeeds |

The third row is especially dangerous: a downstream service could act on an event for an order that was never committed.

The problem isn't that either operation is inherently unreliable.

The problem is that **the application cannot atomically commit both independent operations using an ordinary local database transaction**.

### Why not just publish first?

Consider reversing the order:

```text
1. Publish OrderCreated
2. Save order in PostgreSQL
```

Now imagine the broker accepts the event, but the database transaction fails.

```text
Broker:
  OrderCreated published ✓

Database:
  Order creation rolled back ✗
```

The event has escaped into the system even though the order doesn't exist.

Reversing the order merely reverses which failure is possible.

This is the dual-write problem.

---

## How the transactional outbox works internally
## 4. Step one: Create an outbox table

An outbox is a durable table containing events that the service must publish.

For example:

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);
```

The important fields are:

| Field | Purpose |
|---|---|
| `id` | Unique event identifier |
| `aggregate_id` | Identifies the business entity, such as an order |
| `event_type` | Describes the event |
| `payload` | Contains the event data |
| `created_at` | Records when the event was created |
| `published_at` | Tracks publication progress |

This is a simplified schema. Production implementations may also use fields for delivery attempts, leases, partition keys, error details, and ordering.

The outbox isn't the message broker itself.

It's a durable record in the service's own database that says:

> This business transaction committed, and this event still needs to be delivered.

---

## 5. Step two: Write the order and event in one transaction

Instead of publishing directly from the request handler, write both the order and its event to PostgreSQL.

```sql
BEGIN;

INSERT INTO orders (
    id,
    customer_id,
    total
)
VALUES (
    'order-42',
    'customer-7',
    1000
);

INSERT INTO outbox_events (
    id,
    aggregate_id,
    event_type,
    payload
)
VALUES (
    'event-91',
    'order-42',
    'OrderCreated',
    '{"orderId":"order-42","total":1000}'
);

COMMIT;
```

The order and outbox event now share one database transaction.

Two outcomes are possible.

**If the transaction commits:**

```text
Order exists ✓
Outbox event exists ✓
```

**If the transaction rolls back:**

```text
Order exists ✗
Outbox event exists ✗
```

This removes the original gap between the business-state change and the durable recording of the intent to publish.

The database doesn't need to communicate with the broker during the transaction.

That is the essential benefit of the pattern. 

---

## 6. Step three: Publish events asynchronously

A separate process, often called an **outbox relay** or **publisher**, reads pending events and publishes them to the message broker.

```text
           PostgreSQL
                │
                ▼
          outbox_events
                │
                ▼
          Outbox relay
                │
                ▼
          Message broker
                │
        ┌───────┴────────┐
        ▼                ▼
 Inventory service   Email service
```

The relay can use either of two common approaches.

### Approach A: Polling publisher

The relay periodically queries for unpublished events.

Conceptually:

```sql
SELECT *
FROM outbox_events
WHERE published_at IS NULL
ORDER BY created_at
LIMIT 100;
```

It publishes the selected events and records progress.

**Advantages:**
- Straightforward to understand and implement.
- Works with many relational databases.
- Easy to inspect pending events with SQL.

**Trade-offs:**
- Repeated polling creates database load.
- Polling intervals introduce some delivery latency.
- Multiple relay workers require careful coordination.

The query above is illustrative, not a complete production claiming protocol. Multiple workers must avoid racing over the same rows, and the implementation needs a safe recovery strategy.

### Approach B: Change data capture (CDC)

Instead of repeatedly querying the table, a CDC system observes committed database changes and streams the relevant outbox records to the publishing pipeline.

For example, a system built around PostgreSQL and Debezium can capture changes from the database's transaction log and route outbox events to a broker such as Kafka.

**Advantages:**
- Can reduce repeated table polling.
- Can provide efficient streaming of committed changes.
- Can integrate naturally with event-driven architectures.

**Trade-offs:**
- More infrastructure and operational complexity.
- Requires attention to replication slots, log retention, offsets, and connector health.
- Delivery semantics and ordering still require careful design.

The outbox pattern supports both polling and CDC. The right choice depends on throughput, latency, and operational requirements. 

---

## How does it survive a crash?
## 7. The critical recovery scenario

Let's return to the original incident.

The order and outbox event commit successfully.

Then the application crashes before publishing the event.

With the naive approach:

```text
Order committed
     ↓
Process crashes
     ↓
Event lost
```

With the transactional outbox:

```text
Order committed
     │
     ├── Outbox event committed
     │
     ▼
Process crashes
     │
     ▼
Relay restarts
     │
     ▼
Finds pending event
     │
     ▼
Publishes event
```

The event survives because its existence is recorded durably in the database.

The relay can resume after a restart without depending on the original HTTP request still being alive.

This is one of the main reasons the pattern is useful for production systems.

---

## 8. But can the same event be published twice?

**Yes. And this is where yesterday's lesson becomes essential.**

Suppose the relay performs these operations:

```text
1. Publish event to broker.
2. Mark event as published in PostgreSQL.
```

Now imagine:

```text
Publish succeeds ✓
       │
       ▼
Relay crashes
       │
       X
Mark published never happens
```

After restarting, the relay sees an event that still appears unpublished.

It publishes the event again.

```text
First attempt  → OrderCreated
Second attempt → OrderCreated
```

The outbox solves the problem of losing the durable intent to publish. It does not automatically provide exactly-once delivery.

The pattern commonly provides **at-least-once delivery**: the system retries until delivery is acknowledged, but duplicates may occur.

The consumer must therefore be designed to handle duplicate events safely. 

### Connect this to idempotency

Yesterday:

```text
Payment request repeated
        ↓
Use idempotency key
        ↓
Avoid duplicate payment
```

Today:

```text
Message delivered repeatedly
        ↓
Use event ID + consumer deduplication
        ↓
Avoid duplicate business effect
```

A consumer might maintain a table of processed message IDs:

```sql
CREATE TABLE processed_messages (
    consumer_name TEXT NOT NULL,
    message_id UUID NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_name, message_id)
);
```

The consumer records the message ID and applies its business update in the **same local database transaction**.

If the same message arrives again, the unique constraint allows the consumer to recognize that it has already processed the event.

This is only effective when the deduplication record and the business effect are coordinated correctly. If the consumer performs an external side effect, such as charging another payment provider, that effect needs its own idempotency or recovery strategy.

---

## A production incident walkthrough
Imagine an order service handles 2,000 orders per minute.

Its original implementation looks like this:

```ts
const order = await createOrder();

await publishOrderCreated(order);
```

The message broker has a brief outage.

During that outage:

- Orders continue to commit to PostgreSQL.
- Event publication fails.
- The service logs errors.
- Downstream services stop receiving new orders.

When the broker recovers, the application has no durable record of which events still need publishing.

The engineering team attempts to reconstruct missing events from logs, but some requests lack sufficient information. Some events are republished, creating duplicates, while others are missed.

This incident has two separate failure modes:

1. **Lost events:** A committed business change has no corresponding published event.
2. **Duplicate events:** Recovery or retry logic publishes the same logical event more than once.

### What changes with the outbox?

```text
Order request
     │
     ▼
One PostgreSQL transaction
     ├── Insert order
     └── Insert outbox event
     │
     ▼
Commit
     │
     ▼
Relay publishes event
     │
     ├── Success → Record progress
     │
     └── Failure → Retry later
```

During a broker outage, pending events accumulate in the outbox instead of disappearing.

Once the broker recovers, the relay can resume publishing them.

However, the outbox introduces its own operational requirements. If the relay remains down, the pending backlog can grow and delay downstream processing.

Useful monitoring signals include:

- Number of unpublished events.
- Age of the oldest pending event.
- Publication success and failure rates.
- Retry counts.
- Relay lag.
- Outbox table growth and cleanup progress.

A production implementation must also define event ordering where it matters, handle poison events that repeatedly fail, and coordinate multiple relay workers safely.

---

## When should you use it?
Use the transactional outbox when all of the following are true:

1. Your service changes durable business state.
2. That change must produce a message or event.
3. Losing the event would create an inconsistency.
4. You cannot atomically commit the business change and message publication using a suitable existing mechanism.

Common examples include:

| System | Database change | Event to publish |
|---|---|---|
| E-commerce | Order created | `OrderCreated` |
| Banking | Transfer recorded | `TransferCompleted` |
| Subscription platform | Subscription renewed | `SubscriptionRenewed` |
| Identity system | User registered | `UserRegistered` |
| Inventory service | Stock reserved | `InventoryReserved` |

It is not necessary for every application to adopt this pattern.

For a small application with no asynchronous downstream consumers, direct database operations may be sufficient.

If your database supports CDC and you already operate a reliable change-stream pipeline, CDC may be the more natural implementation.

If the operation spans several independent services that each need their own local transaction, you may also need a **Saga** or another distributed workflow pattern. An outbox solves reliable publication from one service; it does not make an entire multi-service workflow atomic.

---

## The key trade-offs
| Property | Benefit | Cost |
|---|---|---|
| Atomic order + outbox write | No committed order without a durable event record | Requires a local transaction and additional storage |
| Asynchronous publication | Broker outages need not block every order request | Events may arrive later |
| Retryable relay | Events can be delivered after transient failures | Duplicate publications are possible |
| Polling | Simple implementation | Database polling overhead |
| CDC | Efficient change streaming | More infrastructure and operational complexity |
| Durable event history | Useful for diagnosis and recovery | Requires retention and cleanup policies |

The key engineering trade-off is that the outbox exchanges a fragile two-system write for a durable local write plus an asynchronous delivery process.

It improves reliability, but it does not eliminate every failure mode.

---

## The mental model to remember

```text
                    BUSINESS TRANSACTION
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
            Save order           Save outbox event
                 │                     │
                 └──────────┬──────────┘
                            ▼
                         COMMIT
                            │
                            ▼
                      Durable intent
                            │
                            ▼
                       Outbox relay
                            │
                            ▼
                      Message broker
                            │
                            ▼
                       Consumer
                            │
                            ▼
                 Idempotent processing
```

Three concepts now fit together:

- **Concurrency control** prevents competing transactions from corrupting shared state.
- **Idempotency** makes repeated attempts at one logical operation safe.
- **Transactional outbox** makes the intent to publish an event durable alongside a business-state change.

These are different mechanisms for different failure modes, and production systems often need all three.

---

## Active recall — today's questions

Try to answer these without looking back at the lesson.

1. Why can't a normal PostgreSQL transaction atomically commit both a database change and a message to an independent broker?

2. How does writing the business record and outbox event in the same transaction prevent the original dual-write failure?

3. Why can a transactional outbox still publish the same event more than once?

4. How should a consumer prevent duplicate message delivery from repeating its business effect?

5. What operational problems can occur if the outbox relay remains unavailable for several hours?

---
