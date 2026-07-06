# General Requirements Quality Checklist: Kanban Drag-and-Drop

**Purpose**: Validate requirements quality across UX, API, data model, and edge cases — unit tests for the spec
**Created**: 2026-07-06
**Feature**: [spec.md](../spec.md)
**Depth**: Standard (~20 items) | **Audience**: Author + Reviewer

---

## Requirement Completeness

- [ ] CHK001 — Are drag lifecycle states (pick-up, drag-move, hover-over-valid-target, hover-over-invalid-area, drop, snap-back) all explicitly defined with expected behavior? [Completeness, Spec §FR-104, §FR-105, §FR-111]
- [ ] CHK002 — Are visual feedback requirements specified for EACH drag state (lifted appearance during drag, target highlight, invalid-drop indicator) or only a subset? [Completeness, Spec §FR-104]
- [ ] CHK003 — Are requirements defined for what happens when a user starts a drag but releases without moving (no-op, no API call)? [Completeness, Spec §FR-110]

## Requirement Clarity

- [ ] CHK004 — Is "slightly transparent" for the dragged card quantified (opacity value or range) or left as subjective? [Clarity, Spec §FR-104]
- [ ] CHK005 — Is "visual indicator (highlighted column)" defined with specific properties (border color, background change, drop zone outline) or left ambiguous? [Clarity, Spec §US1-Acceptance-5]
- [ ] CHK006 — Is "within 1 second of dropping" scoped to optimistic UI update only, or does it include server round-trip? SC-101 says both — are the two timing targets clearly separable for measurement? [Clarity, Spec §SC-101]
- [ ] CHK007 — Does the spec define what "bottom of the column" means when a column has existing tasks with non-sequential positions (e.g., after a failed renumbering)? [Clarity, Spec §FR-108]

## Requirement Consistency

- [ ] CHK008 — FR-108 says new tasks get `position = max+1` with no renumbering, but the data model says positions are "sequential (0, 1, 2, ...) — no gaps." Are these compatible when a task is deleted and a new task is created? [Consistency, Spec §FR-108 ↔ data-model.md]
- [ ] CHK009 — The spec says both drag-and-drop and dropdown "produce identical results (same status, same relative ordering)" in SC-104. But drag provides a specific position while dropdown appends to bottom. Are they truly identical or just status-equivalent? [Consistency, Spec §SC-104]
- [ ] CHK010 — Are position scoping rules consistent? The spec says "per-status, per-user" — do the functional requirements and data model both enforce this same scope? [Consistency, Spec §Key-Entities ↔ data-model.md §New-Rules]

## Acceptance Criteria Quality

- [ ] CHK011 — Can SC-103 ("100% of drag operations resulting in server error correctly revert") be objectively measured without test automation that injects server failures? [Measurability, Spec §SC-103]
- [ ] CHK012 — Can SC-106 ("works on 320px–1920px without layout breakage") be objectively verified? Is "layout breakage" defined (overflow, wrapping, collapsed columns, unresponsive drag handles)? [Measurability, Spec §SC-106]
- [ ] CHK013 — SC-102 says "reorder 5 tasks within 30 seconds." Is this a UX benchmark (time-to-complete) or a system performance target? The two require different measurement approaches. [Measurability, Spec §SC-102]

## Scenario Coverage

- [ ] CHK014 — Are requirements defined for the zero-state: a user with zero tasks sees an empty Kanban board — what happens if they attempt a drag? [Coverage, Gap]
- [ ] CHK015 — Are requirements defined for the single-column-full state: all 3 tasks (free user) are in one column — what does the board look like, and does dragging still work? [Coverage, Edge Case]
- [ ] CHK016 — Are accessibility requirements specified beyond "dropdown remains as fallback"? Is keyboard navigation within the drag-and-drop itself (arrow keys to reorder, Enter to pick up, Escape to cancel) required or intentionally excluded? [Coverage, Spec §FR-106, §Edge-Cases-Accessibility]
- [ ] CHK017 — Are requirements defined for touch-specific interactions (long-press to initiate drag, scroll vs. drag disambiguation) or is touch assumed to "just work" via @dnd-kit? [Coverage, Spec §FR-107]

## Edge Case Coverage

- [ ] CHK018 — The "rapid dragging" edge case says "only the most recent position is persisted." Is this enforced client-side (discard stale responses), server-side (idempotency), or both? The requirement lacks a mechanism. [Gap, Spec §Edge-Cases-Rapid-Dragging]
- [ ] CHK019 — The "deleted task while dragging" edge case says "the drag is cancelled and the task disappears." Is there a requirement for how the UI detects the deletion (polling, subscription, invalidation on next query)? [Gap, Spec §Edge-Cases-Deleted-Task]
- [ ] CHK020 — Are requirements defined for the "server succeeds but client thinks it failed" scenario (network drops after server processes but before response arrives)? This could cause a snap-back on a successfully persisted move. [Gap, Exception Flow]

## Non-Functional Requirements

- [ ] CHK021 — Are performance requirements specified for the position renumbering algorithm (e.g., max tasks per column before O(n) renumbering becomes a concern)? The research.md notes "<50 tasks, no concern" but the spec doesn't state this bound. [Gap, research.md ↔ Spec]
- [ ] CHK022 — Is a minimum touch target size specified for drag handles on tablet/mobile to meet accessibility standards? [Gap, Spec §FR-107]

## Dependencies & Assumptions

- [ ] CHK023 — The spec assumes "@dnd-kit/core + @dnd-kit/sortable" as the drag library. Has this dependency been validated (bundle size impact, license compatibility, Next.js 16 App Router compatibility)? [Assumption, plan.md §Primary-Dependencies]
- [ ] CHK024 — The spec assumes "users primarily interact on desktop or tablet." Is mobile (phone) intentionally deprioritized, and is that decision documented with rationale? [Assumption, Spec §Assumptions]
