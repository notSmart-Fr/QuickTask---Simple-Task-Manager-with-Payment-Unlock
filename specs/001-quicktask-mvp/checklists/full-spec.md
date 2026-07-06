# Requirements Quality Checklist: QuickTask MVP

**Purpose**: Validate completeness, clarity, and consistency of requirements across auth,
tasks, payment, and cross-cutting concerns before proceeding to `/speckit-tasks`.

**Created**: 2026-07-06
**Feature**: [spec.md](../spec.md)
**Audience**: Author self-review + peer reviewer
**Depth**: Standard (~30 items)

---

## Auth Requirements Quality

- [ ] CHK001 — Is password strength fully specified beyond "min 8 chars" (complexity rules: uppercase, digit, special character)? [Clarity, Spec §FR-001]
- [ ] CHK002 — Is JWT token expiry duration defined? [Gap, Spec §US1]
- [ ] CHK003 — Are requirements defined for token refresh or re-authentication behavior when a token expires mid-session? [Gap, Spec §Edge Cases]
- [ ] CHK004 — Is "terminating their session" defined with specific behavior (client-side token clear only, or server-side invalidation)? [Clarity, Spec §FR-018]
- [ ] CHK005 — Is the set of protected routes explicitly enumerated, or is a default-deny rule stated? [Completeness, Spec §FR-004]
- [ ] CHK006 — Is the post-registration redirect behavior consistent with post-login? [Consistency, Spec §US1-Scenario1 vs Scenario2]
- [ ] CHK007 — Is case-insensitivity for duplicate email detection explicitly required? [Clarity, Spec §FR-003]

## Task Requirements Quality

- [ ] CHK008 — Are task status transition rules defined (can a task move directly from TODO to DONE, or must it pass through IN_PROGRESS)? [Gap, Spec §US2]
- [ ] CHK009 — Is the task status change mechanism in scope or out of scope? The spec excludes "task editing" but status changes may be a distinct action. [Conflict, Spec §Assumptions vs §US2]
- [ ] CHK010 — Are empty-state requirements for each Kanban column quantified beyond "a helpful message"? [Clarity, Spec §Edge Cases]
- [ ] CHK011 — Is the atomicity requirement for task-limit enforcement explicitly stated as a MUST (not just described in edge cases)? [Clarity, Spec §Edge Cases]
- [ ] CHK012 — Are task title uniqueness requirements defined (can two tasks owned by the same user share a title)? [Gap, Spec §US2]
- [ ] CHK013 — Is the description field optionality consistently stated? The spec §FR-006 says "title and description" implying both, but the contracts list description as optional. [Consistency, Spec §FR-006 vs contracts/tasks.yaml]
- [ ] CHK014 — Are requirements defined for displaying task count vs limit to the user (e.g., "2/3 tasks used")? [Gap, Spec §US2]
- [ ] CHK015 — Is the ordering of tasks within Kanban columns stated as a requirement rather than only an assumption? [Traceability, Spec §Assumptions]

## Payment Requirements Quality

- [ ] CHK016 — Is the payment currency (USD) explicitly stated in the specification, not only inferred from the data model? [Clarity, Spec §FR-013 vs data-model.md]
- [ ] CHK017 — Are the post-payment redirect URLs (success and cancel) and their associated behaviors explicitly defined? [Gap, Spec §US3-Scenario2-3]
- [ ] CHK018 — Is an idempotency TTL or deduplication window specified for Stripe webhook events? [Gap, Spec §FR-015]
- [ ] CHK019 — Is the atomicity requirement for "payment confirmation + premium upgrade" stated as a MUST requirement? [Clarity, Spec §FR-014 — implies but doesn't state atomic]
- [ ] CHK020 — Are requirements defined for the scenario where a Stripe webhook never arrives (timeout, network partition, reconciliation)? [Gap, Spec §US3]
- [ ] CHK021 — Is the unlock button visibility rule consistent across all contexts: dashboard, during active checkout, after failed payment? [Consistency, Spec §FR-012, FR-017]
- [ ] CHK022 — Are requirements defined for what the user sees between Stripe redirect and webhook processing (eventual consistency window)? [Gap, Spec §US3-Scenario3]

## Cross-Cutting Requirements Quality

- [ ] CHK023 — Are loading state requirements defined for all async operations (login, task create, payment redirect initiation)? [Gap]
- [ ] CHK024 — Are network error handling requirements specified (backend unreachable, request timeout)? [Gap]
- [ ] CHK025 — Are accessibility requirements specified (ARIA labels, keyboard navigation, color contrast minimums)? [Gap]
- [ ] CHK026 — Are responsive breakpoint requirements quantified (min viewport widths, layout changes per breakpoint)? [Clarity, Spec §Assumptions]
- [ ] CHK027 — Is the location and format of form validation errors specified (inline under field vs toast, position, persistence)? [Clarity, Spec §SC-008]
- [ ] CHK028 — Is the landing page content specified beyond "options to log in or register"? [Completeness, Spec §FR-019]
- [ ] CHK029 — Are requirements defined for account deletion and associated data cleanup (tasks, payments)? [Gap]
- [ ] CHK030 — Are all explicit scope exclusions (no drag-and-drop, no task editing, no password reset, no email verification) consistently reflected in the contracts and quickstart? [Consistency, Spec §Assumptions]

## Notes

- Items marked incomplete require spec or plan updates before `/speckit-tasks`.
- CHK009 is the most critical ambiguity — it directly affects how many API endpoints and UI interactions need to be built.
- CHK008, CHK009, CHK013, and CHK029 are flagged as potential scope/content conflicts.
- All `[Gap]` items indicate requirements that may need to be added or explicitly excluded.
