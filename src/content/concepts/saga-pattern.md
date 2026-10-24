---
title: "Saga pattern"
slug: "saga-pattern"
domain: "backend"
layer: "distributed-transactions"
layerName: "Distributed transactions"
summary: "Coordinate a multi-service transaction with compensations instead of one global lock."
difficulty: 4
status: "published"
resources:
  - type: "article"
    title: "AWS: Saga orchestration pattern"
    url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html"
    free: true
---

## The Saga Pattern: How to Coordinate Transactions Across Multiple Services

**Date:** October 12, 2026  
**Today's domain:** Distributed systems, microservices, fault recovery.

Today, we're building on yesterday's transactional outbox lesson.

Imagine an e-commerce application that must reserve inventory, charge a customer, and arrange shipping. Each operation belongs to a different service, with its own database.

What happens if the payment succeeds but shipping fails?

You cannot simply roll back the payment database, inventory database, and order database with one ordinary SQL `ROLLBACK`.

The **Saga Pattern** provides a way to coordinate this kind of distributed business workflow using local transactions, retries, and compensating transactions. 

## The problem that motivates a Saga
## 1. What is a Saga?

A **Saga** is a sequence of local transactions that collectively implement a business workflow.

Each service commits its own transaction. The workflow then advances to the next step. If a later step cannot complete, the system can retry, recover, or execute compensating transactions for earlier steps.

Consider an online purchase:

```text
Customer places order
         |
         v
  Create pending order
         |
         v
  Reserve inventory
         |
         v
   Charge customer
         |
         v
   Arrange shipping
         |
         v
    Confirm order
```

Suppose each step uses a different service:

| Step | Service | Example database change |
|---|---|---|
| 1 | Order Service | Create pending order |
| 2 | Inventory Service | Reserve one item |
| 3 | Payment Service | Record a successful charge |
| 4 | Shipping Service | Create a shipment |
| 5 | Order Service | Mark order confirmed |

Each service controls its own database.

The challenge is to make the *whole business process* reach an acceptable outcome despite failures along the way.

---

## 2. Why can't we use one ordinary database transaction?

Within a single database, a transaction can provide atomicity:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 100
WHERE id = 1;

UPDATE accounts
SET balance = balance + 100
WHERE id = 2;

COMMIT;
```

If the transaction fails before committing, the database can roll back both changes.

But a microservices architecture might look like this:

```text
Order Service       Inventory Service       Payment Service
     |                      |                      |
     v                      v                      v
 Order DB               Inventory DB           Payment DB
```

These are separate transactional boundaries.

An ordinary transaction in the Order Service cannot simply roll back a committed transaction in the Inventory Service.

And the Payment Service may already have charged an external payment provider.

This creates a new problem:

**How do we coordinate a business operation when no single local transaction controls every participating system?**

Traditional distributed transactions, such as two-phase commit, are possible in some architectures, but they introduce coordination requirements and are not always supported or desirable across independent services. The Saga Pattern is one alternative. 

---

## Understand the failure from first principles
## 3. What happens without a Saga?

Imagine the application performs each operation directly:

```ts
await createOrder();
await reserveInventory();
await chargeCustomer();
await createShipment();
```

Now suppose the first three operations succeed, but shipment creation fails.

```text
Create order       ✓
Reserve inventory  ✓
Charge customer    ✓
Create shipment    ✗
```

The system has reached a partially completed state.

The customer has been charged, inventory is reserved, and the order exists—but there is no shipment.

A naive implementation might return an error and stop.

That doesn't reverse the earlier effects.

```text
       PARTIAL FAILURE

Order created
     |
     v
Inventory reserved
     |
     v
Payment charged
     |
     v
Shipping fails
     |
     v
????????????????????
```

The fundamental problem is that **a failure in a later step does not automatically undo successful operations in earlier services**.

Each service has already committed its local transaction.

A Saga makes the recovery logic an explicit part of the workflow.

---

## How compensating transactions work
## 4. Compensation is not the same as database rollback

Suppose a customer has been charged ₹1,000.

A later workflow step fails.

You cannot erase the original payment transaction as if it never happened. The payment provider may have recorded it, and external systems may already know about it.

Instead, you perform a new business operation that compensates for the earlier one.

For example:

| Original operation | Possible compensation |
|---|---|
| Reserve inventory | Release the reservation |
| Charge customer | Issue a refund |
| Create pending order | Cancel the order |
| Book a shipment | Cancel the shipment, if permitted |

A compensation is a **new transaction that attempts to restore an acceptable business outcome**.

It is not necessarily a perfect reversal of history.

For example, a refund may take time to settle. A shipment may already have left the warehouse. An email cannot be unsent.

Therefore, compensations must reflect the real business rules.

### Visualize the workflow

```text
FORWARD EXECUTION
─────────────────────────────────────────

Create order
     |
     v
Reserve inventory
     |
     v
Charge customer
     |
     v
Shipping fails
     |
     v
COMPENSATION
─────────────────────────────────────────

Refund payment
     |
     v
Release inventory
     |
     v
Cancel order
```

The exact order of compensation depends on the dependencies and business rules.

For example, you might need to cancel a shipment before refunding a payment. The system must define what is safe in each state.

AWS's Saga guidance describes this approach as a sequence of local transactions with compensating transactions when earlier work must be counteracted. 

---

## 5. Try the interactive Saga Lab

I've built a small simulator for this concept.

Experiment with these scenarios:

1. Payment fails after inventory is reserved.
2. Shipping fails after payment succeeds.
3. Every step succeeds.

Then switch between **Orchestration** and **Choreography** to see how the workflow coordination model changes.

---

## How a Saga works internally
There are two major coordination styles.

## 6. Saga orchestration: A coordinator manages the workflow

In orchestration, a central component called the **Saga orchestrator** tracks the workflow state and decides what happens next.

For example:

```text
                 Saga Orchestrator
                  /      |       \
                 /       |        \
                v        v         v
          Order Service  Inventory  Payment
```

A simplified workflow might be:

```text
1. Create order
2. Reserve inventory
3. Charge payment
4. Create shipment
5. Confirm order
```

The orchestrator sends commands to the participating services and receives their results.

If payment fails, it decides whether to retry, reject the order, or initiate compensation.

If shipping fails after payment succeeds, it can initiate a refund and release the inventory reservation.

### Why this helps

The workflow logic is explicit.

An engineer can inspect the orchestrator's state and answer:

- Which step has completed?
- Which service is currently being called?
- Has the workflow timed out?
- Which compensation must run?
- Is the Saga complete, failed, or awaiting recovery?

### The trade-off

The orchestrator introduces another component that must be operated reliably.

It can become a bottleneck or a single point of failure if poorly designed. In production, the workflow state must be durable, and recovery must work after the orchestrator restarts.

AWS describes orchestration as particularly useful when a workflow has several participants and explicit coordination logic is valuable. 

---

## 7. Saga choreography: Services react to events

In choreography, there is no central component directing every step.

Instead, services publish events, and other services react to those events.

For example:

```text
Order Service
     |
     | OrderCreated
     v
Inventory Service
     |
     | InventoryReserved
     v
Payment Service
     |
     | PaymentSucceeded
     v
Shipping Service
     |
     | ShipmentCreated
     v
Order Service
```

Each service knows how to respond to relevant events.

If payment fails, the Payment Service might publish `PaymentFailed`. The Inventory Service can react by releasing its reservation, and the Order Service can reject the order.

### Why this helps

Services can be more loosely coupled. A service publishes an event without needing to know every consumer that might react to it.

### The trade-off

As the number of participants increases, it becomes harder to understand the entire workflow.

You may have to trace events across many services to discover why an order became stuck.

AWS notes that choreography can work well with a small number of participants, while orchestration can make complex workflows easier to manage explicitly. 

### Comparison

| Property | Orchestration | Choreography |
|---|---|---|
| Workflow control | Central coordinator | Distributed event reactions |
| Visibility | Often easier to inspect centrally | Requires tracing across services |
| Coupling | Participants interact with orchestrator commands | Participants depend on event contracts |
| Complexity | Coordinator and durable workflow state | Event dependencies and distributed state |
| Best fit | Complex workflows with explicit branching | Simpler event-driven workflows |

Neither approach eliminates the need for reliable messaging, retries, idempotency, or observability.

---

## The connection to yesterday's transactional outbox
## 8. A Saga still needs reliable event publishing

Suppose the Inventory Service reserves stock and must publish:

```text
InventoryReserved
```

It performs two actions:

```text
1. Commit inventory reservation.
2. Publish InventoryReserved.
```

If the service crashes between these actions, the reservation exists but the next Saga step never receives its event.

We are back to yesterday's **dual-write problem**.

The transactional outbox can solve that local reliability problem:

```text
Inventory Service
        |
        v
Local DB transaction
   ├── Reserve inventory
   └── Insert outbox event
        |
        v
      COMMIT
        |
        v
    Outbox relay
        |
        v
   Message broker
        |
        v
  Next Saga participant
```

This gives us a useful combination:

- **Saga:** Coordinates the business workflow across services.
- **Transactional outbox:** Makes the intent to publish an event durable alongside a local database change.
- **Idempotency:** Helps ensure that retries or duplicate messages do not repeat the same logical business effect.

The patterns solve different problems and complement one another. 

---

## The subtle failure: Compensation can also fail
## 9. What if the refund fails?

Imagine this sequence:

```text
Order created             ✓
Inventory reserved        ✓
Payment charged           ✓
Shipping fails            ✗
Refund attempted          ✗
```

The Saga cannot simply declare the workflow rolled back.

The customer has been charged, but the shipment does not exist.

A robust implementation needs a durable state such as:

```text
COMPENSATION_PENDING
```

It can retry the refund, reconcile with the payment provider, and alert an operator if the workflow remains unresolved.

This is why Sagas require more than a list of reverse operations.

They need:

- Durable workflow state.
- Idempotent steps and compensations.
- Retry policies and timeouts.
- Explicit failure states.
- Reconciliation for ambiguous outcomes.
- Logs, metrics, and traces that correlate all workflow steps.

The system must be able to resume recovery after a process crash.

### A practical state machine

```text
             STARTED
                |
                v
             RUNNING
            /       \
           v         v
       COMPLETED   COMPENSATING
                       |
                ┌──────┴──────┐
                v             v
           COMPENSATED   COMPENSATION_FAILED
                              |
                              v
                       RETRY / RECONCILE
```

The names are illustrative. Your production state machine should represent the states and transitions your business actually needs.

---

## When should you use a Saga?
A Saga becomes useful when:

1. A business workflow spans multiple independent services or transactional boundaries.
2. Each service commits its own local transaction.
3. The workflow must recover from failures that occur after earlier steps have succeeded.
4. You need explicit forward recovery, compensation, or both.

Examples include:

- E-commerce orders.
- Travel booking across flights and hotels.
- Subscription provisioning across billing and infrastructure services.
- Financial workflows involving several independently managed systems.
- Cloud resource provisioning across multiple APIs.

You probably **don't** need a Saga when all relevant changes can be handled safely in one database transaction.

Adding a distributed workflow to a simple CRUD application creates complexity without necessarily providing meaningful benefits.

And a Saga is not a substitute for strong consistency where the business requires it. Sagas generally provide eventual consistency across participating services, with intermediate states that must be handled explicitly. 

---

## Production incident walkthrough
Consider a travel-booking service.

A customer books a holiday package involving:

1. A hotel reservation.
2. A flight reservation.
3. A payment.
4. A confirmation email.

The hotel and flight services each commit their own reservations.

Payment succeeds, but the flight provider returns a permanent error because no seat is available.

### Without a Saga

The application returns an error.

But the hotel room remains reserved, and the payment has already been collected.

The customer sees a failed booking while the backend contains partially completed work.

### With a Saga

The system recognizes that the flight reservation cannot complete.

It initiates recovery:

```text
Hotel reserved
      |
      v
Flight reservation fails
      |
      v
Refund payment (if already charged)
      |
      v
Cancel hotel reservation
      |
      v
Mark booking rejected
```

If the refund or hotel cancellation fails temporarily, the Saga records the incomplete compensation and retries or escalates it.

The customer should not be told that the booking is fully rolled back while an important compensation remains unresolved.

### The engineering lesson

**A distributed business operation is a workflow with failure states, not just a sequence of API calls.**

That change in perspective is the most valuable part of the Saga Pattern.

---

## The mental model to retain

```text
              DISTRIBUTED WORKFLOW
                       |
                       v
               Local transaction
                       |
                       v
                 Next step
                       |
              +--------+--------+
              |                 |
              v                 v
           Success            Failure
              |                 |
              v                 v
        Continue workflow   Retry or compensate
                                  |
                                  v
                         Durable recovery state
```

The core idea:

> **When one atomic transaction cannot cover the entire business workflow, make each local transaction explicit and design the recovery path as carefully as the success path.**

That is what separates a robust distributed system from a sequence of API calls that works only when nothing goes wrong.

---

## Active recall — today's questions

Try to answer these without looking back at the lesson.

1. Why can't an ordinary local database rollback undo a payment transaction that has already committed in another service?

2. What is the difference between a compensating transaction and a database rollback?

3. How does orchestration differ from choreography, and when might you prefer each?

4. Why does a Saga participant still need the transactional outbox pattern?

5. Suppose payment succeeds, shipping fails, and the refund also fails. What durable state and recovery mechanisms should the Saga have?

---
