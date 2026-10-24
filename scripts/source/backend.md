Yes. What you are describing is essentially the **“production engineering vocabulary”** of software: things you usually encounter when a system is under load, partially failing, inconsistent, slow, leaking resources, or behaving differently from what the happy-path code suggests.

I did a broad pass over current material from Google SRE, AWS Builders’ Library, PostgreSQL 18, Kubernetes 1.35-era docs, OpenTelemetry, Vercel, Uber’s 2026 infrastructure work, vLLM, RocksDB, Jepsen, gRPC, SLSA, etc. The interesting finding is that many of these concepts are explicitly documented by large engineering organizations, but they are rarely taught together in ordinary “learn backend” tutorials. citeturn107167search0turn953547search0turn788704search0turn788704search1

# The map

```text
                         ┌─────────────────────┐
                         │       CLIENT        │
                         └──────────┬──────────┘
                                    │
                           DNS / TLS / TCP
                                    │
                     ┌──────────────▼──────────────┐
                     │       CDN / LB / Proxy      │
                     └──────────────┬──────────────┘
                                    │
                         HTTP / RPC / WebSocket
                                    │
                     ┌──────────────▼──────────────┐
                     │        APPLICATION          │
                     │                             │
                     │ queues / threads / eventloop│
                     │ caches / connection pools   │
                     │ timeouts / retries          │
                     └───────┬──────────┬──────────┘
                             │          │
                    ┌────────▼───┐   ┌──▼─────────┐
                    │   CACHE    │   │   QUEUE    │
                    └────────┬───┘   └────┬───────┘
                             │            │
                             └──────┬─────┘
                                    │
                           ┌────────▼────────┐
                           │     DATABASE    │
                           │ MVCC / WAL /    │
                           │ locks / indexes │
                           │ replication     │
                           └────────┬────────┘
                                    │
                           ┌────────▼────────┐
                           │ STORAGE / OS /  │
                           │ NETWORK / CPU   │
                           └─────────────────┘


 FAILURE AMPLIFICATION

 timeout
    ↓
 retry
    ↓
 retry storm ─────┐
    ↓             │
 queue buildup    │
    ↓             │
 connection pool exhaustion
    ↓             │
 database overload
    ↓             │
 latency ↑
    ↓             │
 more timeouts ───┘
    ↓
 cascading failure
```

The important idea is that **the interesting bugs live at the boundaries between these boxes**.

---

# 1. Production failure / overload

These are extremely valuable:

`Partial failure`  
`Gray failure`  
`Fail-slow`  
`Cascading failure`  
`Cascading overload`  
`Overload collapse`  
`Positive feedback failure`  
`Retry storm`  
`Retry amplification`  
`Retry budget`  
`Retry quota`  
`Retry throttling`  
`Thundering herd`  
`Cache stampede`  
`Request stampede`  
`Dogpile effect`  
`Queue buildup`  
`Queue explosion`  
`Insurmountable backlog`  
`Resource exhaustion`  
`Resource coupling`  
`Dependency overload`  
`Dependency failure amplification`  
`Deadline propagation`  
`Deadline miss`  
`Cancellation propagation`  
`Fail-fast`  
`Bounded work`  
`Load shedding`  
`Graceful degradation`  
`Brownout`  
`Admission control`  
`Concurrency limiting`  
`Adaptive concurrency control`  
`Backpressure`  
`Pushback`  
`Circuit breaker`  
`Bulkhead isolation`  
`Dependency isolation`  
`Failure containment`  
`Fault containment`  
`Blast-radius reduction`  
`Static stability`  
`Cell-based architecture`  
`Shuffle sharding`  
`Failure domains`  
`Fault domains`  
`Lame duck state`  
`Health-check feedback loop`  
`Health-check-induced outage`  
`Herding`  
`Retry synchronization`  
`Retry ripple`  
`Load imbalance`  
`Noisy neighbor`  
`Fairness isolation`  
`Priority inversion in queues`  
`Work conservation`  
`Controlled delay (CoDel)`  
`Active queue management (AQM)`  
`Tail drop`  
`Random Early Detection (RED)`  
`Token bucket`  
`Leaky bucket`  
`Concurrency budget`  
`Inflight request cap`  
`Load-aware routing`  
`Outlier detection`  
`Endpoint ejection`  
`Hedged requests`  
`Request racing`  
`Speculative requests`  
`Server pushback`

AWS specifically describes overload chains involving CPU, memory, threads, file descriptors, retries, queueing, missed RPC deadlines and cache effects; modern Uber work goes further into CoDel, priority-aware shedding, per-tenant concurrency and dynamically tuned load management. citeturn107167search0turn953547search0turn788704search0

---

# 2. Latency — where backend engineering gets serious

`Latency distribution`  
`Tail latency`  
`P50 / P90 / P95 / P99 / P99.9`  
`Long-tail latency`  
`Tail at Scale`  
`Latency amplification`  
`Coordinated omission`  
`Queueing delay`  
`Service time`  
`Wait time`  
`Response-time decomposition`  
`Critical-path latency`  
`Fan-out latency`  
`Head-of-line blocking`  
`Queueing collapse`  
`Latency SLO`  
`Latency budget`  
`Deadline budget`  
`Latency attribution`  
`Tail-aware load balancing`  
`Latency-aware routing`  
`Hedging`  
`Speculative execution`  
`Request cancellation`  
`Admission latency`  
`Cold-start latency`  
`Cache-warm latency`  
`Connection-establishment latency`  
`DNS latency`  
`TLS handshake latency`  
`TTFB`  
`TTFT`  
`TPOT`  
`Inter-token latency`

A major production mistake is looking only at **average latency**. Prometheus explicitly distinguishes distributions and histogram-based analysis, while AWS emphasizes percentiles and end-to-end tracing. citeturn859872search6turn953547search0

---

# 3. Networking / TCP / HTTP internals

This is one of the biggest “tutorial gap” areas.

`TIME_WAIT`  
`CLOSE_WAIT`  
`FIN_WAIT_1`  
`FIN_WAIT_2`  
`LAST_ACK`  
`SYN_SENT`  
`SYN_RECV`  
`SYN backlog`  
`Accept queue`  
`Listen backlog`  
`Ephemeral port exhaustion`  
`SNAT port exhaustion`  
`NAT table exhaustion`  
`Conntrack exhaustion`  
`Connection churn`  
`Connection pooling`  
`Keep-alive`  
`Idle connection timeout`  
`Half-open connection`  
`Half-close`  
`TCP retransmission`  
`Retransmission timeout (RTO)`  
`Round-trip time (RTT)`  
`RTT variance`  
`TCP congestion window`  
`TCP receive window`  
`Slow start`  
`Congestion avoidance`  
`Fast retransmit`  
`Fast recovery`  
`Packet reordering`  
`Packet loss`  
`Packet duplication`  
`Packet corruption`  
`Jitter`  
`MTU`  
`Path MTU Discovery`  
`PMTUD black hole`  
`Fragmentation`  
`Asymmetric routing`  
`BGP convergence`  
`Anycast`  
`Route flapping`  
`DNS TTL`  
`DNS negative caching`  
`DNS cache poisoning`  
`Stale DNS`  
`Split-horizon DNS`  
`DNS propagation myth`  
`TLS session resumption`  
`TLS ticket`  
`0-RTT`  
`ALPN`  
`SNI`  
`OCSP stapling`  
`HTTP keep-alive`  
`HTTP connection coalescing`  
`HTTP/2 multiplexing`  
`HTTP/2 stream starvation`  
`HTTP/2 head-of-line blocking`  
`HTTP/3`  
`QUIC stream independence`  
`Flow control`  
`TCP backpressure`  
`Receive-buffer pressure`  
`Socket buffer exhaustion`  
`Zero-copy networking`  
`Kernel bypass`  
`DPDK`  
`io_uring`  
`epoll`  
`kqueue`  
`SO_REUSEPORT`  
`accept mutex`  
`Nagle's algorithm`  
`TCP_NODELAY`  
`Delayed ACK`  
`Silly window syndrome`  
`Bufferbloat`

Linux exposes real TCP states and even special handling such as `TIME_WAIT` reuse; these are exactly the sorts of things that suddenly matter when connection churn or port exhaustion appears in production. citeturn192231search2

---

# 4. Connection pools

This deserves its own category because it causes ridiculous numbers of incidents.

`Connection pool exhaustion`  
`Pool starvation`  
`Pool queueing`  
`Pool timeout`  
`Pool leakage`  
`Idle connection leakage`  
`Connection churn`  
`Pool oversubscription`  
`Pool undersubscription`  
`Pool fragmentation`  
`Connection lifetime`  
`Max connection lifetime`  
`Idle connection timeout`  
`Connection recycling`  
`Stale connection`  
`Half-dead connection`  
`Broken keep-alive connection`  
`Connection validation`  
`Pool warm-up`  
`Pool stampede`  
`Database connection storm`  
`Connection multiplier effect`  
`Serverless connection leakage`

Vercel's 2025/2026 write-ups are particularly interesting here: suspended serverless instances can leave idle DB connections alive because application timers don't execute while the instance is suspended, and deployments can correlate the leak across many instances. citeturn788704search2turn788704search4

---

# 5. Database concurrency

`MVCC`  
`Snapshot isolation`  
`Serializable isolation`  
`Strict serializability`  
`Linearizability`  
`Read committed`  
`Repeatable read`  
`Read uncommitted`  
`Write skew`  
`Lost update`  
`Dirty read`  
`Non-repeatable read`  
`Phantom read`  
`Predicate locking`  
`Serializable Snapshot Isolation (SSI)`  
`Optimistic concurrency control`  
`Pessimistic concurrency control`  
`Compare-and-swap update`  
`Optimistic locking`  
`Row-version locking`  
`Lock contention`  
`Lock convoy`  
`Lock escalation`  
`Deadlock`  
`Deadlock detection`  
`Deadlock victim`  
`Starvation`  
`Livelock`  
`Long-running transaction`  
`Transaction age`  
`Transaction ID wraparound`  
`Snapshot too old`  
`Transaction serialization failure`  
`Commit ordering`  
`Commit timestamp`  
`Group commit`  
`Two-phase commit`  
`Three-phase commit`

Jepsen's current consistency reference shows how these models actually relate: strict serializability → serializability / linearizability → weaker consistency models, and snapshot isolation permits anomalies such as write skew. citeturn957646search0turn957646search3turn957646search4

---

# 6. PostgreSQL internals

Since you're working with PostgreSQL, these are particularly valuable.

`WAL`  
`LSN`  
`WAL segment`  
`WAL retention`  
`WAL archiving`  
`Logical decoding`  
`Replication slot`  
`Logical replication slot`  
`Physical replication slot`  
`Replication slot bloat`  
`WAL accumulation`  
`Replication lag`  
`Replay lag`  
`Flush lag`  
`Write lag`  
`Hot standby`  
`Hot standby conflict`  
`Hot standby feedback`  
`VACUUM`  
`Autovacuum`  
`Autovacuum starvation`  
`Dead tuples`  
`Table bloat`  
`Index bloat`  
`Freeze`  
`Transaction ID freezing`  
`Visibility map`  
`Visibility map bit`  
`HOT update`  
`Heap-only tuple`  
`Heap fetch`  
`Index-only scan`  
`TOAST`  
`Page layout`  
`Tuple header`  
`FSM`  
`Free Space Map`  
`Buffer cache`  
`Shared buffers`  
`Buffer eviction`  
`Checkpoint`  
`Checkpoint spikes`  
`Checkpoint I/O storm`  
`Full-page writes`  
`fsync`  
`WAL flush`  
`Durability`  
`Synchronous commit`  
`Asynchronous commit`  
`Synchronous replication`  
`Quorum commit`  
`Replica promotion`  
`Failover slot`  
`Replication origin`  
`Prepared transaction`  
`Two-phase commit`  
`Query cancellation`  
`Lock manager`  
`LWLock`  
`Wait events`  
`pg_stat_activity`  
`pg_locks`  
`Buffer pin`  
`Buffer contention`  
`Plan cache`  
`Prepared statement plan`  
`Generic plan`  
`Custom plan`  
`Statistics misestimation`  
`Cardinality estimation`  
`Selectivity estimation`  
`Correlation statistics`  
`Extended statistics`  
`Parameter-sensitive plan`  
`Sequential scan surprise`  
`Index scan vs bitmap scan`  
`Bitmap heap scan`  
`Bitmap index scan`  
`External sort`  
`Hash spill`  
`Work_mem spill`  
`Temporary-file explosion`

PostgreSQL 18's documentation currently exposes many of these mechanisms directly: WAL, replication slots, autovacuum, MVCC visibility, index-only scans, standby conflicts and logical replication. citeturn107167search4turn859872search2turn859872search1turn859872search0turn859872search7

---

# 7. Query-performance things people discover the hard way

`N+1 query problem`  
`Cross-service N+1`  
`N+1 database fan-out`  
`Sargability`  
`Selectivity`  
`Cardinality`  
`Poor cardinality estimation`  
`Stale statistics`  
`Histogram misestimation`  
`Data skew`  
`Hot row`  
`Hot partition`  
`Index bloat`  
`Table bloat`  
`Random I/O amplification`  
`Read amplification`  
`Write amplification`  
`Space amplification`  
`Query plan instability`  
`Plan regression`  
`Plan cache poisoning`  
`Parameter-sensitive plans`  
`Implicit casts defeating indexes`  
`Function-wrapped indexed columns`  
`Non-covering index`  
`Heap fetches`  
`Index-only scan failure`  
`Sort spill`  
`Hash spill`  
`Disk-based aggregation`  
`Temp-table explosion`  
`Large `IN` list pathology`  
`OFFSET pagination degradation`  
`Pagination drift`  
`Phantom pagination`  
`Cursor invalidation`

---

# 8. Storage engines / LSM / RocksDB

A huge hidden area.

`LSM tree`  
`Memtable`  
`Immutable memtable`  
`SSTable`  
`L0`  
`L1/L2/... levels`  
`Compaction`  
`Compaction debt`  
`Compaction starvation`  
`Compaction backlog`  
`Compaction amplification`  
`Read amplification`  
`Write amplification`  
`Space amplification`  
`Tombstone`  
`Range tombstone`  
`Delete tombstone`  
`Long-lived snapshot`  
`Compaction pinning`  
`Bloom filter`  
`Ribbon filter`  
`Block cache`  
`Index block`  
`Filter block`  
`Prefix bloom filter`  
`Block cache thrashing`  
`Cache pollution`  
`Memtable flush`  
`Flush storm`  
`WAL replay`  
`Write stall`  
`Level-0 slowdown`  
`Level-0 stop`  
`File descriptor pressure`  
`Manifest`  
`Version set`  
`SST overlap`  
`Key-value separation`  
`BlobDB`  
`FIFO compaction`  
`Universal compaction`  
`Leveled compaction`

RocksDB's current material is a great example of this hidden layer: compaction can be blocked by long-lived snapshots, tombstones create amplification, and modern filters such as Ribbon reduce memory pressure differently from Bloom filters. citeturn498941search0turn498941search6turn498941search3

---

# 9. Distributed systems

This is probably the **highest-value category** for becoming genuinely strong at backend engineering.

`Partial failure`  
`Network partition`  
`Split brain`  
`Consensus`  
`Quorum`  
`Majority quorum`  
`Leader election`  
`Leader lease`  
`Follower`  
`Term`  
`Epoch`  
`Fencing token`  
`Stale leader`  
`Stale writer`  
`Zombie process`  
`Lease expiration`  
`Clock skew`  
`Clock drift`  
`Monotonic clock`  
`Wall clock`  
`Logical clock`  
`Lamport clock`  
`Vector clock`  
`Hybrid logical clock (HLC)`  
`Causal ordering`  
`Causal consistency`  
`Eventual consistency`  
`Sequential consistency`  
`Linearizability`  
`Strict serializability`  
`Serializable execution`  
`Read-your-writes consistency`  
`Monotonic reads`  
`Monotonic writes`  
`Session guarantees`  
`CAP`  
`PACELC`  
`Availability under partition`  
`Quorum intersection`  
`Read quorum`  
`Write quorum`  
`Sloppy quorum`  
`Hinted handoff`  
`Read repair`  
`Anti-entropy`  
`Gossip protocol`  
`Merkle tree reconciliation`  
`Consistent hashing`  
`Rendezvous hashing`  
`Jump consistent hash`  
`Virtual nodes`  
`Shard migration`  
`Rebalancing`  
`Hot shard`  
`Hot key`  
`Partition skew`  
`Split-for-heat`  
`Adaptive capacity`  
`Replica divergence`  
`Replica lag`  
`Read repair`  
`Conflict resolution`  
`Last-write-wins`  
`CRDT`  
`State-based CRDT`  
`Operation-based CRDT`  
`Delta CRDT`  
`Commutativity`  
`Idempotence`  
`Convergence`

Cloud Spanner is an excellent real-world example of the clock/consistency end of this spectrum: its TrueTime-based design provides external consistency stronger than ordinary linearizability for transactions. citeturn957646search7turn957646search8

---

# 10. Messaging / queues / Kafka

`At-most-once delivery`  
`At-least-once delivery`  
`Exactly-once processing`  
`Exactly-once semantics`  
`Effectively-once`  
`Duplicate delivery`  
`Message deduplication`  
`Deduplication window`  
`Idempotent consumer`  
`Transactional producer`  
`Transactional consumer`  
`Transactional outbox`  
`Transactional inbox`  
`Inbox pattern`  
`Outbox pattern`  
`Dead-letter queue`  
`Poison message`  
`Poison pill`  
`Redrive`  
`Visibility timeout`  
`Acknowledgement deadline`  
`Ack loss`  
`Consumer lag`  
`Consumer starvation`  
`Consumer rebalance`  
`Rebalance storm`  
`Partition ownership`  
`Sticky assignment`  
`Cooperative rebalancing`  
`Partition skew`  
`Hot partition`  
`Key skew`  
`Ordering guarantee`  
`Ordering violation`  
`Offset commit race`  
`Offset rewind`  
`Offset reset`  
`Replay`  
`Backfill`  
`Event replay`  
`Duplicate event`  
`Out-of-order event`  
`Event-time processing`  
`Processing-time processing`  
`Watermark`  
`Late-arriving data`  
`Allowed lateness`  
`Stream-time`  
`Checkpointing`  
`State snapshot`  
`State store`  
`State TTL`  
`Log compaction`  
`Compacted topic`  
`Tombstone record`  
`Consumer group coordination`  
`Partition reassignment`  
`Queue visibility race`

---

# 11. API correctness

`Idempotency`  
`Idempotency key`  
`Deduplication`  
`Semantic idempotency`  
`Safe retry`  
`Retryable error classification`  
`Ambiguous outcome`  
`Exactly-once illusion`  
`Lost response`  
`Client timeout after server success`  
`Duplicate mutation`  
`Request replay`  
`Optimistic concurrency`  
`ETag`  
`If-Match`  
`Conditional request`  
`Version token`  
`Compare-and-set`  
`Resource version`  
`Stale update`  
`Lost update`  
`API race`  
`Cursor pagination`  
`Offset pagination`  
`Pagination consistency`  
`Snapshot pagination`  
`Cursor invalidation`  
`API compatibility`  
`Backward compatibility`  
`Forward compatibility`  
`Tolerant reader`  
`Schema evolution`  
`Wire compatibility`  
`Protocol compatibility`  
`Version negotiation`

Stripe's API is a canonical real-world example: idempotency keys exist largely because the client can receive an ambiguous failure after the server has already performed the operation. citeturn192231search0turn192231search4

---

# 12. Caching — far deeper than “use Redis”

`Cache-aside`  
`Read-through cache`  
`Write-through cache`  
`Write-behind cache`  
`Refresh-ahead`  
`Negative caching`  
`Cache penetration`  
`Cache miss storm`  
`Cache stampede`  
`Dogpile effect`  
`Request collapsing`  
`Request coalescing`  
`Singleflight`  
`Cache lock`  
`Lease-based caching`  
`Probabilistic early expiration`  
`TTL jitter`  
`TTL synchronization`  
`Hot key`  
`Hot shard`  
`Cache avalanche`  
`Cache pollution`  
`Cache poisoning`  
`Cache inconsistency`  
`Stale cache`  
`Stale-while-revalidate`  
`Stale-if-error`  
`Serve-stale`  
`Background revalidation`  
`Cache warm-up`  
`Cold cache`  
`Two-level cache`  
`Local cache`  
`Distributed cache`  
`Near cache`  
`Cache invalidation race`  
`Versioned cache keys`  
`Generation counter`  
`Cache coherence`  
`Write invalidation`  
`Tag-based invalidation`  
`Cache fragmentation`  
`Cache eviction storm`

Vercel's 2025 CDN work is a particularly good modern example: request collapsing prevents multiple concurrent cache misses from independently regenerating the same resource, using hierarchical locking and double-checked caching. citeturn788704search1

---

# 13. Concurrency

`Race condition`  
`Data race`  
`Atomicity`  
`Visibility`  
`Ordering`  
`Happens-before`  
`Memory model`  
`Linearization point`  
`Linearizable operation`  
`Lock-free`  
`Wait-free`  
`Obstruction-free`  
`CAS`  
`Compare-and-swap`  
`ABA problem`  
`False sharing`  
`Cache-line bouncing`  
`Cache coherence traffic`  
`Lock contention`  
`Lock convoy`  
`Priority inversion`  
`Thread starvation`  
`Thread explosion`  
`Thread-pool exhaustion`  
`Executor queue saturation`  
`Work stealing`  
`Fork-join starvation`  
`Livelock`  
`Deadlock`  
`Starvation`  
`Reentrant locking`  
`Recursive lock`  
`Reader-writer starvation`  
`Seqlock`  
`RCU`  
`Hazard pointers`  
`Epoch-based reclamation`  
`Memory reclamation race`  
`Object lifetime race`  
`Use-after-free`  
`Double-free`  
`Data corruption due to torn writes`

---

# 14. Runtime / garbage collection

`Stop-the-world GC`  
`Concurrent GC`  
`GC pause`  
`GC death spiral`  
`Allocation rate`  
`Allocation pressure`  
`Heap fragmentation`  
`Native memory leak`  
`Managed memory leak`  
`Off-heap memory`  
`Direct buffer`  
`Memory retention`  
`Object promotion`  
`Old-generation pressure`  
`Heap dump`  
`Safepoint`  
`Safepoint bias`  
`JIT compilation`  
`Deoptimization`  
`Code cache`  
`Inline cache`  
`Escape analysis`  
`Stack growth`  
`Thread-local allocation`  
`Allocator contention`  
`Arena allocation`  
`Memory fragmentation`  
`Reference queue`  
`Finalizer backlog`

For Go:

`Goroutine leak`  
`Goroutine starvation`  
`GOMAXPROCS contention`  
`GC assist`  
`Scheduler latency`  
`STW phase`  
`Heap goal`  
`Escape-to-heap`  
`P/M/G scheduler`

For Node.js:

`Event-loop starvation`  
`Event-loop lag`  
`Microtask starvation`  
`libuv thread-pool exhaustion`  
`Sync-over-async`  
`Unhandled rejection`  
`Open-handle leak`  
`Timer leak`  
`Socket leak`  
`Buffer retention`

---

# 15. Linux / OS internals

`File descriptor exhaustion`  
`PID exhaustion`  
`Inode exhaustion`  
`Socket exhaustion`  
`Memory pressure`  
`CPU pressure`  
`I/O pressure`  
`PSI (Pressure Stall Information)`  
`OOM killer`  
`OOMScoreAdj`  
`Cgroup memory limit`  
`Cgroup CPU quota`  
`CPU throttling`  
`CPU steal`  
`Run queue latency`  
`Context switching`  
`Voluntary context switch`  
`Involuntary context switch`  
`Page fault`  
`Minor page fault`  
`Major page fault`  
`Page cache`  
`Cache thrashing`  
`Direct reclaim`  
`kswapd`  
`Swap storm`  
`Thrashing`  
`Transparent Huge Pages`  
`HugeTLB`  
`NUMA`  
`NUMA locality`  
`Remote memory access`  
`NUMA balancing`  
`TLB miss`  
`TLB shootdown`  
`CPU cache miss`  
`Branch misprediction`  
`False sharing`  
`Dirty page`  
`Writeback`  
`Dirty throttling`  
`Fsync latency`  
`I/O queue depth`  
`I/O scheduler`  
`Block layer congestion`  
`OverlayFS copy-up`  
`Zombie process`  
`Orphan process`  
`PID 1 semantics`  
`Signal handling`  
`SIGTERM race`  
`SIGKILL`  
`Graceful shutdown`  
`File descriptor inheritance`  
`ulimit`  
`inotify exhaustion`

Linux's filesystem documentation shows why “write succeeded” and “data reached persistent storage” are different concepts: dirty pages can remain in cache and storage devices can acknowledge writes before volatile device caches are flushed. citeturn387639search6turn387639search10

---

# 16. Kubernetes / containers

`CrashLoopBackOff`  
`OOMKilled`  
`Eviction`  
`Node pressure`  
`Memory pressure`  
`Disk pressure`  
`PID pressure`  
`Ephemeral-storage pressure`  
`CPU throttling`  
`Readiness probe`  
`Liveness probe`  
`Startup probe`  
`Probe-induced restart`  
`False health check`  
`Readiness race`  
`Termination race`  
`PreStop hook`  
`TerminationGracePeriod`  
`Endpoint propagation delay`  
`Stale endpoint`  
`Pod disruption budget`  
`Topology spread constraints`  
`Pod anti-affinity`  
`Node affinity`  
`Scheduler scoring`  
`Scheduler starvation`  
`Bin packing`  
`Resource fragmentation`  
`Overcommit`  
`QoS class`  
`Guaranteed/Burstable/BestEffort`  
`Cgroup throttling`  
`Container runtime overhead`  
`Image pull storm`  
`Cold-start storm`  
`DaemonSet pressure`  
`Sidecar overhead`  
`Sidecar startup ordering`  
`Service mesh overhead`  
`DNS saturation`  
`CoreDNS overload`  
`API-server throttling`  
`Control-plane saturation`

Kubernetes explicitly treats restart backoff as protection against repeated crash/restart storms, and distinguishes readiness, liveness and startup semantics; confusing these probes is a classic production failure mode. citeturn387639search7

---

# 17. Observability

`RED method`  
`USE method`  
`Golden signals`  
`Saturation`  
`Utilization`  
`High-cardinality metrics`  
`Cardinality explosion`  
`Label explosion`  
`Dimensionality`  
`Metric cardinality budget`  
`Histogram`  
`Native histogram`  
`Summary`  
`Quantile`  
`Exemplar`  
`Metric aggregation`  
`Recording rule`  
`Trace`  
`Span`  
`Span context`  
`Trace context`  
`Context propagation`  
`Baggage`  
`Traceparent`  
`Trace ID`  
`Span ID`  
`Trace sampling`  
`Head sampling`  
`Tail sampling`  
`Adaptive sampling`  
`Probabilistic sampling`  
`Sampling bias`  
`Trace fan-out`  
`Span explosion`  
`Orphan span`  
`Async span`  
`Span links`  
`Log correlation`  
`Structured logging`  
`Contextual logging`  
`Log cardinality`  
`Log sampling`  
`Log-based metrics`  
`Synthetic monitoring`  
`Black-box monitoring`  
`White-box monitoring`  
`Canary monitoring`  
`Continuous profiling`  
`CPU profiling`  
`Off-CPU profiling`  
`Flame graph`  
`Differential flame graph`  
`Stack profiling`  
`Run-queue analysis`  
`eBPF observability`  
`USDT probes`  
`Perf events`  
`System call tracing`  
`Distributed tracing`

Brendan Gregg's methodology is particularly useful because it separates **service-level symptoms** (RED: rate, errors, duration) from **resource-level causes** (USE: utilization, saturation, errors), and explicitly recommends off-CPU and stack analysis. citeturn859872search10

---

# 18. SRE / incident response jargon

`SLO`  
`SLI`  
`SLA`  
`Error budget`  
`Error-budget burn`  
`Burn rate`  
`Multi-window multi-burn-rate alert`  
`Toil`  
`Operational load`  
`Incident commander`  
`Incident response`  
`Runbook`  
`Playbook`  
`Escalation policy`  
`Postmortem`  
`Blameless postmortem`  
`Root-cause analysis`  
`Contributing factor`  
`Trigger`  
`Failure mode`  
`Blast radius`  
`Time to detect`  
`Time to acknowledge`  
`Time to mitigate`  
`Time to recover`  
`MTTD`  
`MTTR`  
`MTBF`  
`Change failure rate`  
`Rollback`  
`Roll-forward`  
`Emergency mitigation`  
`Mitigation vs remediation`  
`Known-good version`  
`Safe mode`  
`Degraded mode`  
`Operational readiness review`  
`Game day`  
`Failure injection`  
`Chaos engineering`

---

# 19. Distributed observability — much deeper

`Trace-context propagation`  
`Cross-service correlation`  
`Trace sampling bias`  
`Tail-sampling decision`  
`Trace exemplars`  
`Span cardinality`  
`High-cardinality dimensions`  
`Causal ambiguity`  
`Temporal correlation`  
`Clock skew in traces`  
`Clock synchronization`  
`NTP drift`  
`Monotonic timestamp`  
`Wall-clock timestamp`  
`Trace clock correction`  
`Missing spans`  
`Dropped spans`  
`Sampling-induced blind spots`  
`Partial telemetry`  
`Observer effect`  
`Instrumentation overhead`  
`Telemetry backpressure`  
`Telemetry pipeline overload`  
`Cardinality explosion`  
`Metrics poisoning`  
`Alert fatigue`

OpenTelemetry's current concepts explicitly cover context propagation, baggage, signals, instrumentation, distributions and sampling. citeturn859872search11turn859872search5

---

# 20. Deployment / release engineering

`Canary deployment`  
`Canary release`  
`Progressive delivery`  
`Ring deployment`  
`Percentage rollout`  
`Dark launch`  
`Shadow traffic`  
`Traffic mirroring`  
`A/B deployment`  
`Feature flag`  
`Kill switch`  
`Runtime configuration`  
`Dynamic configuration`  
`Config drift`  
`Configuration rollback`  
`Blue-green deployment`  
`Rolling deployment`  
`Rolling restart`  
`Immutable deployment`  
`Safe deployment`  
`Automated rollback`  
`Blast-radius control`  
`Failure threshold`  
`Deployment health gate`  
`Bake time`  
`Warm-up period`  
`Cache warm-up`  
`Connection warm-up`  
`Load ramp`  
`Cold-start storm`  
`Deployment-induced thundering herd`  
`Connection-pool stampede`  
`Schema-before-code`  
`Code-before-schema`

Feature flags, dark launches and canary releases are specifically used to expose new production code gradually and observe its behavior before full rollout. citeturn338632search0turn338632search2

---

# 21. Database migrations

This is another huge “you only learn it after breaking production” domain.

`Expand-and-contract migration`  
`Online migration`  
`Zero-downtime migration`  
`Dual write`  
`Shadow write`  
`Shadow read`  
`Backfill`  
`Incremental backfill`  
`Rate-limited backfill`  
`Online DDL`  
`Metadata lock`  
`DDL lock contention`  
`Schema compatibility`  
`Backward-compatible schema`  
`Forward-compatible schema`  
`Lazy migration`  
`Read repair migration`  
`Dual-read validation`  
`Data reconciliation`  
`Migration verifier`  
`Checksum comparison`  
`Cutover`  
`Traffic cutover`  
`Rollback migration`  
`Irreversible migration`  
`Ghost table`  
`Ghost migration`  
`Shadow table`  
`Change capture during migration`  
`CDC-assisted migration`  
`Replay migration`  
`Historical backfill`  
`Migration throttling`  
`Migration-induced load`  
`Backfill interference`  
`Replica lag caused by migration`

Stripe's migration architecture is a textbook example of dual-writing, lazy migration, backfill, verification and eventual removal of the old schema. citeturn296488search2

---

# 22. Distributed transactions

`2PC`  
`3PC`  
`Two-phase commit`  
`Prepare phase`  
`Commit phase`  
`Coordinator failure`  
`Participant blocking`  
`XA`  
`Saga`  
`Saga orchestration`  
`Saga choreography`  
`Compensating transaction`  
`Transactional outbox`  
`Transactional inbox`  
`CDC`  
`Change data capture`  
`Exactly-once illusion`  
`Idempotent consumer`  
`Deduplication`  
`Transactional messaging`  
`Atomic publish`  
`Atomic commit`  
`Read-your-writes`  
`Write fence`  
`Fencing token`  
`Lease-based ownership`

---

# 23. Security things backend engineers eventually encounter

`SSRF`  
`Cloud metadata SSRF`  
`DNS rebinding`  
`Request smuggling`  
`CL.TE desynchronization`  
`TE.CL desynchronization`  
`HTTP request desync`  
`Host-header attack`  
`Cache poisoning`  
`Cache deception`  
`JWT algorithm confusion`  
`JWT `none` vulnerability`  
`JWT key confusion`  
`JWKS rotation`  
`JWKS cache staleness`  
`Token replay`  
`Refresh-token replay`  
`Session fixation`  
`Session invalidation race`  
`Credential rotation`  
`Secret leakage`  
`Secret sprawl`  
`Short-lived credentials`  
`Workload identity`  
`OIDC federation`  
`mTLS`  
`Certificate rotation`  
`Certificate expiry outage`  
`Clock-skew authentication failure`  
`Nonce reuse`  
`Replay protection`  
`CSRF`  
`CORS misconfiguration`  
`CSP`  
`Prototype pollution`  
`Insecure deserialization`  
`Dependency confusion`  
`Typosquatting`  
`Repo-jacking`  
`Package takeover`  
`Malicious dependency`  
`Build poisoning`  
`CI/CD compromise`  
`Artifact tampering`  
`SBOM`  
`SLSA`  
`Build provenance`  
`Hermetic build`  
`Reproducible build`  
`Trusted publishing`  
`Sigstore`  
`Cosign`  
`Binary transparency`  
`Ephemeral CI credentials`

Modern supply-chain security is increasingly centered around **provenance**, not just vulnerability lists: SLSA explicitly models provenance integrity, while Google discusses combining SBOMs with SLSA and extending provenance thinking into AI systems. citeturn498941search5turn498941search2

---

# 24. Software testing beyond unit/integration tests

`Property-based testing`  
`Fuzz testing`  
`Coverage-guided fuzzing`  
`Mutation testing`  
`Metamorphic testing`  
`Differential testing`  
`Contract testing`  
`Consumer-driven contract testing`  
`Model-based testing`  
`Invariant testing`  
`Concurrency testing`  
`Race detection`  
`Deadlock testing`  
`Chaos testing`  
`Fault injection`  
`Network fault injection`  
`Latency injection`  
`Packet-loss injection`  
`CPU stress`  
`Memory pressure testing`  
`Disk-full testing`  
`Dependency failure testing`  
`Process-kill testing`  
`Clock manipulation testing`  
`Time-travel testing`  
`Deterministic simulation`  
`Jepsen testing`  
`Model checking`  
`TLA+`  
`State-machine testing`  
`Replay testing`  
`Production traffic replay`  
`Shadow testing`  
`Soak testing`  
`Spike testing`  
`Stress testing`  
`Capacity testing`  
`Break-point testing`  
`Load ramp testing`  
`Failure-mode testing`

---

# 25. Weird debugging phenomena

These names are worth knowing because they describe *why the bug disappears when you investigate it*.

`Heisenbug`  
`Bohrbug`  
`Mandelbug`  
`Schrödinger bug`  
`Ghost bug`  
`Flaky test`  
`Timing-dependent bug`  
`Race-dependent bug`  
`Environment-dependent bug`  
`Load-dependent bug`  
`Data-dependent bug`  
`State-dependent bug`  
`Non-deterministic failure`  
`Emergent failure`  
`Heisenberg effect / observer effect`  
`Production-only bug`  
`Configuration-only bug`  
`Cold-start-only bug`  
`Warm-cache-only bug`  
`Hot-cache-only bug`  
`Rare-event failure`

---

# 26. Data correctness / event-driven systems

`Eventual consistency`  
`Event ordering`  
`Event causality`  
`Event duplication`  
`Event loss`  
`Event replay`  
`Event sourcing`  
`CQRS`  
`Projection lag`  
`Read-model lag`  
`Materialized-view lag`  
`Stale read model`  
`Projection rebuild`  
`Snapshotting`  
`Event versioning`  
`Schema evolution`  
`Schema registry`  
`Compatibility mode`  
`Backward-compatible event`  
`Forward-compatible event`  
`Poison event`  
`Dead-letter event`  
`Out-of-order event`  
`Late event`  
`Missing event`  
`Duplicate event`  
`Compensating event`  
`Correction event`  
`Temporal coupling`  
`Spatial coupling`  
`Operational coupling`

---

# 27. Architecture concepts that become important at scale

`Bounded context`  
`Aggregate`  
`Aggregate boundary`  
`Anti-corruption layer`  
`Strangler fig pattern`  
`Modular monolith`  
`Distributed monolith`  
`Accidental coupling`  
`Temporal coupling`  
`Spatial coupling`  
`Control plane`  
`Data plane`  
`Management plane`  
`Sidecar`  
`Service mesh`  
`Ambient mesh`  
`Gateway`  
`Backend-for-frontend`  
`Fan-out architecture`  
`Fan-in architecture`  
`Work queue architecture`  
`Cell architecture`  
`Sharded architecture`  
`Federated architecture`  
`Multi-region architecture`  
`Active-active`  
`Active-passive`  
`Warm standby`  
`Cold standby`  
`Disaster recovery`  
`RPO`  
`RTO`  
`Failover`  
`Failback`  
`Split-brain avoidance`  
`Control-plane dependency`  
`Dependency graph`  
`Architecture fitness function`

---

# 28. Cache / database / distributed-system intersection

These are especially “senior backend engineer” concepts:

`Cache consistency gap`  
`Stale replica + stale cache`  
`Cache invalidation race`  
`Read-after-write anomaly`  
`Replica lag amplification`  
`Cache stampede after failover`  
`Cold-cache recovery storm`  
`Failover thundering herd`  
`Leader failover storm`  
`Replica promotion lag`  
`Hot-key migration`  
`Shard migration amplification`  
`Rebalancing storm`  
`Compaction storm`  
`Checkpoint storm`  
`Vacuum storm`  
`Backfill storm`  
`Replay storm`  
`Retry storm`  
`Connection storm`  
`DNS storm`  
`TLS handshake storm`

---

# 29. Storage / hardware performance

`IOPS`  
`Throughput`  
`IO latency`  
`Tail I/O latency`  
`Queue depth`  
`Write amplification`  
`Read amplification`  
`Space amplification`  
`Write cliff`  
`SSD garbage collection`  
`FTL`  
`TRIM`  
`Wear leveling`  
`Write endurance`  
`fsync storm`  
`Writeback storm`  
`Page-cache eviction`  
`RAID write hole`  
`Read-modify-write`  
`Erasure coding`  
`Repair amplification`  
`Scrubbing`  
`Bit rot`  
`Silent data corruption`  
`Checksumming`  
`End-to-end integrity`  
`Persistent memory ordering`  
`FUA`  
`Cache flush`

---

# 30. Modern AI-serving/backend infrastructure

This is now becoming a serious backend specialization.

`Continuous batching`  
`Dynamic batching`  
`PagedAttention`  
`KV cache`  
`KV cache fragmentation`  
`KV cache pressure`  
`KV cache eviction`  
`KV cache quantization`  
`Prefix caching`  
`Prompt caching`  
`Chunked prefill`  
`Concurrent partial prefill`  
`Prefill / decode disaggregation`  
`Encode / prefill / decode disaggregation`  
`Speculative decoding`  
`Speculative prefill`  
`Draft model`  
`Acceptance rate`  
`Medusa`  
`MTP (multi-token prediction)`  
`Tensor parallelism`  
`Pipeline parallelism`  
`Expert parallelism`  
`Data parallelism`  
`Sequence parallelism`  
`Microbatching`  
`CUDA graph capture`  
`Kernel fusion`  
`FlashAttention`  
`FlashInfer`  
`Quantization`  
`FP8`  
`INT8`  
`INT4`  
`MoE routing`  
`Expert load imbalance`  
`Token routing`  
`Token-level scheduling`  
`Prompt-token admission control`  
`Token budget`  
`Prompt backlog`  
`TTFT QoS`  
`Decode throughput`  
`Inter-token latency`  
`GPU memory fragmentation`  
`GPU memory pressure`  
`Model warm-up`  
`Weight-loading bottleneck`  
`GPU utilization illusion`  
`CPU dispatch overhead`  
`Kernel launch overhead`  
`Communication/computation overlap`  
`NCCL contention`  
`GPU straggler`  
`Inference queueing`  
`Model multiplexing`  
`Model residency`  
`Model eviction`  
`Cold model load`  
`Prefix-cache hit rate`

Current vLLM V1 documentation is a good snapshot of where modern serving has moved: prefix caching, chunked prefill, speculative decoding, token-budget scheduling and disaggregated execution are now first-class serving concerns. citeturn224901search0turn224901search1turn224901search2

---

# 31. Build systems / CI/CD internals

`Hermetic build`  
`Reproducible build`  
`Deterministic build`  
`Build provenance`  
`Artifact provenance`  
`Artifact digest`  
`Content-addressable storage`  
`Remote build cache`  
`Local build cache`  
`Cache poisoning`  
`Dependency graph`  
`Build graph`  
`Incremental build`  
`Build invalidation`  
`Flaky test`  
`Test quarantine`  
`Merge queue`  
`Ephemeral runner`  
`Ephemeral credentials`  
`OIDC workload identity`  
`Artifact promotion`  
`Artifact immutability`  
`Binary transparency`  
`SBOM`  
`SLSA`  
`Software provenance`  
`Trusted publisher`  
`Dependency pinning`  
`Lockfile integrity`  
`Supply-chain attack`

---

# 32. API gateway / microservice-specific problems

`Fan-out explosion`  
`N+1 service calls`  
`Retry multiplication`  
`Timeout multiplication`  
`Cascading timeout`  
`Deadline mismatch`  
`Retry at multiple layers`  
`Duplicate retries`  
`Transparent retry`  
`Retry throttling`  
`Circuit-breaker synchronization`  
`Connection pool multiplication`  
`Service discovery staleness`  
`DNS-based discovery lag`  
`Stale endpoint routing`  
`Load-balancer skew`  
`Least-connections bias`  
`Hot instance`  
`Uneven hashing`  
`Zone imbalance`  
`Cross-zone traffic`  
`Cross-region traffic`  
`Serialization overhead`  
`Marshalling overhead`  
`Deserialization amplification`  
`Payload amplification`  
`Compression CPU tradeoff`  
`Protocol downgrade`  
`Request cancellation leak`

gRPC itself documents transparent retries, retry throttling, server pushback, hedging and deadline behavior—these aren't hypothetical edge concepts anymore. citeturn296488search6turn296488search0

---

# 33. Multi-tenant systems

`Noisy neighbor`  
`Tenant isolation`  
`Fairness`  
`Per-tenant quotas`  
`Per-tenant concurrency`  
`Tenant throttling`  
`Hierarchical rate limiting`  
`Weighted fair queueing`  
`Priority queue`  
`Work conservation`  
`Tenant-aware load shedding`  
`Tenant-aware caching`  
`Tenant hot key`  
`Tenant shard`  
`Tenant migration`  
`Shard affinity`  
`Resource reservation`  
`Capacity isolation`  
`Burst allowance`  
`Quota starvation`

---

# 34. Rate limiting deeper than “100 requests/minute”

`Fixed-window rate limit`  
`Sliding-window rate limit`  
`Sliding-window counter`  
`Token bucket`  
`Leaky bucket`  
`GCRA`  
`Distributed rate limiter`  
`Local rate limiter`  
`Global rate limiter`  
`Hierarchical rate limiter`  
`Adaptive rate limiter`  
`Concurrency limiter`  
`Concurrency-based admission control`  
`Fair queuing`  
`Weighted fair queueing`  
`Priority-aware rate limiting`  
`Retry-After`  
`Server pushback`  
`Rate-limit feedback loop`  
`Quota leakage`  
`Quota synchronization`

---

# 35. Clock/time problems

Extremely underrated.

`Clock skew`  
`Clock drift`  
`Clock step`  
`Clock slew`  
`NTP synchronization`  
`Monotonic clock`  
`Wall clock`  
`Logical clock`  
`Lamport clock`  
`Vector clock`  
`Hybrid logical clock`  
`Timestamp ordering`  
`Clock uncertainty`  
`Leap second`  
`Time rollback`  
`Expiration race`  
`TTL race`  
`Lease expiry race`  
`Token-expiration race`  
`Distributed timestamp ordering`  
`Commit-wait`  
`TrueTime`

---

# 36. Production data pipeline problems

`Backpressure`  
`Consumer lag`  
`Lag accumulation`  
`Watermark lag`  
`Late data`  
`Out-of-order data`  
`Duplicate data`  
`Data skew`  
`Partition skew`  
`Hot partition`  
`Hot key`  
`Repartitioning`  
`Shuffle explosion`  
`Shuffle spill`  
`State-store growth`  
`Checkpoint lag`  
`State recovery`  
`Replay storm`  
`Backfill storm`  
`Poison record`  
`Dead-letter flow`  
`Schema drift`  
`Schema evolution`  
`Schema incompatibility`  
`Exactly-once sink`  
`Idempotent sink`  
`Deduplication`  
`Watermark heuristics`  
`Late-data correction`

---

# 37. Debugging tools / techniques people eventually learn

`strace`  
`ltrace`  
`perf`  
`eBPF`  
`bpftrace`  
`BCC`  
`flame graphs`  
`off-CPU profiling`  
`CPU profiling`  
`heap profiling`  
`allocation profiling`  
`lock profiling`  
`mutex profiling`  
`goroutine dump`  
`thread dump`  
`heap dump`  
`core dump`  
`packet capture`  
`tcpdump`  
`Wireshark`  
`ss`  
`netstat`  
`lsof`  
`iostat`  
`vmstat`  
`pidstat`  
`sar`  
`mpstat`  
`top`  
`htop`  
`dstat`  
`iotop`  
`tc`  
`conntrack`  
`nsenter`  
`stranded process inspection`  
`deadlock graph`  
`lock graph`  
`dependency graph`  
`query plan analysis`  
`slow-query analysis`  
`histogram analysis`  
`trace waterfall analysis`

---

# 38. Particularly nasty “production-only” phenomena

These are the names I would put a **★** beside in your learning list:

`★ Partial failure`  
`★ Gray failure`  
`★ Fail-slow`  
`★ Retry storm`  
`★ Retry amplification`  
`★ Thundering herd`  
`★ Cache stampede`  
`★ Request collapsing`  
`★ Coordinated omission`  
`★ Tail latency`  
`★ Deadline propagation`  
`★ Cancellation propagation`  
`★ Connection pool exhaustion`  
`★ Ephemeral port exhaustion`  
`★ File descriptor exhaustion`  
`★ CPU throttling`  
`★ OOM killer`  
`★ Lock convoy`  
`★ False sharing`  
`★ Event-loop starvation`  
`★ Goroutine/thread leak`  
`★ Hot partition`  
`★ Hot key`  
`★ Replica lag`  
`★ Read-after-write inconsistency`  
`★ Long-running transaction`  
`★ MVCC bloat`  
`★ Transaction ID wraparound`  
`★ WAL retention`  
`★ Replication-slot leak`  
`★ Compaction debt`  
`★ Write amplification`  
`★ Backfill storm`  
`★ Dual-write inconsistency`  
`★ Outbox/inbox`  
`★ Poison message`  
`★ Consumer rebalance storm`  
`★ Split brain`  
`★ Stale leader`  
`★ Fencing token`  
`★ Clock skew`  
`★ Race condition`  
`★ Deadlock`  
`★ Livelock`  
`★ Resource starvation`  
`★ Noisy neighbor`  
`★ Service-discovery staleness`  
`★ DNS caching failure`  
`★ MTU black hole`  
`★ SYN backlog exhaustion`  
`★ Conntrack exhaustion`  
`★ Deployment connection storm`  
`★ Cache warm-up storm`  
`★ Cold-start storm`  
`★ Query-plan regression`  
`★ Cardinality explosion`  
`★ Trace sampling blind spot`  
`★ Silent data corruption`  
`★ Configuration drift`

---

# The deeper relationship

The most useful mental model is this:

```text
                    LOAD
                     │
                     ▼
                  QUEUES
                     │
           ┌─────────┼─────────┐
           ▼         ▼         ▼
        CPU/RAM     POOLS     LOCKS
           │         │         │
           └────┬────┴────┬────┘
                ▼         ▼
              LATENCY   STARVATION
                │         │
                └────┬────┘
                     ▼
                  TIMEOUT
                     │
                     ▼
                   RETRY
                     │
                     ▼
              THUNDERING HERD
                     │
                     ▼
                MORE LOAD
                     │
                     ▼
              CASCADING FAILURE


DATA SIDE

 write
   │
   ▼
  WAL ───► replication ───► replica lag
   │
   ▼
 MVCC ───► dead tuples ───► vacuum
   │                         │
   └─────────────────────────┘
              │
              ▼
           BLOAT
              │
              ▼
         MORE I/O
              │
              ▼
          LATENCY


DISTRIBUTED SIDE

 network partition
        │
        ▼
  partial failure
        │
   ┌────┴────┐
   ▼         ▼
stale data  stale leader
   │         │
   ▼         ▼
consistency fencing
anomaly     token
   │         │
   └────┬────┘
        ▼
   correctness
      failure
```

And the most interesting part is that **these categories interact**.

For example:

```text
Slow DB
  ↓
connection pool fills
  ↓
request queue grows
  ↓
timeouts
  ↓
retries
  ↓
more DB connections
  ↓
DB gets slower
  ↓
retry storm
  ↓
CPU ↑ / RAM ↑ / FD ↑
  ↓
health check fails
  ↓
load balancer removes instances
  ↓
remaining instances receive more traffic
  ↓
cascading failure
```

Google explicitly documents this kind of multi-resource causal chain, and modern Vercel/Uber production work demonstrates the same phenomena with cache misses, connection lifecycles, queueing and adaptive load management. citeturn107167search0turn788704search2turn788704search1turn788704search0

---

# The “hidden backend curriculum”

If I compress the entire list into the areas that separate a normal backend developer from someone who can **debug real distributed production systems**, the progression looks like:

```text
HTTP / REST
      ↓
TCP / DNS / TLS
      ↓
Linux / processes / sockets
      ↓
Concurrency / memory model
      ↓
Queues / backpressure
      ↓
Caching
      ↓
Database internals
      ↓
Replication / WAL / MVCC
      ↓
Distributed consistency
      ↓
Messaging / CDC
      ↓
Retries / deadlines / idempotency
      ↓
Load shedding / isolation
      ↓
Observability / profiling
      ↓
Failure injection / chaos
      ↓
Multi-region / distributed systems
      ↓
Control planes / cells / sharding
      ↓
Production incident engineering
```

That is the layer that typical **“Node.js + Express + PostgreSQL + Redis + Docker + Kubernetes”** tutorials mostly don't teach.

And there is an even newer branch forming underneath it:

```text
Distributed systems
       │
       ├── Classical backend
       │      ├── DB
       │      ├── queues
       │      └── caches
       │
       └── AI infrastructure
              ├── token scheduling
              ├── continuous batching
              ├── KV-cache management
              ├── speculative decoding
              ├── GPU scheduling
              ├── prefill/decode disaggregation
              └── inference admission control
```

That's why the current AI-serving stack increasingly looks less like “call an LLM API” and more like **distributed-systems + OS + scheduler + memory-management engineering**. citeturn224901search0turn224901search1

The single biggest takeaway: **learn failure mechanics, not just framework APIs.** Once you understand queues, resource exhaustion, time, concurrency, consistency, retries, caching, storage and observability, frameworks such as Express, Go, Rust, Spring, Django, FastAPI, Kubernetes, Kafka, Postgres, Redis, etc. become implementation details rather than separate worlds.