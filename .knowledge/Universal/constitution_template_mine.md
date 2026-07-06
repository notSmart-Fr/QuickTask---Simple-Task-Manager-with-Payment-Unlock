# Universal Project Constitution

> **Template for speckit-constitution.** Replace all `[PROJECT-SPECIFIC]` blocks with your project's actual values. The 14 Core Principles (1.1–1.14) are universal and should not be removed. All other sections may be tuned per project.

---

## 1. Core Principles (Universal — Do Not Modify)

### 1.1 Separation of Concerns

Every piece of code has ONE responsibility and ONE reason to change. Modules that try to do multiple things become impossible to test, refactor, or reason about.

### 1.2 Dependency Direction

Dependencies point INWARD toward stable, core business logic. Outer layers depend on inner layers. Never the reverse. Core logic imports nothing from infrastructure or frameworks.

### 1.3 Testability First

Core business logic MUST be testable without mocks, frameworks, or external dependencies. Logic that would cause data loss, security violations, or incorrect business outcomes if broken MUST be tested. Coverage is a lagging indicator, not a target.

#### 1.3.1 Determinism in Core Logic

Core business logic MUST be deterministic. Non-deterministic primitives (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) MUST NOT be called directly in Core. Inject them via abstractions (e.g., `Clock`, `IdGenerator`) so tests can control time and randomness deterministically.

**Why:** Dijkstra (1972): "Program testing can show the presence of bugs, never their absence." Non-deterministic logic makes test results irreproducible, defeating the purpose of testing.

### 1.4 Type Safety

All code MUST use strict typing. Type escapes (`any`, `@ts-ignore`, `@ts-nocheck`) are FORBIDDEN except for documented exceptions in legacy migration contexts. Exported functions and public API surfaces MUST have explicit return types. Internal functions may rely on inference.

### 1.5 Observability by Default

All critical paths MUST be instrumented. Errors MUST be traceable to their source. Structured logging (JSON) with trace IDs is preferred over unstructured console output.

### 1.6 Fail Gracefully

All external calls (network, database, file I/O) MUST have timeouts. No unhandled exceptions — every catch block must log, rethrow, or degrade. Recovery paths (retry, fallback, circuit breaker) should be explicit and configurable.

### 1.7 Data Integrity

All data entering the system from external sources MUST be validated at the boundary before reaching internal logic. All data leaving the system MUST be validated or sanitized. Invalid data MUST NOT enter Core.

### 1.8 Idempotency

External write operations that can be retried MUST be idempotent. Retry mechanisms SHALL use idempotency keys with a defined TTL for distributed systems. Local/embedded operations may skip idempotency if retry is not possible.

### 1.9 Backward Compatibility

Public APIs, schemas, and data formats SHALL be backward-compatible within a major version. Breaking changes follow: deprecation → grace period → removal. Internal-only interfaces may break freely.

### 1.10 Resource Lifecycle (FM5)

All acquired external resources (connections, streams, file handles, timers) MUST have guaranteed teardown via `try/finally`, `using` (explicit resource management), or equivalent deterministic cleanup. Ungraceful process termination (`process.exit`) is FORBIDDEN — use structured shutdown handlers (`SIGTERM`, `SIGINT`) to drain connections before exit.

**Why this is universal:** Every program that touches OS resources must clean them up. This is a physical law of resource-constrained systems, not an architectural opinion.

### 1.11 State Sanitization (FM3)

Sensitive data (PII, secrets, tokens, internal identifiers, raw domain models) MUST NOT appear in logs, error messages, telemetry spans, or API response bodies unless explicitly redacted or mapped to a safe DTO. Logs are permanent. Never log what you cannot explain.

**Why this is universal:** Every system produces logs. Every system has some form of sensitive data. Leaking internal state to outputs is a universal failure mode, regardless of codebase age or size.

### 1.12 Transaction Integrity (FM6)

Any function executing multiple dependent write operations (updates, inserts, deletes on related entities) MUST wrap them in an atomic transaction or distributed saga. Partial writes corrupt system state. Idempotency (1.8) prevents duplicate writes; atomicity (1.12) prevents partial writes. Both are required when mutating shared state.

**Why this is universal:** Even a CLI tool writing to a local SQLite file must be atomic if it updates two tables. This is a fundamental property of state mutation, not a microservices concern.

#### 1.12.1 In-Memory State

Shared in-memory state (caches, counters, registries at module scope) MUST be encapsulated in dedicated state-owning services with explicit lifecycle hooks. Module-level `let`/`var` declarations are FORBIDDEN. All shared state SHALL be passed explicitly through function parameters or managed by a service with well-defined concurrency semantics.

**Why:** Lamport (1978): shared mutable state in concurrent systems produces non-deterministic failures. Even in single-threaded async runtimes, interleaved `await` points create race conditions on module-level state that no unit test will reproduce.

### 1.13 Forward Migration Contracts

Data schemas, API signatures, and storage formats SHALL define forward migration contracts: explicit guarantees to future consumers about what WILL NOT change. A forward contract is the producer's promise — "field `status` will never be removed, only extended with new values" or "this endpoint will always accept the `version` parameter." Schema evolution SHALL follow expand-migrate-contract: add → dual-support → migrate consumers → remove old path. Breaking changes to contracted surfaces SHALL require a MAJOR version bump with documented migration path.

**Why:** Parnas (1979): modules should be designed for a planned set of *future* extensions, not just current consumers. Lehman (1980), Second Law: without forward contracts on schema evolution, structural complexity accumulates unbounded as the system grows. Backward compatibility (1.9) protects existing consumers; forward migration contracts protect future ones. Both are required for sustainable data evolution.

### 1.14 Invariant Preservation (FM7)

Data integrity invariants SHALL hold at every program point, not just at rest. Transient/in-flight data (data being processed, queued, serialized, or transmitted between boundaries) MUST satisfy the same structural and business-rule invariants as persisted data. Any transformation, enrichment, or projection of data SHALL preserve all declared invariants of the source. If a transformation narrows an invariant (e.g., stripping optional fields), it MUST document which invariants are weakened and why.

**Why:** Hoare (1969): `{P} S {Q}` — a correct program proves that invariants hold at every statement boundary, not just at function entry/exit. Meyer (1986), Design by Contract: class invariants must be true after construction and preserved by every public method. If in-flight data can violate invariants, no consumer downstream can trust it. Invariant violations in transient state are the hardest bugs to reproduce and the most expensive to fix — they surface as silent data corruption, legal exposure, or audit failures long after the violating write.

---

## 2. Architecture

[PROJECT-SPECIFIC] — Define your architecture here. The 14 Core Principles apply regardless of your choice.

Common patterns to select from:
- **Hexagonal / Ports & Adapters** — SaaS, microservices, enterprise apps with multiple external dependencies
- **Layered (MVC)** — Traditional web apps, monoliths with clear UI/Logic/DB split
- **Pipeline (ETL)** — Data workflows, batch jobs, stream processors
- **Module / Plugin** — CLI tools, extensible libraries, SDKs
- **Single-File / Lambda** — Serverless functions, one-off scripts

Describe:
- Your chosen pattern and why it fits
- Layer names and their responsibilities
- A dependency diagram showing what can import from what
- Any exceptions to the Dependency Direction principle (1.2)

### 2.1 Dependency Rules

[PROJECT-SPECIFIC] — Define which imports are allowed and banned between your layers.

```
✅ [allowed direction]
❌ [banned direction]
```

---

## 3. Quality Gates

### 3.1 Type Safety

| Rule | Requirement |
|------|-------------|
| TypeScript strict mode | `"strict": true` in tsconfig.json |
| No `any` types | ZERO allowed (use `unknown` instead) |
| No `@ts-ignore` / `@ts-nocheck` | ZERO allowed |
| Exported functions have explicit return types | Required |
| Public APIs have explicit parameter types | Required |
| Internal functions may rely on inference | Allowed |
| `catch` variable type | `unknown` (enforced by `useUnknownInCatchVariables`) |

### 3.2 Architecture Boundaries

[PROJECT-SPECIFIC] — Define per-layer constraints based on your architecture choice.

| Rule | Requirement |
|------|-------------|
| Core defines abstractions only | Core has no implementation of external systems |
| Adapters implement Core abstractions | Adapters wrap external systems |
| Application uses abstractions, not implementations | Application doesn't know about specific adapters |
| [Add project-specific boundaries here] | |

### 3.3 Testing

| Priority | What to Test |
|----------|--------------|
| CRITICAL | Business logic that would cause data loss if broken |
| CRITICAL | Security validation and authorization |
| HIGH | Error handling and recovery paths |
| HIGH | Idempotency of write operations |
| MEDIUM | Adapter implementations (integration tests) |
| MEDIUM | Application workflows |
| LOW | UI component rendering |

### 3.4 Error Handling

| Rule | Requirement |
|------|-------------|
| No empty catch blocks | All catch blocks log or rethrow |
| All external calls have timeouts | Timeout parameter or AbortSignal present |
| External write operations idempotent | Idempotency key pattern used (if distributed) |
| Custom error types for domain errors | Errors extend base Error class |
| All errors have context | Structured metadata included in error logs |

### 3.5 Observability

| Rule | Requirement |
|------|-------------|
| All errors logged (with context) | Context includes trace ID where available |
| All external calls logged | Request/response or outcome logged |
| Critical state transitions logged | State changes logged at appropriate level |
| Log format | Structured JSON preferred |

### 3.6 Data Integrity

| Rule | Requirement |
|------|-------------|
| All external data validated at boundary | Schema validation before entering Core |
| Runtime validation library used | Zod, Yup, or equivalent |
| Types inferred from schemas | Types derived, not manually duplicated |
| Unknown fields rejected | Strict validation mode |
| Validation errors logged | Invalid data logged with context |

### 3.7 Code Hygiene

| Rule | Requirement | Justification |
|------|-------------|---------------|
| Cyclomatic complexity | ≤ 10 per function | McCabe (1976) — defect density threshold |
| Nesting depth | ≤ 3 | Cognitive load ceiling; Pyramid of Doom avoidance |
| Function length | ≤ 75 lines (soft, warn only) | Lipow (1982) — defect density accelerates after 100 lines |
| Unused code | Zero unused exports, variables, files | Knip + `@typescript-eslint/no-unused-vars` |
| Wildcard exports | `export *` FORBIDDEN | Parnas (1972) — intentional public API surfaces only |
| Risk index | ≤ 60 | `(Complexity × Lines) / 10` — NASA/JPL validated threshold |

---

## 4. Timeout Standards (Tune Per Project)

[PROJECT-SPECIFIC] — Define timeouts per external dependency. Default values should be ENV-configurable.

| Context | Default Timeout | Retries | Fallback |
|---------|----------------|---------|----------|
| External HTTP call | `[ENV]` (e.g., 10s) | [count] | [strategy] |
| Database query | `[ENV]` (e.g., 5s) | [count] | [strategy] |
| AI/LLM call | `[ENV]` (e.g., 30s) | [count] | [strategy] |
| User-facing action | `[ENV]` (e.g., 30s) | None | Show error |
| [Add per-adapter entries] | | | |

Circuit breaker: [PROJECT-SPECIFIC — N failures → open S seconds → half-open probe]

### 4.1 Idempotency Standards (Tune Per Project)

[PROJECT-SPECIFIC] — Define idempotency requirements per operation type.

| Context | Idempotency Key Source | TTL |
|---------|----------------------|-----|
| HTTP POST/PUT | `idempotency-key` header | [duration] |
| Message queue writes | `messageId` or equivalent | [duration] |
| Local operations | May skip if retry is impossible | N/A |

---

## 5. Naming Conventions

[PROJECT-SPECIFIC] — Adapt conventions to your chosen architecture. These are defaults.

### 5.1 File Naming

| File Type | Pattern | Examples |
|-----------|---------|----------|
| Core logic | `*.ts` | `SeqBuffer.ts`, `OrderCalculator.ts` |
| Ports / interfaces | `*.port.ts` | `LoggerPort.ts`, `MessageSenderPort.ts` |
| Adapters | `*.adapter.ts` | `WebSocketAdapter.ts`, `PostgresAdapter.ts` |
| Types | `*.types.ts` | `Message.types.ts` |
| Schemas | `*.schema.ts` | `Order.schema.ts` |
| Config | `*.config.ts` | `websocket.config.ts` |
| Constants | `*.constants.ts` | `Protocol.constants.ts` |
| Unit tests | `*.test.ts` | `errors.test.ts` |
| Integration tests | `*.integration.test.ts` | `websocket.integration.test.ts` |

### 5.2 Type/Interface Naming

| Pattern | When to Use | Examples |
|---------|-------------|----------|
| `*Port` | Interfaces defined by Core | `LoggerPort`, `DataStorePort` |
| `*DTO` | Data Transfer Objects | `MessageDTO`, `ToolCallDTO` |
| `*Error` | Custom errors | `ProtocolError`, `TimeoutError` |
| `*Schema` | Validation schemas | `MessageSchema` |
| `*Event` | Domain events | `OrderPlacedEvent` |

### 5.3 Function Naming

| Prefix | Meaning | Side Effects |
|--------|---------|--------------|
| `get*`, `find*` | Pure query | NO |
| `fetch*`, `send*` | External call | YES |
| `create*` | Factory / constructor | NO |
| `handle*` | Event / message handler | YES |
| `validate*` | Validation | NO (returns boolean or throws) |
| `is*` | Boolean predicate | NO |
| `calculate*` | Computation | NO |
| `parse*` | Deserialization | NO |
| `serialize*` | Serialization | NO |

### 5.4 Test Naming

| Pattern | Example |
|---------|---------|
| `should [expected] when [condition]` | `should process messages in order when out-of-order` |
| `should not [expected] when [condition]` | `should not duplicate messages when duplicates received` |

---

## 6. Error Handling

### 6.1 Error Hierarchy (Template)

```
Error
├── DomainError         // Business logic errors
│   ├── ValidationError // Invalid data
│   ├── StateError      // Invalid state transition
│   └── BusinessRuleError
├── SystemError         // Technical errors
│   ├── ConnectionError // Network/socket failures
│   ├── TimeoutError    // Operation timed out
│   └── ExternalError   // External system failure
└── FatalError          // Unrecoverable
    ├── ConfigurationError
    └── InternalError
```

### 6.2 Error Handling Rules

| Rule | Implementation |
|------|---------------|
| All errors must be typed | Custom error classes extending Error |
| All errors must be logged | Logger.error(error, context) |
| Never swallow errors | No empty catch blocks |
| Always provide context | Add identifiers to error metadata |
| Fail fast in Core | Throw DomainError immediately |
| Retry gracefully in Adapters | Retry with configurable backoff |
| Show safe messages to users | Translate errors, strip internals (1.11) |

---

## 7. Observability

### 7.1 Log Levels

| Level | When to Use |
|-------|-------------|
| **ERROR** | System failures, crashes requiring attention |
| **WARN** | Recoverable errors, timeouts, fallback activations |
| **INFO** | State changes, external calls, user actions |
| **DEBUG** | Development details, fine-grained state traces |

### 7.2 Required Logs

| What to Log | Level |
|-------------|-------|
| Application start/stop | INFO |
| External connection attempts | INFO |
| External connection failures | WARN |
| All errors | ERROR |
| State transitions | DEBUG |
| User actions | INFO |
| Idempotency key usage | DEBUG |

### 7.3 Log Format

Structured JSON is preferred:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Order processed",
  "context": { "orderId": "ord-123" },
  "traceId": "trace-xyz"
}
```

Never include PII or secrets in log context (principle 1.11).

---

## 8. Documentation Requirements (Tiered)

| Project Type | Minimum Documentation |
|--------------|----------------------|
| **All projects** | `README.md` |
| **Multi-contributor** | `README.md`, `CONTRIBUTING.md` |
| **Public / consumed by others** | `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, Architecture decisions doc |

---

## 9. Quality Gates Pipeline

[PROJECT-SPECIFIC] — Define your pre-commit and pre-merge validation.

### Pre-Commit (Fast, blocks commit)

```
[project check command]    # Architectural guards (ESLint + ArchUnit)
[project test command]     # Unit + contract tests — 0 failures
```

### Pre-Merge (Slower, blocks merge)

```
[project validate command] # Integration checks, SLA gates, RAG evaluation
```

### Operational SLA Gates (if applicable)

[PROJECT-SPECIFIC] — Define performance/correctness thresholds.

| Metric | Threshold | Window |
|--------|-----------|--------|
| [Metric name] | [Value] | [Rolling period] |

---

## 10. Legal & Compliance

[PROJECT-SPECIFIC] — Define legal and regulatory requirements. This section applies the Invariant Preservation principle (1.14) and Idempotency principle (1.8) to legal domain constraints — data retention, consent, audit, and subject-access requests. The legal requirements are project/context-dependent; the enforcement *mechanisms* (invariants, atomicity, immutable logs) are universal.

### 10.1 Data Governance

#### 10.1.1 Data Classification Tiers

All data SHALL be classified into one of:
- **Public** — safe for logs, errors, API responses
- **Internal** — not customer-facing, safe within the organization
- **Confidential** — PII, financial data, authentication secrets (encrypt at rest, redact in logs — principle 1.11)
- **Restricted** — encryption keys, root credentials (never logged, never serialized, hardware-backed where possible)

#### 10.1.2 Data Retention

[PROJECT-SPECIFIC] — Define retention schedules per entity type and classification tier.

| Entity / Data Type | Classification | Retention Period | Hard Delete After |
|--------------------|----------------|------------------|-------------------|
| [Entity name] | [Tier] | [Duration] | [Duration or "never"] |

Retention SHALL be enforced programmatically — no manual cleanup. Expired data SHALL be hard-deleted or irreversibly anonymized. Backups SHALL respect the same retention windows.

#### 10.1.3 Purpose Limitation & Consent

[PROJECT-SPECIFIC] — Define consent model and purpose binding.

Data collected for purpose X SHALL NOT be reused for purpose Y without explicit re-consent. Consent provenance SHALL be recorded with `{ timestamp, purpose, method, ip_address, user_agent }` metadata. Consent withdrawal SHALL trigger data deletion within the retention window applicable to that purpose.

### 10.2 Subject-Access & Portability (DSAR)

Every entity store SHALL expose:
- `getByOwner(ownerId)` — export all data owned by a subject (portability)
- `deleteByOwner(ownerId)` — hard-delete all records owned by a subject (right-to-erasure)
- `rectifyByOwner(ownerId, corrections)` — correct inaccurate data (right-to-rectification)

DSAR endpoints SHALL be gated behind admin authentication. All DSAR operations SHALL generate immutable audit log entries.

[PROJECT-SPECIFIC] — Define DSAR response SLA (e.g., 30 calendar days for GDPR).

### 10.3 Audit Trail

All state-changing operations on Confidential or Restricted data SHALL generate an immutable audit log entry with:

| Field | Description |
|-------|-------------|
| `actor_id` | Who performed the action |
| `actor_role` | Role at time of action |
| `action` | `create`, `read`, `update`, `delete`, `export`, `dsar_read`, `dsar_delete` |
| `entity_type` | Affected entity (table, collection, or resource type) |
| `entity_id` | Specific record identifier |
| `timestamp` | UTC ISO 8601 with millisecond precision |
| `ip_address` | Origin IP |
| `change_summary` | Human-readable diff (no PII in plaintext — use field-level indicators) |

Audit logs SHALL be append-only (no modification, no deletion). Audit retention SHALL be >= data retention of the entities being audited. Audit log integrity SHALL be verifiable (e.g., hash-chained or write-once storage).

### 10.4 Transient State Invariant Enforcement (Principle 1.14 Applied)

Data in any transient state (in-queue, mid-pipeline, serialized for transport, cached) SHALL satisfy the same invariants as its at-rest form. Specifically:

- **Pipeline checkpoints**: each step in a multi-step pipeline SHALL re-validate invariants on its output before passing to the next step
- **Queue payloads**: messages in retry/dead-letter queues SHALL be validated against the current schema version before reprocessing (schema version stored in message envelope)
- **Cache entries**: cached data SHALL carry a schema version and TTL that bounds staleness; a cache hit with a stale schema version SHALL be treated as a miss
- **Serialized state**: any serialized `JSON.stringify()` / `Buffer` transit boundary SHALL validate on deserialization before the data enters Core logic (principle 1.7)

**Why:** If invariants only hold at rest, any transient violation is a latent bug. The moment that transient data is persisted (e.g., a queue message gets written to DB on retry exhaustion), the corruption becomes permanent. Meyer (1986): "The invariant must be satisfied after creation of every instance of the class and must be preserved by every exported routine."

### 10.5 Encryption & Key Management

[PROJECT-SPECIFIC] — Define encryption standards per classification tier.

| Classification | At Rest | In Transit | Key Rotation |
|----------------|---------|------------|--------------|
| Public | None | None | N/A |
| Internal | Optional | TLS | N/A |
| Confidential | AES-256-GCM, per-row keys | TLS 1.2+ | Transparent (decrypt→re-encrypt on read) |
| Restricted | AES-256-GCM + HSM-backed | mTLS | Mandatory quarterly |

Key material SHALL never be committed to version control. Secrets SHALL be injected via environment variable or secrets manager — never hardcoded.

---

## 11. Governance

This constitution supersedes all other project practices and conventions. Any deviation from a constitutional principle MUST be documented with justification.

### Amendment Procedure

1. Propose change with justification
2. Review against all 14 Core Principles for regressions
3. Update constitution version (MAJOR: principle change, MINOR: new section, PATCH: clarification)
4. Propagate changes to dependent artifacts (plan, spec, tasks)
5. Re-validate existing features against amended constitution

### Compliance

- Every feature branch MUST pass pre-commit gates
- Every merge to main MUST pass pre-merge gates
- Constitution violations discovered post-merge SHALL be treated as P1 bugs

### Version

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | [DATE] | Initial adoption |

**Approved By:** [TEAM]

**Effective Date:** [DATE]

---

## 12. Performance Engineering & Resource Capacity

### 12.1 Algorithmic Complexity Ceilings

Core functions that operate on collections SHALL document their worst-case time complexity. The following ceilings apply:

| Operation Context | Max Complexity | Rationale |
|---|---|---|
| Hot-path query/transformation | O(n log n) | Merge-sort bound; anything quadratic breaks at scale |
| Cold-path / admin operations | O(n²) | Acceptable if n is bounded and documented |
| Startup/init paths | O(n) | Must not block process launch |

Functions exceeding these ceilings SHALL carry a `ponytail:` comment naming the bound and the upgrade path.

#### 12.1.1 Database Query Execution Plans

All queries against production-sized datasets SHALL be reviewed for execution-plan regressions. Full-table scans (Seq Scan on PostgreSQL, AllNodesScan on Neo4j) on tables > 10K rows are FORBIDDEN. Missing-index queries SHALL be treated as P2 bugs.

### 12.2 Benchmark Gates

Critical-path operations SHALL have benchmark tests asserting per-operation latency:

| Operation Type | Max P95 Latency | Measurement |
|---|---|---|
| Core transformation (pure) | < 1ms | Node.js `performance.now()` |
| Adapter I/O (cached hit) | < 5ms | Same |
| Adapter I/O (external call) | < upstream timeout | Per Section 4 |

Benchmarks SHALL be reproducible (fixed seed data, controlled environment). A benchmark regression SHALL block the merge if the P95 exceeds 2× the ceiling.

### 12.3 Resource Capacity & Backpressure

#### 12.3.1 Connection Pool Hard Maximums

All external resource pools SHALL declare hard maximums. Exceeding the maximum SHALL reject with a typed error — never queue indefinitely:

| Resource | Hard Max | Exceed Behavior |
|---|---|---|
| Database connections | [PROJECT-SPECIFIC] | Reject new request, return 503 |
| HTTP connection pool (per host) | [PROJECT-SPECIFIC] | Same |
| Redis/message queue connections | [PROJECT-SPECIFIC] | Same |
| Worker thread pool | [PROJECT-SPECIFIC] | Same |

#### 12.3.2 Backpressure Thresholds

Request queues SHALL implement backpressure: when queue depth exceeds 80% of capacity, the system SHALL reject new inbound work with HTTP 503 (or equivalent protocol signal) rather than accepting work it cannot complete. This is not optional — unbounded queues under load are indistinguishable from a memory leak.

#### 12.3.3 Memory & Heap Ceilings

The process SHALL declare a maximum heap size via `--max-old-space-size` or equivalent. Health checks SHALL report `process.memoryUsage().heapUsed / heapTotal` and signal DEGRADED when heap usage exceeds 85%. Memory leaks (monotonic heap growth over 24h under stable load) SHALL be treated as P1 bugs.

**Why (Section 12):** Knuth (1973): "Premature optimization is the root of all evil" — but *no* optimization guarantees the root of all incidents. Queuing theory (Little's Law): unbounded queues under steady load grow without bound. Every production system needs a defined capacity envelope and a defined behavior when that envelope is exceeded.

---

## 13. Production Operations & Resilience

### 13.1 Distributed Consensus & Fencing

All write operations that can be issued by multiple instances SHALL carry a **fencing token** (monotonic lease/generation number). The storage layer SHALL reject writes with stale fencing tokens. This prevents split-brain scenarios where a zombie node believes it is still the leader.

| Requirement | Implementation |
|---|---|
| Fencing token on all writes | Monotonic integer, checked at storage boundary |
| Leader election | [PROJECT-SPECIFIC — e.g., PostgreSQL advisory lock, Redis Redlock, Raft] |
| Quorum writes | W > N/2 (majority confirmation before ack) |

### 13.2 Deployment Strategy

#### 13.2.1 Blue-Green & Rollback

Every deployment SHALL support rollback to the previous version without data loss. Database migrations SHALL be backward-compatible for at least **2 versions** (the current version can run against the previous version's schema). Column drops and type changes SHALL follow expand-migrate-contract (Section 1.13).

#### 13.2.2 Feature Flags

Risky or high-impact logic SHALL be gated behind feature flags. A feature flag SHALL be:
- Toggleable at runtime (no deploy required to disable)
- Scoped to a percentage of traffic (0% → 5% → 50% → 100%)
- Removed within one release cycle after full rollout (no flag graveyards)

#### 13.2.3 Canary Deployment

Production deployments SHALL follow a canary pattern: [PROJECT-SPECIFIC — e.g., 5% traffic for 1 hour] before full rollout. If error rate, P95 latency, or circuit-breaker-open count exceeds baseline during the canary window, the deployment SHALL be automatically rolled back.

### 13.3 Property-Based Testing (Fuzzing)

All Core invariants SHALL be validated with property-based tests — not just hand-coded examples. Each invariant SHALL be tested against **10,000+ randomly generated inputs** covering edge cases (empty, max-length, unicode, negative, zero, boundary ±1).

| Invariant Type | Property to Hold |
|---|---|
| Serialization roundtrip | `parse(serialize(x)) === x` for all valid x |
| Idempotency | `f(f(x)) === f(x)` for all x in domain |
| Invariant preservation | `∀ x: invariant(x) ⟹ invariant(transform(x))` |
| Comparison | `a ≤ b ⟹ compare(a, b) ≤ 0` |

[PROJECT-SPECIFIC] — Recommended: fast-check (JS/TS), Hypothesis (Python), or equivalent. Minimum 10K runs per invariant.

**Why:** Dijkstra (1972): testing shows bugs but never their absence. Property-based testing bridges the gap between example-based tests (finite) and formal proofs (often impractical) by validating invariants against randomized search spaces. It finds the edge cases you didn't think to write.

### 13.4 Full Observability (RED Metrics)

Section 7 (Observability) covers log levels and required log events. This section extends it with quantitative metrics.

#### 13.4.1 RED Metrics Per External Call

Every external adapter call SHALL export:

| Metric | Definition | Alert Threshold |
|---|---|---|
| **Rate** | Calls per second | Deviation > 3σ from 7-day baseline |
| **Errors** | Error ratio (errors / total) | > 1% over 5-minute window |
| **Duration** | P50, P95, P99 latency | P95 > 2× baseline |

#### 13.4.2 Distributed Tracing

All spans SHALL propagate **W3C TraceContext** headers (`traceparent`, `tracestate`). No custom trace ID format — W3C standard only. Every inbound request that carries a `traceparent` header SHALL continue that trace; requests without one SHALL start a new trace.

#### 13.4.3 SLO Error Budgets

Each service boundary SHALL define an SLO with error budget:

| Service | SLO Target | Error Budget (monthly) | Burn Rate Alert |
|---|---|---|---|
| [PROJECT-SPECIFIC] | 99.9% availability | 43.2 minutes downtime/month | > 5% budget burned in 1 hour |

When the error budget is exhausted, feature velocity SHALL freeze until reliability is restored. This is non-negotiable — shipping features while burning through SLO budget is trading reliability debt for feature velocity.

### 13.5 Supply Chain Security

#### 13.5.1 SBOM Requirement

Every build SHALL produce a **Software Bill of Materials** (SBOM) in SPDX or CycloneDX format listing all dependencies with versions and licenses. The SBOM SHALL be archived alongside the build artifact.

#### 13.5.2 CVE Scanning

Dependency scans SHALL run on every build. Any dependency with a **Critical** or **High** CVE (CVSS >= 7.0) SHALL block the build. Known false positives SHALL be documented in a `.cve-suppressions.json` file with justification and expiry date (max 30 days).

#### 13.5.3 License Compliance

All dependencies SHALL have known, allowed licenses. Licenses requiring legal review (GPL, AGPL, SSPL) SHALL be pre-approved before inclusion. The allowed-license list SHALL be defined in [PROJECT-SPECIFIC — e.g., `.allowed-licenses.json`].

### 13.6 Disaster Recovery

#### 13.6.1 RPO & RTO

| Metric | Target | Definition |
|---|---|---|
| **RPO** (Recovery Point Objective) | [PROJECT-SPECIFIC — e.g., 5 minutes] | Maximum acceptable data loss (time since last backup) |
| **RTO** (Recovery Time Objective) | [PROJECT-SPECIFIC — e.g., 15 minutes] | Maximum acceptable time to restore service |

Backup frequency and replication strategy SHALL be derived from RPO, not the reverse. If RPO = 5 minutes, continuous WAL archiving or streaming replication is required — daily snapshots are insufficient.

#### 13.6.2 Failover Drills

Staged failover SHALL be exercised quarterly on staging. A drill is only successful if the system recovers within RTO with <= RPO data loss. Failed drills SHALL generate P1 postmortems with corrective actions tracked to completion.

### 13.7 Configuration Integrity

#### 13.7.1 JSON-Schema Configuration Validation

All configuration (environment variables, config files, feature flags) SHALL be validated against a JSON Schema at process startup. Invalid configuration SHALL crash the process immediately with a diagnostic message identifying the invalid key, expected type, and actual value. The system MUST never start in a misconfigured state.

#### 13.7.2 Environment Parity

Dev, staging, and production SHALL have **structurally identical** configuration schemas. Only values differ between environments. A config key present in production but absent in dev is FORBIDDEN — it guarantees the bug will be discovered in production. Environment-specific defaults SHALL be documented in a single `config.schema.ts` or equivalent.

**Why (Section 13):** These seven sub-domains (fencing, deployment, property testing, RED metrics, supply chain, DR, config) are not optional polish — they are the difference between "code that works on a developer's machine" and "a system that survives the real world." Gray (1986): "Good systems are designed to work despite faults, not just in their absence." Brewer (CAP, 2000): distributed systems MUST make explicit tradeoffs between consistency and availability — fencing tokens and quorum writes make that tradeoff explicit and correct.
