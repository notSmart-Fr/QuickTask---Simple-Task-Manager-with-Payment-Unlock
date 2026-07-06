# Whitebox Methodology — Any Project, Any Language

The single source of truth for making any codebase navigably comprehensible without reading every line. This is a **discovery methodology**, not a checklist — it produces understanding regardless of whether the project has documentation.

---

## Part 0: The Two Instruments

This methodology has two instruments with different purposes:

| Instrument | Duration | Purpose | Output |
|:---|:---|:---|:---|
| **7-Pillar Triage** | 90 seconds | Decide if the project is worth studying at all | Verdict: Whitebox / Suspicious / Blackhole |
| **6-Question Archaeology** | 30 minutes | Reconstruct the mental model of the system | `.knowledge/` artifacts |

The triage is a smell detector — high false-positive tolerance is acceptable because it only gates whether you invest 30 minutes. The archaeology is the actual comprehension tool.

---

## Part 1: 7-Pillar Triage (90 Seconds)

Run these 7 file-system scans. Each takes ~5 seconds. They require no language knowledge (Pillars 5-7) or minimal pattern recognition (Pillars 1-4). The goal is to catch production disasters before they happen.

### Pillar 1 — Perimeter (Data)

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Input validation at boundary | Grep route files for validation patterns (`.parse(`, `Zod`, `Pydantic`, struct tags, `@Valid`) | Every external input passes through a schema validator | Raw `req.body` flows into internal logic |

### Pillar 2 — Core (Purity)

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Core logic free of infrastructure | Open a "service" or "domain" file. Check top 5 imports | Only domain/math/utility imports | Imports `sql`, `axios`, `aws-sdk`, `os` directly |

**Caveat:** Importing an *interface* of a DB client is fine (dependency injection). Importing the *concrete driver* is the smell.

### Pillar 3 — Polarity (Inversion)

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Dependency direction | Folder tree: does the "infrastructure" or "adapter" layer import from "domain" or "core"? | Core owns the contract; adapters implement it | Domain imports infrastructure (e.g., `core/` imports `postgres-driver`) |

### Pillar 4 — Resilience

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Graceful shutdown | Grep entrypoint for SIGTERM/SIGINT handler | Signal handler exists with connection drain | No handler — hard kill on deploy |
| Atomic writes | Grep DB access layer for transaction wrappers (`BEGIN/COMMIT`, `transaction(`, `tx.`) | Multi-statement writes are transactional | Fire-and-forget writes |

### Pillar 5 — Security

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Hardcoded secrets | `grep -r "BEGIN.*PRIVATE KEY\|AKIA\|sk-[a-zA-Z0-9]\|password\s*=\s*['\"]" --exclude-dir=.git --exclude=*.lock` | Zero matches | API keys, private keys, or passwords in source |

**Note:** This grep pattern is syntax-agnostic. Private keys, AWS access keys, and OpenAI keys have the same format in every language.

### Pillar 6 — State Evolution

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Reversible migrations | Open `/migrations` folder. Check for `down`/`rollback` functions or SQL files | Every `up` has a corresponding `down` | Only `up` exists — one-way ticket |

### Pillar 7 — Observability

| Check | Action | Whitebox | Blackhole |
|:---|:---|:---|:---|
| Health endpoint | Grep for `/health`, `/ready`, or `/live` route registration | Endpoint exists and returns 200 without DB dependency | Missing — orchestrator can't drain traffic safely |
| Structured logging | Grep for PII masking in logger config (`mask`, `sanitize`, `filter`, `redact`, `omit`) | Sensitive fields redacted before log stream | Raw payloads dumped to stdout |
| Tracing | Grep for span/trace creation (`startSpan`, `startActiveSpan`, `@Span`, `tracing::`) | Distributed tracing instrumented | No trace context across service boundaries |

### Triage Verdict Table

| Pillars Passed | Verdict | Action |
|:---|:---|:---|
| 7/7 | Whitebox | Proceed to archaeology with high confidence |
| 5-6/7 | Suspicious | Archaeology will reveal if the gaps are real or false alarms |
| 3-4/7 | Risky | Worth archaeology only if the project is critical |
| 0-2/7 | Blackhole | Report findings; do not invest further time |

---

## Part 2: 6-Question Archaeology (30 Minutes)

This is the real comprehension tool. Answer these 6 questions for any project, documented or not. The questions are the constant; how you answer them varies.

### Q1: What Talks to What? (Dependency Graph)

**Goal:** Map the inter-module import graph.

**Method:**
1. Find the entrypoint (`main.go`, `index.ts`, `__main__.py`, `src/main.rs`)
2. Follow imports one hop at a time
3. Only map imports that cross layer boundaries (skip `./utils`, `./helpers`)
4. Stop at external boundaries (`postgres`, `redis`, `stripe`, `aws-sdk`)

**Output:** A scratch file like:

```
entrypoint.ts
  → ./app → ./config, ./middleware/auth, ./routes/*
    → ./routes/users → ./services/userService, ./db/userRepo
      → ./db/userRepo → ./db/pool (postgres)
    → ./routes/orders → ./services/orderService, ./db/orderRepo, ./services/userService
```

**What it reveals:** Layering (or lack of it), shared dependencies, trust boundary count.

---

### Q2: What Shape Is the Data? (Contracts)

**Goal:** Extract type/schema/interface definitions.

**Method:** Grep for the language's type definition patterns (see Part 3 cheat sheet). List every named type.

**Output:**

```
User { id: string, email: string, role: Role }
Order { id: string, userId: string, items: OrderItem[], status: OrderStatus }
CreateOrderRequest { userId: string, items: OrderItem[] }
```

**What it reveals:** What flows between modules, what each function expects and returns, without reading function bodies.

---

### Q3: What Can Fail? (Trust Boundaries)

**Goal:** Count and categorize every external call.

**Method:** Grep for external I/O patterns (`fetch(`, `db.query(`, `redis.connect(`, `grpc.`, `pubsub.`). Each match is a failure mode.

**Output:**

```
External surface:
  - Postgres (via db/pool.ts) — connection loss, query timeout, constraint violation
  - Redis (via cache/client.ts) — connection loss, eviction
  - Stripe API (via billing/stripe.ts) — auth failure, rate limit, webhook mismatch
  - SendGrid (via notifications/email.ts) — auth failure, rate limit
```

**What it reveals:** The blast radius of each infrastructure failure. No circuit breaker on Stripe calls = every payment failure crashes the process.

---

### Q4: How Does It Start, Run, and Stop? (Lifecycle)

**Goal:** Trace the full lifecycle of one process.

**Method:**
1. Read the entrypoint — what happens before the server listens?
2. Grep for SIGTERM/SIGINT — is there graceful shutdown?
3. Grep for `/health` or `/ready` — can the orchestrator probe this?
4. Check config loading — does it fail-fast on missing env vars?

**Output:**

```
Lifecycle:
  START: load config → validate env → connect DB → connect Redis → listen :3000
  RUN:   accept request → middleware chain → route → service → DB → response
  STOP:  SIGTERM → stop accepting → drain in-flight → close DB → close Redis → exit 0
  PROBE: GET /health → 200 (no DB check)
```

**What it reveals:** Cold start behavior, crash recovery, deploy safety.

---

### Q5: What Secrets Does It Need? (Config Surface)

**Goal:** Enumerate every external credential and how it's referenced.

**Method:**
1. Open the config file or `.env.example`
2. List every environment variable
3. Categorize: credential, endpoint URL, feature flag, operational tuning

**Output:**

```
DATABASE_URL          — Postgres connection string (credential)
REDIS_URL             — Redis connection string (credential)
STRIPE_SECRET_KEY     — Stripe API key (credential)
OPENAI_API_KEY        — OpenAI API key (credential)
LOG_LEVEL             — Operational tuning (info|debug|error)
MAX_RETRIES           — Operational tuning (default: 3)
```

**What it reveals:** The external dependency surface. If a project has 3 secrets and 12 env vars, you know exactly what it connects to.

---

### Q6: Can I Undo a Deploy? (State Evolution)

**Goal:** Verify database changes are reversible.

**Method:**
1. Open the `/migrations` folder
2. Check if `down`/`rollback` exists for every `up`
3. If no migrations folder: check for ORM-managed schemas (Prisma, Alembic, ActiveRecord) — can you generate a rollback?

**Output:**

```
Migrations:
  migrations/001_create_users/up.sql     ← has down.sql? YES
  migrations/002_add_orders/up.sql       ← has down.sql? YES
  migrations/003_drop_legacy/up.sql      ← has down.sql? NO — DANGER
```

**What it reveals:** Whether a bad deploy requires manual DB surgery or a one-command rollback.

---

## Part 3: Per-Language Cheat Sheet

The 6 questions are language-agnostic. The patterns you grep for are not. This table maps the question to the concrete pattern per language.

| Question | TypeScript/Node | Python | Go | Rust | Java/Kotlin |
|:---|:---|:---|:---|:---|:---|
| **Entry point** | `index.ts`, `main.ts` | `__main__.py`, `app.py` | `cmd/*/main.go` | `src/main.rs` | `Application.java` |
| **Input validation** | `z.object(`, `.parse(`, `.safeParse(` | `BaseModel`, `@dataclass`, `pydantic` | `struct` tags, `validator` | `#[derive(Deserialize)]`, `serde` | `@Valid`, `@RequestBody` |
| **Route registration** | `app.get(`, `router.get(` | `@app.route`, `@router.get` | `mux.HandleFunc`, `r.Get(` | `#[get("/")]`, `actix_web::` | `@GetMapping`, `@RequestMapping` |
| **DB access** | `createClient(`, `Pool`, `drizzle` | `create_engine`, `Session` | `sql.Open(`, `sqlx.Connect(` | `sqlx::`, `diesel::` | `@Repository`, `DataSource` |
| **Graceful shutdown** | `process.on('SIGTERM')` | `signal.signal(SIGTERM)` | `signal.NotifyContext` | `tokio::signal`, `ctrl_c()` | `@PreDestroy`, `Runtime.addShutdownHook` |
| **Health endpoint** | `app.get('/health')` | `@app.get('/health')` | `/health` or `/ready` handler | `health_check()` route | `/actuator/health` (Spring) |
| **Secret reference** | `process.env.` | `os.environ`, `os.getenv` | `os.Getenv` | `std::env::var` | `System.getenv`, `@Value` |
| **Migration tool** | `drizzle-kit`, `prisma` | `alembic` | `golang-migrate`, `goose` | `sqlx migrate`, `diesel` | `flyway`, `liquibase` |
| **Type definition** | `interface `, `type ` | `class.*BaseModel`, `TypedDict` | `type.*struct`, `interface {` | `struct `, `enum `, `impl ` | `class `, `record `, `data class` |
| **External I/O** | `fetch(`, `axios.`, `db.query(` | `requests.`, `httpx.`, `session.execute(` | `http.Get(`, `client.Do(`, `db.Query(` | `reqwest::`, `sqlx::query(` | `RestTemplate`, `WebClient`, `@FeignClient` |
| **Tracing** | `startActiveSpan`, `startSpan` | `@tracer.start_as_current_span` | `otel.Tracer`, `span.Start` | `tracing::span`, `#[tracing::instrument]` | `@Span`, `@Observed` |
| **Transaction wrapper** | `transaction(`, `.transaction(` | `session.begin()`, `async with session` | `tx, err := db.Begin()`, `sqlx.Tx` | `pool.begin().await`, `diesel::connection.transaction` | `@Transactional` |
| **PII masking** | Logging interceptors, `sanitize`, `mask` | `logging.Filter`, `log_record.getMessage` | `slog`, middleware wrappers | `tracing-subscriber` layer | `logging.level.*.filter` |

---

## Part 4: Artifact Production

The archaeology produces 3 files in `.knowledge/`. These are **discovery artifacts** — write them as you explore, not after.

### architecture.md

```markdown
# Project X — Reconstructed Architecture

## What It Is
[One-sentence summary from entrypoint + dependencies]

## Stack
[From package.json / go.mod / Cargo.toml]

## Layer Model
[ASCII diagram from Q1 dependency graph]

## Data Flow
[One endpoint traced end-to-end]

## External Dependencies
[From Q5 config surface]

## Known Gaps
[What you couldn't figure out]
```

### code-map.md

```markdown
# Project X — Code Map

## Flow 1: [Primary Use Case]
[Step-by-step trace through files, from Q1 + Q4]

## Flow 2: [Secondary Use Case]
[Another trace]
```

### data-flow/[feature].md

```markdown
# [Feature Name] — End-to-End Trace

Request shape: [From Q2 contracts]
Entry: [Route file, from Q1]
Middleware: [Auth, validation, rate limiting, from Q1]
Service: [Business logic, from Q1]
Repository: [DB access, from Q1]
Response shape: [From Q2 contracts]
Failure modes: [From Q3 trust boundaries]
```

---

## Part 5: Verification (The Behavioral Probe)

The 7-pillar triage and 6-question archaeology are **static** — they examine code structure without executing it. Static analysis catches structural failure modes (missing validation, wrong dependency direction, leaked secrets). It cannot catch logic errors: a function that validates input but computes the wrong result, or a pipeline that preserves invariants structurally but corrupts data semantically.

Behavioral verification closes that gap. Run at least one probe. The choice depends on what the system accepts and produces.

---

### Probe 1: Fuzzing (Unknown-Input Sanity)

**What it tests:** Does the system survive malformed input without crashing?

**Method:**

1. Extract every contract shape from Q2 (request bodies, query params, headers, WebSocket messages)
2. Generate valid payloads from the schemas
3. Mutate 10% of fields per payload: wrong types, overflow values, empty strings, Unicode edge cases, nulls where required, duplicates in arrays
4. Feed each payload to every entrypoint found in Q4
5. Record any non-2xx response, crash, or hang

**Pass condition:** 10,000 fuzzed inputs → zero crashes (5xx errors are crashes; 4xx errors are correct rejection)

**What it catches per pillar:**

| Pillar | Fuzzing exposes |
|:---|:---|
| P1 (Perimeter) | Missing or incomplete validation — raw input reaches internal logic |
| P4 (Resilience) | Unhandled exceptions in response path (no try/catch around external calls) |
| P7 (Observability) | Crash leaves no trace — process dies without error log |

**Limitation:** Fuzzing proves absence of crashes, not correctness. A validated-but-wrong result passes the fuzzer.

---

### Probe 2: Golden Master (Known-Input Regression)

**What it tests:** Does known input produce the same output as the last known-good version?

**Method:**

1. Craft one representative payload per entrypoint — the "happy path" input
2. Capture the full response: status, headers, body, any side-effect records
3. Store as a snapshot (JSON, not a screenshot)
4. On any structural change, re-run the same payloads and diff against snapshots
5. Any diff is either a deliberate behavior change (update the snapshot) or a regression (revert the change)

**Pass condition:** All snapshots match, or every diff has a documented reason.

**What it catches per pillar:**

| Pillar | Golden master exposes |
|:---|:---|
| P2 (Core Purity) | Infrastructure change altered business logic output |
| P6 (State Evolution) | Schema migration changed query results |
| P7 (Observability) | Response format changed without version bump |

**Limitation:** Golden master tests exactly one path per entrypoint. It does not test edge cases, error paths, or combinatorial state.

---

### Probe 3: Property-Based Invariants (Shape-Preserving Randomness)

**What it tests:** Do the invariants discovered in Q2 hold for all valid inputs, not just the happy path?

**Method:**

1. Identify a property that must hold for all inputs — e.g., "response.id always matches request.id", "total = sum(items)", "status transitions are monotonic"
2. Generate random valid inputs from the Q2 contracts
3. Assert the property for each run
4. The generator shrinks failing inputs to the minimal counterexample

**Pass condition:** Property holds for N runs (N = 100 for fast functions, 1,000 for CI, 10,000 for overnight)

**What it catches per pillar:**

| Pillar | Property testing exposes |
|:---|:---|
| P2 (Core Purity) | Logic error that only manifests at edge values (e.g., integer overflow at 2^31) |
| P6 (State Evolution) | Invariant violation during concurrent mutations |
| P7 (Observability) | Idempotency break — same input twice produces different state |

**Key difference from fuzzing:** Fuzzing checks "doesn't crash." Property testing checks "always correct." A fuzzer passes on a function that returns `null` for every input. A property test fails.

---

### Probe 4: Contract Verification (Schema-Conformance Check)

**What it tests:** Do the Q2 contracts match what the system actually sends and receives?

**Method:**

1. Take every type/interface/schema extracted in Q2
2. Instrument entrypoints to capture actual request/response payloads at runtime
3. Validate captured payloads against the extracted schemas — in both directions:
   - **Inbound:** Do real requests conform to the declared request schema?
   - **Outbound:** Do real responses conform to the declared response schema?

**Pass condition:** Zero schema violations in N captured payloads, where N covers every endpoint × every status code.

**What it catches per pillar:**

| Pillar | Contract verification exposes |
|:---|:---|
| P1 (Perimeter) | Undocumented fields flowing through the system (validation gap) |
| P3 (Polarity) | Adapter returning shapes that don't match the port contract |
| P2 (Core Purity) | Type drift — the code says `User` but the DB returns `{ ...extraFields }` |

**Limitation:** Catches shape mismatches, not semantic errors. A response with the right shape and wrong values passes.

---

### Probe 5: Chaos Injection (Failure-Mode Exercise)

**What it tests:** Do the resilience patterns found in Pillar 4 actually work under real failure?

**Method:**

1. From Q3 trust boundaries, list every external dependency
2. For each dependency, inject one failure at a time:
   - **Latency:** Add 15s delay to DB calls (exceeds the declared timeout)
   - **Error:** Return 500 from external API
   - **Disconnect:** Kill the connection pool mid-request
   - **Partial:** Return truncated response
3. Observe: does the system degrade gracefully, return a coherent error, or crash?

**Pass condition:** Every injected failure produces either a degraded-but-correct response or a well-formed error. No crash, no hang, no partial state written.

**What it catches per pillar:**

| Pillar | Chaos injection exposes |
|:---|:---|
| P4 (Resilience) | Missing circuit breaker, missing timeout → process hang |
| P5 (Security) | Error response leaks stack traces, connection strings, or PII |
| P6 (State Evolution) | Failed write leaves partial state (missing rollback) |

---

### Probe 6: Trace Validation (Observability Audit)

**What it tests:** Does every external call produce a trace span? Do error paths log?

**Method:**

1. Send one request through every entrypoint
2. Collect all trace spans emitted
3. For each external call found in Q3, verify a corresponding span exists
4. Trigger an error path (invalid input, timeout) and verify the error is logged with a trace ID

**Pass condition:** Every external call has a span. Every error path produces a log entry with trace context.

**What it catches per pillar:**

| Pillar | Trace validation exposes |
|:---|:---|
| P7 (Observability) | Dark calls — external I/O with no span, invisible to debugging |
| P5 (Security) | Error logs containing raw request bodies (PII leak) |

---

### Decision Matrix: Which Probe When?

| You have... | You can run... | Start with... |
|:---|:---|:---|
| Only schemas from Q2, no runtime access | Contract verification (validate schemas against themselves for consistency) | Contract shapes only |
| Runtime access, 5 minutes | Fuzzing (10,000 random payloads against one endpoint) | The highest-traffic entrypoint |
| Runtime access, 30 minutes | Golden master (1 snapshot per entrypoint) + fuzzing (all entrypoints) | Golden master first (baseline), fuzz second |
| Runtime access, 2 hours | All of the above + property tests on 3 core invariants | Golden master → fuzzing → properties |
| Full CI pipeline | Golden master on every PR, fuzzing nightly, chaos injection weekly | Golden master gates merge; fuzzing catches regressions |

---

### Verification Verdict

Combine with the triage verdict from Part 1:

| Triage Verdict | + Verification Result | = Final Verdict |
|:---|:---|:---|
| Whitebox (7/7) | All probes pass | **Certified Whitebox** — structure and behavior are both correct |
| Whitebox (7/7) | Probes fail | **Fragile Whitebox** — well-structured but buggy; fix the logic, not the architecture |
| Suspicious (5-6/7) | All probes pass | **Lucky** — the gaps exist but don't manifest in tested paths; monitor closely |
| Suspicious (5-6/7) | Probes fail | **Expected** — the structural gaps have behavioral consequences; fix the structure first |
| Risky (3-4/7) | Any result | **High Risk** — structural debt is too deep for verification to salvage; triage is the bottleneck |
| Blackhole (0-2/7) | Any result | **Do Not Deploy** — no amount of verification compensates for absent foundations |

A project is only a **genuine whitebox** when both static structure (7/7 pillars) and behavioral verification (probes pass) converge. Either alone is incomplete.

---

## Part 6: Integration With ArchGuard

This methodology is the **human-facing discovery layer**. ArchGuard is the **machine-enforceable invariant layer**. They complement, not duplicate.

| Concern | Whitebox Methodology | ArchGuard |
|:---|:---|:---|
| **Purpose** | Understand any project | Enforce invariants in this project |
| **Scope** | Any language, any project | TypeScript/Node projects |
| **Output** | `.knowledge/` artifacts (mental model) | ESLint rules + ArchUnit tests (guardrails) |
| **Runtime** | Manual discovery (30 min) | Automated CI check (seconds) |
| **Questions answered** | What talks to what? What shape is data? | Does FM1-FM7 exist anywhere? |

The 7 Failure Modes in ArchGuard (FM1-FM7) map directly to the 7-Pillar triage:

| ArchGuard FM | Triage Pillar | Shared Invariant |
|:---|:---|:---|
| FM1 (Trusts Input) | Pillar 1 (Perimeter) | Validation at boundary |
| FM2 (Inverts Dependencies) | Pillar 3 (Polarity) | Dependency direction |
| FM3 (Leaks State) | Pillar 5 (Security) + Pillar 7 (Observability) | No PII in output surfaces |
| FM4 (Ignores Failure) | Pillar 4 (Resilience) | Circuit breakers + timeouts |
| FM5 (Skips Cleanup) | Pillar 4 (Resilience) | Resource lifecycle |
| FM6 (Writes Partial State) | Pillar 4 (Resilience) + Pillar 6 (State Evolution) | Atomicity |
| FM7 (Corrupts In-Flight State) | Pillar 2 (Core Purity) + Pillar 6 (State Evolution) | Invariants preserved through all data flows |

---

## Part 7: The Complete Verdict

A project is a **genuine whitebox** when you possess:

1. **Structural truth** (Pillars 1-4) — the code is organized into layers with correct dependency direction
2. **Security truth** (Pillar 5) — no secrets in the source tree
3. **Evolutionary truth** (Pillar 6) — database changes are reversible
4. **Operational truth** (Pillar 7) — the system is observable and orchestrator-ready
5. **Behavioral truth** (6 probes: fuzzing, golden master, property tests, contract verification, chaos injection, trace validation) — the logic produces correct outputs under all conditions
6. **Documented truth** (`.knowledge/` artifacts) — the mental model is written down, not in one person's head

You can open any repository, spend **90 seconds** on triage to decide if it's worth studying, then **30 minutes** on archaeology to produce a navigable mental model. That is the whitebox methodology.
