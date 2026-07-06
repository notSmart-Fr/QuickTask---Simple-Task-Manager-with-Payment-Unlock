# Feature Specification: Kanban Drag-and-Drop

**Feature Branch**: `002-kanban-drag-and-drop`

**Created**: 2026-07-06

**Status**: Draft

**Input**: Proper Kanban experience with drag-and-drop. Users want to reorder tasks within columns and move tasks between columns by dragging them visually, with tasks maintaining their position order like a real Kanban board.

## Clarifications

### Session 2026-07-06

- Q: Should dragging be the primary interaction for status changes, or coexist with the dropdown? → A: Both coexist. Drag-and-drop becomes the primary interaction, but the status dropdown remains as a fallback/alternative for accessibility and mobile.
- Q: Should task position be a simple integer or support gaps for efficient reordering? → A: Simple integer position. Tasks within each column are ordered by a numeric position field. When a task moves, positions are reassigned sequentially (0, 1, 2, ...) within the affected columns. No fractional positioning — simple and predictable.
- Q: Should a newly created task appear at the top or bottom of the "To Do" column? → A: Bottom. New tasks get position `max+1` (the last position in the column). Existing tasks stay in place — no renumbering on create. This matches standard Kanban behavior (Trello, Jira, Linear).

## User Scenarios & Testing

### User Story 1 - Drag Tasks Between Columns (Priority: P1)

An authenticated user wants to grab a task card with their mouse and drag it from one Kanban column to another, so they can update the task's status instantly without using a dropdown.

**Why this priority**: This is the core value of the feature. The status dropdown already works — drag-and-drop replaces it as the primary, more intuitive status-change interaction. Without this, there is no Kanban experience.

**Independent Test**: Can be fully tested by logging in, dragging a "To Do" task to "In Progress" and verifying the task appears in the target column with the correct status. Dragging it back to "To Do" should also work.

**Acceptance Scenarios**:

1. **Given** a user with tasks in the "To Do" column, **When** they drag a task card from "To Do" to "In Progress", **Then** the task moves to "In Progress" column and its status updates to "In Progress".

2. **Given** a user drags a task from "In Progress" to "Done", **When** the drop completes, **Then** the task appears at the top of the "Done" column.

3. **Given** a user drags a task between any two columns in any direction, **When** the drop completes, **Then** the task's status updates correctly and the move is persisted (survives page refresh).

4. **Given** a user drags a task but releases it over an invalid area (outside any column), **When** the drop occurs, **Then** the task snaps back to its original position and status — no change occurs.

5. **Given** a user is dragging a task, **When** they are over a valid target column, **Then** they see a visual indicator (highlighted column) showing where the task will land.

---

### User Story 2 - Reorder Tasks Within a Column (Priority: P2)

An authenticated user wants to drag a task to a specific position within the same column, so they can prioritize their work visually.

**Why this priority**: Priority ordering is the second core Kanban pattern. Users need to express "this task is more important than that one" by arranging them vertically within a column. This builds on US1 (the drag infrastructure).

**Independent Test**: Can be fully tested by dragging a task within the "To Do" column from position 3 to position 1 and verifying the order persists after page refresh.

**Acceptance Scenarios**:

1. **Given** a user with 3 tasks in the "To Do" column, **When** they drag the third task to the top of the column, **Then** the task moves to position 1 and the other two tasks shift down (positions 2 and 3).

2. **Given** a user reorders tasks within a column, **When** they refresh the page, **Then** the task order is preserved exactly as they arranged it.

3. **Given** a user drags a task to the bottom of a column, **When** the drop completes, **Then** the task moves to the last position in that column.

4. **Given** a column with only one task, **When** the user tries to reorder it, **Then** the task stays at its position (no-op) since there is nothing to reorder against.

---

### User Story 3 - Cross-Column Drag with Position (Priority: P3)

An authenticated user wants to drag a task from one column to a specific position in another column, so they can both change status and set priority in a single action.

**Why this priority**: This is the combined power of US1 + US2. A single drag action should handle both status change and position placement. It depends on both prior stories working correctly.

**Independent Test**: Can be tested by dragging a task from position 2 in "To Do" to position 1 in "In Progress" and verifying both the status and position are correct.

**Acceptance Scenarios**:

1. **Given** a user drags a task from position 2 in "To Do" to position 1 in "In Progress" (which already has 2 tasks), **When** the drop completes, **Then** the task gets "In Progress" status, becomes position 1 in that column, and existing "In Progress" tasks shift to positions 2 and 3.

2. **Given** a user drags a task into an empty column, **When** the drop completes, **Then** the task is assigned position 0 in that column.

---

### Edge Cases

- **Network failure during drag**: If the API call to persist a drag operation fails, the task snaps back to its original position and the user sees an error message. No optimistic update persists incorrectly.

- **Concurrent drags from the same user**: If a user opens two browser tabs and drags in both, the last write wins. Tasks will reflect whichever drag completed last. This is acceptable for a personal task manager.

- **Free user drag limit**: A free user can only have 3 tasks total. Dragging does not change the task count, so the limit is not affected. The task limit only applies to task creation, not to drag operations.

- **Drag to same position**: If a user drags a task to its current position (drop at the same spot), no API call is made — it's a no-op.

- **Accessibility**: Users who cannot use drag-and-drop (keyboard-only, screen readers) continue to change task status via the existing dropdown on each card. The dropdown remains fully functional alongside drag-and-drop.

- **Rapid dragging**: If a user drags rapidly multiple times before the first update completes, only the most recent position is persisted. Intermediate drag states are discarded.

- **Deleted task while dragging**: If a task is deleted (via another tab or by another user action) while it's being dragged, the drag is cancelled and the task disappears from the board.

## Requirements

### Functional Requirements

- **FR-101**: System MUST support dragging a task card from any column to any other column. Upon drop, the task's status updates to match the target column.

- **FR-102**: System MUST support reordering tasks within a single column by dragging a task to a different vertical position within that column. Upon drop, the task's position updates and sibling tasks reorder accordingly.

- **FR-103**: System MUST persist all drag-and-drop changes (status + position) to the server immediately upon drop. Changes must survive page refresh.

- **FR-104**: System MUST provide visual feedback during a drag: the dragged card should appear lifted (slightly transparent, shadow) and the target drop zone should highlight.

- **FR-105**: System MUST revert the visual position if the server update fails, snapping the task back to its pre-drag location, and display an error message.

- **FR-106**: System MUST retain the existing status dropdown on each task card as an alternative interaction method for accessibility and mobile users.

- **FR-107**: System MUST handle drag-and-drop across breakpoints — the interface must work on desktop (mouse) and tablet (touch).

- **FR-108**: System MUST assign tasks a numeric position within each status group. When a task moves to a new position via drag-and-drop, existing tasks in that column must be renumbered sequentially. When a task is created via the form, it is assigned position `max+1` (bottom of the "To Do" column) — no renumbering of existing tasks.

- **FR-109**: System MUST return tasks in position order within each column (ascending position: 0, 1, 2, ...).

- **FR-110**: System MUST NOT trigger a server call when a task is dropped in the exact same position it was picked up from.

- **FR-111**: System MUST cancel a drag operation if the user drops the task outside any valid column.

### Key Entities

- **Task** (updated): A new `position` attribute is added (integer, default 0). Tasks are ordered by `position` ascending within each status group. Position is scoped per-status, per-user — each user's "To Do" column has its own position sequence starting from 0. Newly created tasks are assigned position `maxPosition + 1` (appended to the bottom of "To Do"). Drag-and-drop operations renumber positions sequentially (0, 1, 2, ...) within affected columns.

## Success Criteria

### Measurable Outcomes

- **SC-101**: A user can drag a task from one column to another and see it appear in the target column within 1 second of dropping (visual update), with server persistence completing within 2 seconds.

- **SC-102**: A user can reorder 5 tasks within a column in under 30 seconds using drag-and-drop.

- **SC-103**: 100% of drag-and-drop operations resulting in a server error correctly revert the task to its original position with a visible error message.

- **SC-104**: A user can complete the same task status changes using either drag-and-drop or the dropdown — both produce identical results (same status, same relative ordering).

- **SC-105**: The Kanban board displays tasks in correct position order after any sequence of drag operations followed by a page refresh.

- **SC-106**: Drag-and-drop works on common screen widths (320px mobile through 1920px desktop) without layout breakage.

## Assumptions

- Users primarily interact with the Kanban board on desktop (mouse) or tablet (touch). Mobile drag-and-drop is available but secondary to the dropdown for small screens.
- The existing status dropdown remains unchanged and fully functional alongside the new drag-and-drop behavior.
- Task position is scoped per-user, per-status. Two different users can each have a task at position 0 in "To Do" without conflict.
- The `position` field defaults to 0 for existing tasks when the migration runs. Existing tasks will appear in their current order until reordered.
- Newly created tasks appear at the bottom of "To Do" (highest position number). Dragging reorders as expected — bottom-to-top order maps to newest-to-oldest.
- The 3-task free-tier limit applies only to task creation, not to drag operations. Dragging does not increment or decrement the task count.
