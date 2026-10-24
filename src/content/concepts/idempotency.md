---
title: "Idempotency"
slug: "idempotency"
domain: "backend"
layer: "api-correctness"
layerName: "API correctness"
summary: "Retrying a request without accidentally repeating its side effects."
difficulty: 3
status: "published"
resources:
  - type: "docs"
    title: "Stripe: Idempotent requests"
    url: "https://docs.stripe.com/api/idempotent_requests"
    free: true
  - type: "article"
    title: "AWS Builders' Library: Retries and backoff"
    url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
    free: true
---

## Idempotency: How to Retry a Failed Request Without Doing the Work Twice

**Today's central idea:** In a distributed system, a request can succeed even when the client believes it failed. Idempotency lets us retry the same logical operation without accidentally repeating its side effects.

This connects directly to yesterday's concept, the **lost update problem**, but solves a different kind of failure.

### 🧪 First, try the interactive experiment

I built a small simulator for today's concept. You can change the server's strategy, choose whether to reuse an idempotency key, and simulate a lost response.

Try the scenario where the payment succeeds but the response gets lost. Compare what happens with and without an idempotency key.

---

## 1. What is idempotency?

An operation is idempotent when repeating it produces the same intended effect as performing it once.

In mathematics, a function \(f\) is idempotent if:

\[
f(f(x)) = f(x)
\]

Consider setting a user's theme to dark mode.

```http
PUT /users/42/preferences
Content-Type: application/json

{
  "theme": "dark"
}
```

Sending this request once:

```text
Theme = light
    ↓
Set theme to dark
    ↓
Theme = dark
```

Sending it five times:

```text
Set theme to dark
Set theme to dark
Set theme to dark
Set theme to dark
Set theme to dark
```

The final state remains:

```text
Theme = dark
```

Now consider a different operation:

```http
POST /payments
```

Suppose it charges a customer ₹1,000.

```text
First request  → Charge ₹1,000
Second request → Charge ₹1,000 again
Third request  → Charge ₹1,000 again
```

Unless the payment API has additional safeguards, the customer could be charged ₹3,000.

**The important distinction:** Idempotency concerns the effect of an operation, not necessarily identical HTTP responses. An idempotent request can return different status codes on subsequent attempts while leaving the intended system state unchanged.

---

## 2. What problem exists without it?

Imagine you're building a payment service.

Your backend receives a request and calls a payment provider:

```ts
await paymentProvider.charge({
  customerId: "customer_123",
  amount: 1000
});
```

The payment succeeds.

But something unexpected happens.

The network connection breaks before the response reaches your backend.

What does your backend know?

```text
Payment provider: Payment succeeded.
Your backend:     No response received.
```

Your backend cannot automatically conclude that the payment failed.

It only knows that it did not receive the expected response.

A retry might therefore create a second charge.

This is a fundamental problem in distributed systems: **the caller can be uncertain about the outcome of an operation even when the operation itself has completed.**

---

## 3. Why does this happen? First-principles reasoning

A request and its response are two separate journeys.

```text
CLIENT                 SERVER                 DATABASE
  │                       │                       │
  │──── Create payment ──►│                       │
  │                       │──── Record payment ──►│
  │                       │◄──── Commit ──────────│
  │                       │                       │
  │                       X  Response lost        │
  │                                               │
  │ Timeout                                        │
  │                                               │
  │ "Did it work?"                                 │
```

The database has committed the payment record, but the client has received no confirmation.

From the client's perspective, two situations look similar:

**Situation A: The request never completed.**

```text
Request sent
    ↓
Server unavailable
    ↓
No payment
    ↓
Client times out
```

**Situation B: The request completed, but the response was lost.**

```text
Request sent
    ↓
Server processes payment
    ↓
Payment committed
    ↓
Response lost
    ↓
Client times out
```

The client sees a timeout in both cases.

But the correct recovery action differs:

- Situation A: retry the operation.
- Situation B: recover the original result without creating another payment.

Without additional information or a protocol, the client cannot distinguish these outcomes merely from the timeout.

This is why retry logic is not just a networking concern. It is also a **business-correctness concern**.

---

## 4. Why do we need idempotency?

Retries are useful.

Networks fail. Services restart. Requests time out. Temporary overload occurs.

If every transient failure forced a human to investigate manually, reliable software would be difficult to build.

The obvious solution is to retry.

But retries introduce another problem:

```text
Transient failure
       ↓
Retry request
       ↓
Original operation may have succeeded
       ↓
Duplicate side effect
```

Idempotency allows us to retain the benefits of retries without blindly repeating the underlying business operation.

This is a pattern used in production API design. The  Web Services","cloud computing company"] Builders' Library discusses how idempotent APIs make retries safer, while  infrastructure company"] documents idempotency keys for preventing duplicate operations. 

---

## 5. When is it actually needed?

Think about operations that create side effects.

| Operation | Potential failure without idempotency |
|---|---|
| Payment | Customer charged twice |
| Order creation | Duplicate orders |
| Refund | Multiple refunds for one intended request |
| Cloud provisioning | Duplicate virtual machines or resources |
| Email delivery | Duplicate emails |
| Job processing | Same job's effect applied repeatedly |
| Webhook processing | Event handled multiple times |
| Subscription creation | Duplicate subscriptions |

It is especially valuable when:

1. Requests can be retried automatically.
2. A response can be lost after the operation succeeds.
3. The operation creates a side effect.
4. The caller cannot reliably determine whether the original operation completed.

Not every endpoint needs a custom idempotency-key mechanism. Some operations are naturally idempotent, and others can use conditional writes, unique constraints, or deterministic resource identifiers.

The objective is to preserve correctness, not to add a new mechanism everywhere.

---

## 6. How does an idempotency key work internally?

An **idempotency key** is an identifier for one logical operation.

For example:

```http
POST /payments
Idempotency-Key: pay_7f3a9c21
Content-Type: application/json

{
  "customerId": "customer_123",
  "amount": 1000,
  "currency": "INR"
}
```

If the client retries this same payment, it reuses the same key.

```http
POST /payments
Idempotency-Key: pay_7f3a9c21
Content-Type: application/json

{
  "customerId": "customer_123",
  "amount": 1000,
  "currency": "INR"
}
```

The server can now recognize that the incoming request may be a retry of an existing operation.

### Step 1: Store the operation's identity

A simplified idempotency table might look like this:

| Key | Request hash | Status | Result |
|---|---|---|---|
| `pay_7f3a9c21` | `abc123` | Completed | Payment `p_501` |

The request hash represents the relevant request parameters. It helps detect accidental reuse of the same key for a different operation.

### Step 2: Process the first request

```text
Receive key: pay_7f3a9c21
       ↓
Key not found
       ↓
Reserve key
       ↓
Perform payment operation
       ↓
Store result
       ↓
Return success
```

### Step 3: Handle the retry

```text
Receive key: pay_7f3a9c21
       ↓
Key already exists
       ↓
Is this the same intended request?
       │
       ├── Yes: return/recover original result
       │
       └── No: reject the conflicting request
```

The server does not simply execute the same business operation again.

It recognizes the repeated request and uses the existing operation's state.

### The complete flow

```text
                  CLIENT
                     │
                     ▼
              POST /payments
              Idempotency-Key
                     │
                     ▼
              IDEMPOTENCY STORE
                     │
             ┌───────┴────────┐
             │                │
          Key new          Key exists
             │                │
             ▼                ▼
        Process once      Check request
             │                │
             ▼                ▼
        Store result      Recover result
             │                │
             └───────┬────────┘
                     ▼
               Return result
```

**Important implementation detail:** The reservation of the key must itself be concurrency-safe. Two identical requests arriving simultaneously must not both observe that the key is absent and independently process the payment.

A common solution is a database uniqueness constraint on the idempotency key within its intended scope, combined with transactional processing and explicit handling of in-progress operations.

---

## 7. How does this solve the production failure?

Return to our payment example.

The customer wants to pay ₹1,000.

The client generates one key:

```text
pay_7f3a9c21
```

The sequence is:

```text
1. Client sends request with key K.
2. Server processes the payment.
3. Payment succeeds.
4. Server records the operation's result.
5. Response gets lost.
6. Client retries using key K.
7. Server recognizes key K.
8. Server returns or recovers the original result.
9. No second payment is created.
```

The key connects multiple network attempts to one logical business operation.

```text
Attempt 1 ──┐
            ├── Idempotency key K ──► One logical payment
Attempt 2 ──┤
            │
Attempt 3 ──┘
```

The distinction is between a **request attempt** and a **logical operation**.

There may be three attempts but only one intended payment.

### What about a request that fails before processing?

If the original request never initiated the operation, the retry can perform it normally.

The server's idempotency implementation must distinguish this case from an operation that completed but whose response was lost.

Exact behavior depends on the API's contract. For example, Stripe's documented API behavior distinguishes requests that never begin endpoint execution from requests whose execution has started. 

---

## 8. Trade-offs, edge cases, and alternatives

Idempotency is not a magic guarantee of exactly-once execution.

It is a mechanism for recognizing repeated attempts at the same logical operation and preventing duplicate effects within a defined scope.

Several details matter.

### A. Never generate a fresh key for every retry

Incorrect:

```text
Attempt 1 → key_A
Attempt 2 → key_B
Attempt 3 → key_C
```

The server may treat all three attempts as new operations.

Correct:

```text
Attempt 1 → key_A
Attempt 2 → key_A
Attempt 3 → key_A
```

The key must remain stable across retries of the same intent.

A genuinely new payment should receive a new key.

### B. The same key must not silently mean two different things

Suppose the first request asks for ₹1,000:

```json
{
  "amount": 1000
}
```

Then the retry uses the same key but asks for ₹5,000:

```json
{
  "amount": 5000
}
```

That is not a legitimate retry of the same operation.

The server should reject the conflicting parameters rather than silently interpreting them as equivalent.

### C. The idempotency record must survive relevant failures

Consider this sequence:

```text
1. Charge customer.
2. Crash before recording idempotency result.
3. Receive retry.
4. Charge customer again.
```

The duplicate has returned because the business side effect and idempotency record were not coordinated correctly.

When both can be managed in the same database, a transaction can often make the business change and the idempotency record atomic.

When the side effect occurs in an external system, the problem becomes more complex. You may need the external provider's idempotency mechanism, a durable workflow, or reconciliation.

### D. Idempotency records need a retention policy

Keeping every key forever consumes storage.

Deleting keys too early can make a delayed retry look like a new operation.

The retention window must therefore match the system's retry behavior and business requirements. Once a key expires, the original protection may no longer apply.

### E. Idempotency does not solve every concurrency problem

Yesterday's lost update problem occurs when concurrent operations overwrite each other's changes.

Today's concept deals with repeated attempts at the same logical operation.

| Problem | Typical solution |
|---|---|
| Two updates overwrite each other | Atomic SQL, locking, optimistic concurrency |
| One request is accidentally executed twice | Idempotency and deduplication |
| Two different requests race for the last item | Conditional atomic update or appropriate concurrency control |
| A database update succeeds but publishing an event fails | Transactional outbox or another reliable coordination pattern |

These mechanisms complement each other.

An idempotency key does not stop two different customers from attempting to buy the same final item. You still need inventory concurrency control.

Likewise, an atomic inventory update does not prevent a payment provider from charging twice after a retry.

---

## 9. Production incident: The payment that happened twice

Imagine an e-commerce backend using a payment provider.

At 14:32, a customer clicks **Pay**.

```text
Customer
   │
   ▼
Payment API
   │
   ▼
Payment provider
   │
   ├── Charge succeeds
   │
   └── Response is lost
```

The backend times out and retries the request.

Because the payment operation has no effective idempotency protection, the provider creates another charge.

```text
Attempt 1 → Charge ₹1,000
Attempt 2 → Charge ₹1,000
```

The customer sees one order but two charges.

Support tickets increase. Engineers investigate application logs and discover that the first provider request succeeded even though the application recorded a timeout.

### What went wrong?

The retry policy assumed:

```text
No response = operation failed
```

But the correct interpretation was:

```text
No response = outcome unknown
```

### What should the system do?

1. Assign a stable identifier to the logical payment operation.
2. Reuse that identifier on every retry.
3. Use the provider's idempotency support where available.
4. Persist the local operation state so that application restarts do not lose it.
5. Reconcile ambiguous outcomes instead of blindly issuing a new payment.

The core lesson is that **timeouts describe what the caller observed, not necessarily what the remote system did**.

---

## Connection to adjacent concepts
Yesterday, we studied the **lost update problem**.

Today, we studied **idempotency**.

Both are concerned with correctness when operations overlap or repeat, but their failure mechanisms differ.

```text
                 PRODUCTION CORRECTNESS
                          │
             ┌────────────┴────────────┐
             │                         │
       CONCURRENT WORK             RETRIES
             │                         │
             ▼                         ▼
       Lost update               Duplicate effect
             │                         │
             ▼                         ▼
      Atomic updates             Idempotency keys
      Row locks                  Deduplication
      Optimistic control         Durable operation state
```

Keep this distinction in mind:

- **Concurrency control** asks: How do we prevent competing operations from corrupting shared state?
- **Idempotency** asks: How do we prevent repeated attempts at one logical operation from repeating its side effects?

Production systems often need both.

---

## Active recall: Answer before looking anything up

1. A payment provider processes a charge, but the HTTP response is lost. Why is retrying without additional safeguards dangerous?

2. Why must a client reuse the same idempotency key across retries of one logical operation?

3. Two identical requests arrive simultaneously with the same new idempotency key. Why is checking the key and then inserting it without concurrency control unsafe?

4. What can go wrong if the payment succeeds but the idempotency record is not durably saved?

5. How is idempotency different from the atomic SQL update we used to solve the lost update problem?
