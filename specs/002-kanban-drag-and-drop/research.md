# Research: Kanban Drag-and-Drop

**Created**: 2026-07-06
**Feature**: [spec.md](./spec.md)

## Decision 1: Drag-and-Drop Library

**Decision**: Use `@dnd-kit/core` + `@dnd-kit/sortable`

**Rationale**:
- Most popular React DnD library for sortable lists (40k+ GitHub stars, well-maintained)
- Purpose-built for the exact use case: sortable items within containers
- Supports both mouse and touch (FR-107)
- Accessible by default (keyboard navigation, screen reader announcements)
- Lightweight tree-shakeable (~15KB gzipped)
- Works with Next.js App Router (no hydration issues)

**Alternatives considered**:
- `react-beautiful-dnd` — Abandoned by Atlassian, no React 18 support, no maintenance
- `react-dnd` — More complex API, overkill for simple sortable column use case
- `hello-pangea/dnd` — Fork of react-beautiful-dnd, actively maintained, but @dnd-kit has better TypeScript support and accessibility
- Custom drag implementation — Unnecessary complexity, wasted development time

## Decision 2: Position Renumbering Algorithm

**Decision**: Shift-all algorithm — when a task moves to position N, all tasks at position ≥ N in the target column are shifted down by 1

**Rationale**:
- Simple integer positions (0, 1, 2, ...) per spec decision
- O(n) updates per drag operation (n = tasks in affected columns)
- For a personal task manager with < 50 tasks per column, no performance concern
- Wrapped in Prisma `$transaction` for atomicity (constitution 1.12)
- Easier to reason about and test than fractional/gap approaches

**Algorithm** (within transaction):
1. Read all tasks in target column, ordered by position
2. Remove the dragged task from its current position
3. Shift all tasks at target position and above by +1
4. Update the dragged task to the new status and target position
5. Renumber the source column (close the position gap)

**Alternatives considered**:
- Fractional positioning (e.g., 1.0, 1.5, 2.0) — Avoids renumbering but complex to maintain, floating point edge cases, rejected by spec decision
- Lexorank-style (string-based) — Complex, unnecessary for personal-scale data
- Update single row with gap — Leaves gaps that accumulate over time, violates sequential requirement

## Decision 3: API Contract Extension

**Decision**: Extend `PATCH /tasks/:id/status` to accept optional `position` field, rather than creating a new endpoint

**Rationale**:
- A single drag operation changes both status AND position (FR-101, FR-102)
- One API call = one transaction = atomicity guaranteed
- Backward compatible: `position` is optional, absent = append to bottom of target column
- Status dropdown still works unchanged (FR-106)

**Request shape**:
```json
{
  "status": "IN_PROGRESS",
  "position": 1
}
```

**Alternatives considered**:
- Separate `PATCH /tasks/:id/position` endpoint — Requires two API calls for cross-column drag, breaks atomicity
- `POST /tasks/reorder` bulk endpoint — More complex, unnecessary for per-task drag operations

## Decision 4: New Task Position

**Decision**: New tasks get `position = count` (append to bottom of "To Do")

**Rationale**:
- Matches spec decision (clarify session)
- No renumbering on create — simpler, faster
- Matches standard Kanban behavior (Trello, Jira, Linear)

## Decision 5: Frontend Position Value When Dragging Cross-Column

**Decision**: When dropping into a target column, compute position from the drop index in the target column's sorted task array (not from visual pixel position)

**Rationale**:
- @dnd-kit provides `over` (target container) and the sorted array index
- More reliable than pixel-based position estimation
- Consistent with how @dnd-kit/sortable works internally

## Decision 6: Optimistic Updates

**Decision**: Use TanStack Query's `onMutate` (optimistic) + `onError` (rollback) + `onSettled` (invalidate) pattern

**Rationale**:
- Instant visual feedback (FR-104: task appears in target immediately)
- Rollback on error (FR-105: snap back to original position)
- Standard TanStack Query pattern, consistent with existing mutation hooks
