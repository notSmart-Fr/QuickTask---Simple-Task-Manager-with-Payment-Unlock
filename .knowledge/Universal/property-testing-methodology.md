# Property Testing Methodology

When to use property-based testing, what to test, and what to skip — grounded in CS theory and connected to the Whitebox Methodology's verification probes.

---

## Part 1: Theoretical Foundation

### The Exhaustion Problem

A deterministic unit test asserts: `f(3) === 9`. It proves correctness for one input. It does not prove correctness for any other input. To exhaustively test `f: int → int`, you'd need 2^32 tests *per function*. This is the **sampling problem** — you're sampling correctness, not proving it.

The standard solution is **partition testing** — hand-pick inputs at boundaries (0, -1, MAX_INT, NaN). This works when you know all the boundaries. It fails when you don't.

### The Schönfinkel-Curry Insight

A property test asserts something stronger:

```
∀ x ∈ Int, x > 0: sqrt(x)² ≈ x (within ε)
```

This is a **universal quantification** over an infinite domain. The generator produces random values of `x`, the property function returns a boolean, and the framework shrinks counterexamples to minimal form.

The CS theory connecting this to testing comes from two directions:

| Source | Insight |
|:---|:---|
| **QuickCheck (Claessen & Hughes, 2000)** | Random generation + shrinking = practical exhaustive testing for algebraic data types |
| **SmallCheck / Lazy SmallCheck (Runciman et al., 2008)** | Exhaustive enumeration of small values catches edge cases that random sampling misses |
| **Feat / SciFe (Duregård et al., 2012-2017)** | Functional enumeration of algebraic data types produces exhaustive test suites from type definitions alone |
| **Hedgehog (Stanley et al., 2017)** | Integrated shrinking (shrink during generation) vs. type-directed shrinking (shrink after failure) |
| **Hypothesis (MacIver et al., 2015+)** | "The property is the spec" — database-backed shrinking, stateful testing, and Ghostwriter for automatic test generation |

The practical takeaway: property tests bridge the gap between "test a few cases" and "prove the algorithm correct." They don't prove — that's what formal verification is for. But they find the counterexample faster than any human can guess.

### What Property Tests Can't Do

Property tests have a fundamental limitation: **the property function must be decidable.** You cannot property-test "the LLM response was helpful" because you can't write a boolean function for helpfulness. You cannot property-test "the UI looks correct" because visual correctness is not mechanically decidable.

This means property testing works for:

- **Pure functions** — same input → same output (sanitizer, schema validation)
- **State machines with observable state** — circuit breaker, rate limiter
- **Algebraic laws** — idempotency, associativity, commutativity, round-trip (serialize → deserialize → serialize)
- **Structural invariants** — "response always has a `text` field", "metadata.degraded is always a boolean"

And fails for:

- **Non-deterministic systems** — LLM responses, random number generators (without seeding)
- **Perceptual correctness** — "the image looks sharp," "the audio is clear"
- **Emergent behavior** — "the system is usable," "the user is satisfied"
- **Unbounded side effects** — file system state, database state (can be modeled but requires cleanup)

---

## Part 2: When to Property Test vs. When to Skip

### Property-Testable (Yes)

| Condition | Example from this project | Why property testing works |
|:---|:---|:---|
| Input domain is algebraic (finite enumerable types, integers, strings) | Zod schema validation, rate limiter counters | Generators can produce exhaustive coverage |
| Invariant is mechanically checkable | "sanitize output has no raw phone numbers" | Boolean function, no ambiguity |
| State transitions are discrete and observable | Circuit breaker CLOSED→OPEN→HALF_OPEN→CLOSED | Every state is a string enum |
| Idempotency holds | `sanitize(sanitize(x)) === sanitize(x)` | Algebraic law with clear truth condition |
| PII stripping is exhaustive | "no PII key survives sanitization" | Closed set of forbidden keys |

### Deterministic-Only (No)

| Condition | Why property testing doesn't help | What to use instead |
|:---|:---|:---|
| The function is just wiring (ports.ts, factory functions) | No logic to verify beyond "it instantiates" | One deterministic "it creates without crashing" test |
| The correctness condition is "calls were made with right args" | Requires mocking — destroys the randomness benefit | Deterministic tests with spies |
| The behavior depends on external state (DB rows, file contents) | Generator can't control external state reliably | Integration tests with fixtures |
| The invariant is "response time < X ms" | Timing is environmental, not algebraic | Benchmark harness, not test suite |
| The output is non-deterministic by design | LLM text, random ID generation | Contract test (shape check) + manual review |

### The Heuristic

> **Property test when the function can be modeled as `f: A → B` where both A and B have clear equality, and the invariant is a boolean predicate on the mapping.**

If you can't write `assert(invariant(f(input)))` without mocking, stubbing, or side-effect management, skip property testing for that function.

---

## Part 3: What We Property Test (and Why)

### Layer 1: Schema Validation (widget-properties.test.ts)

**Why property test:** Schema validation is the perfect property test target — pure function, closed input domain (UUIDs, bounded strings), boolean output.

**What we test:**
- Valid input always passes
- Each missing field fails independently
- Each constraint violation (empty string, over-size, wrong type) fails

**CS connection:** This is **exhaustive type enumeration** — `fc.uuid()` + `fc.string({minLength, maxLength})` generates every shape the schema accepts and rejects. Equivalent to SmallCheck's domain enumeration but randomized.

### Layer 2: State Machines (widget-properties.test.ts, infra-properties.test.ts)

**Why property test:** State machines have discrete, observable states and well-defined transition rules. Each transition is a predicate: "if state=CLOSED and failures<threshold, state stays CLOSED."

**What we test:**
- Circuit breaker never opens before threshold
- Circuit breaker rejects when open
- Circuit breaker recovers: open→half-open→closed
- Rate limiter never exceeds burst
- Session registry turnIndex is monotonic

**CS connection:** This is **model-based testing** — the test generators exercise state transitions randomly, and the property function checks that the observed state matches the transition system's specification. Equivalent to TLA+ model checking but executed against real code instead of a formal model.

### Layer 3: Algebraic Laws (core-properties.test.ts)

**Why property test:** Algebraic laws are universal quantifications — they must hold for every input. Hand-picking 3 inputs proves nothing for an infinite domain.

**What we test:**
- Idempotency: `f(f(x)) === f(x)` for sanitizer
- Purity: `f(x)` never contains pattern P for any x
- Shape invariance: `result.response.text` is always a non-empty string

**CS connection:** These are **equational properties** — they assert a relationship between different invocations of the same function. The generator produces the input domain, and the property asserts the equation. This is the QuickCheck style: `∀ x: P(f(x), f(f(x)))`.

### Layer 4: Security Invariants (infra-properties.test.ts, core-properties.test.ts)

**Why property test:** Security properties are often "P never happens" — a universal negation. Hand-testing confirms P doesn't happen for tested inputs; property testing confirms P doesn't happen for *any* input the generator can produce.

**What we test:**
- Logger never emits PII keys in meta
- IntegrationError never carries PII in its meta field
- Sanitizer output never contains phone numbers or emails
- Auth parser rejects all non-Bearer headers

**CS connection:** This is **taint tracking from the test side** — the generator injects tainted data (a PII key, a malformed auth header) and the property asserts it never reaches the output surface. Equivalent to information flow control but exercised via random generation rather than static analysis.

---

## Part 4: The Shrinking Engine (Why fast-check Beats Hand-Written Fuzzers)

The old `scripts/fuzz-widget.ts` did this:

```
for 1200 iterations:
  send random payload
  assert status !== 500
```

If it found a crash, it told you which payload caused it. The payload was 2KB of random bytes. Good luck debugging that.

fast-check does this:

```
generate random payload
if property fails:
  shrink the payload to minimal failing form
  report: "Counterexample: [' !']"
```

**Shrinking** is the key differentiator. It takes a failing input (2KB of random bytes) and reduces it to the minimal counterexample (three characters: ` !`). It does this by trying progressively simpler inputs — shorter strings, smaller integers, fewer array elements — and checking if each simpler input still fails. The first one that passes is discarded; the last one that fails is reported.

From CS theory, this is **delta debugging** (Zeller, 2002) applied to generated test inputs. The generator produces a failing case; the shrinker produces the minimal failing case. Together, they answer not just "does this fail?" but "what exactly is the bug?"

This is why we deleted `fuzz-widget.ts`. A hand-rolled fuzzer without a shrinker produces noise. fast-check produces the root cause.

---

## Part 5: Connection to Whitebox Methodology

The [Whitebox Methodology](file:///i:/knowledge-graph-repo-master/.knowledge/whitebox/whitebox-methodology.md) defines a two-phase verification process:

1. **7-Pillar Triage** (static) — does the code have the right structure?
2. **6 Behavioral Probes** (runtime) — does the code produce the right behavior?

Property testing is **Probe 3: Property-Based Invariants** from the behavioral probe set. The methodology says:

> **What it tests:** Do the invariants discovered in Q2 hold for all valid inputs, not just the happy path?
>
> **Method:** Identify a property that must hold for all inputs — e.g., "response.id always matches request.id", "total = sum(items)", "status transitions are monotonic". Generate random valid inputs from the Q2 contracts. Assert the property for each run. The generator shrinks failing inputs to the minimal counterexample.
>
> **Key difference from fuzzing:** Fuzzing checks "doesn't crash." Property testing checks "always correct."

Our property tests map to specific pillars from the triage:

| Our property test | Whitebox pillar | Why |
|:---|:---|:---|
| Schema validation (valid always passes) | P1 Perimeter | Proves input validation is complete |
| Sanitizer PII stripping | P5 Security | Proves no PII reaches output surface |
| Logger PII masking | P5 Security | Proves no PII reaches log stream |
| Circuit breaker state transitions | P4 Resilience | Proves degradation gate works |
| Orchestrator never throws | P4 Resilience | Proves graceful degradation guarantee |
| Concurrent session isolation | P2 Core Purity | Proves no cross-session state leak |
| Error class PII stripping | P5 Security | Proves error paths don't leak PII |

The methodology requires at least one probe to move from "Whitebox (7/7 structure)" to "Certified Whitebox (structure + behavior)." We run 43 properties across 4 files — this is Probe 3 at full strength.

---

## Part 6: Adding New Property Tests (Decision Tree)

When adding a new component:

```
Is the component's behavior decidable?
├── NO → Use deterministic tests + contract tests
└── YES:
    Is the input domain algebraic (generatable)?
    ├── NO → Use deterministic tests with representative samples
    └── YES:
        Is the behavior testable without mocks?
        ├── NO → Use deterministic tests with spies
        └── YES:
            Is the behavior a universal invariant (∀ x: P(x))?
            ├── NO → Use deterministic tests + one property test for shape
            └── YES → **Write property tests**

Examples of universal invariants worth property-testing:
- "f never returns null" — ∀ x: f(x) ≠ null
- "f is idempotent" — ∀ x: f(f(x)) = f(x)
- "f never throws" — ∀ x: f(x) does not throw
- "f preserves structure" — ∀ x: shape(f(x)) = expectedShape
- "f is monotonic" — ∀ a ≤ b: f(a) ≤ f(b) (for ordered types)

Examples of non-universal invariants (deterministic test):
- "f calls the database with the right query" — depends on mock setup
- "f returns in under 5 seconds" — depends on environment
- "f produces a helpful response" — not mechanically decidable
