# Tasks: Kanban Drag-and-Drop

**Input**: Design documents from `specs/002-kanban-drag-and-drop/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tasks.yaml, quickstart.md

**Tests**: Not requested — manual validation via quickstart.md scenarios.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All tasks include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and run database migration

- [X] T001 Install @dnd-kit dependencies in `frontend/` — run `cd frontend && pnpm add @dnd-kit/core @dnd-kit/sortable`
- [X] T002 [P] Add `position` field to Prisma schema + run migration in `backend/prisma/schema.prisma` — add `position Int @default(0)` to Task model, add composite index `@@index([ownerId, status, position])`, run `npx prisma migrate dev --name add_task_position`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data model and pipeline changes — ALL user stories depend on this phase

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend — Data Model & Ports

- [X] T003 Update backend shared Zod schemas in `backend/src/shared/schemas.ts` — add `position: z.number().int().nonnegative().default(0)` to task response/output schema; add optional `position` to status-update input schema
- [X] T004 [P] Update Task entity in `backend/src/core/task/task.entity.ts` — add `position: number` field to Task interface/entity
- [X] T005 [P] Update Task port in `backend/src/core/task/task.port.ts` — extend `updateStatus` method signature to accept optional `position?: number` parameter; update `findByOwner` return type to include position
- [X] T006 Update PrismaTaskRepository in `backend/src/adapters/prisma/prisma-task.repository.ts` — update `findByOwner` to `orderBy: [{ status: 'asc' }, { position: 'asc' }]`; update `create` to compute position as count of existing TODO tasks; update `updateStatus` to accept optional position param; use `Effect.tryPromise` wrapping Prisma calls

### Frontend — Data Layer

- [X] T007 [P] Update frontend task Zod schema in `frontend/src/schemas/task.schema.ts` — add `position: z.number().int().nonnegative()` to task schema
- [X] T008 [P] Update task Effect pipeline in `frontend/src/core/api/task.effect.ts` — extend `updateTaskStatusEffect` signature to accept `position?: number`; pass position in PATCH request body (JSON payload: `{ status, position? }`); use `Effect.tryPromise` pattern wrapping `effectApi.patch()`
- [X] T009 Update TanStack Query hooks in `frontend/src/features/tasks/tasks.api.ts` — extend `useUpdateTaskStatus` mutation to accept `position?: number` in mutation variables; ensure `runEffect()` bridge pattern is used (`Effect.runPromise(Effect.either(program))` → throw on left); prepare for optimistic update in US1

**Checkpoint**: Foundation ready — all data flows support position. User story implementation can now begin.

---

## Phase 3: User Story 1 - Drag Tasks Between Columns (Priority: P1)

**Goal**: User can grab a task card and drag it from one Kanban column to another, updating status instantly. Dropdown still works as fallback.

**Independent Test**: Log in, drag a "To Do" task to "In Progress" column → task appears there, status updates. Drag back to "To Do" → task returns. Refresh → changes persist.

### Backend — Position Renumbering

- [x] T010 [US1] Implement position renumbering in `backend/src/core/task/task.service.ts` — add `moveTask(user, taskId, newStatus, newPosition?)` method using `Effect.gen(function* () { ... })`:
  1. Fetch task by ID (fail with `TaskNotFound` if missing)
  2. If status unchanged and position not provided → no-op (return task as-is)
  3. Fetch all tasks in TARGET status column, ordered by position ASC
  4. If `newPosition` is undefined → set to `targetColumn.length` (append to bottom)
  5. Shift tasks in target column at position ≥ newPosition by +1 (via repository `shiftPositions`)
  6. If source ≠ target: shift tasks in source column above old position by -1 (close gap)
  7. If source = target: handle within-column shift (tasks between oldPos and newPos shift ±1)
  8. Update dragged task's status and position
  9. Wrap in `Effect.all` or sequential Effect chain
  Use `Data.TaggedError` for domain errors (`TaskNotFound`). All DB writes within Prisma `$transaction` in repository.

- [x] T011 [US1] Add `shiftPositions` method to `backend/src/adapters/prisma/prisma-task.repository.ts` — implement `shiftPositions(ownerId, status, fromPosition, delta)` that updates `position += delta` for all tasks where `position >= fromPosition`; wrap in `Effect.tryPromise` with Prisma `updateMany`; must be called within the same `$transaction` as the task status update

- [x] T012 [US1] Update PATCH route in `backend/src/api/task.routes.ts` — accept optional `position` in request body; use `Zod.safeParse` at boundary (schema from T003); call `Effect.runPromise(Effect.either(service.moveTask(...)))`; match `either.left._tag` for error routing (`TaskNotFound` → 404, `_` → 500)

### Frontend — Drag Infrastructure

- [x] T013 [US1] Create sortable task card wrapper in `frontend/src/features/tasks/sortable-task-card.tsx` (NEW file) — wrap existing `TaskCard` with `useSortable` from @dnd-kit/sortable:
  ```typescript
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task, status: task.status } });
  ```
  Apply `transform`/`transition` CSS for smooth movement; apply `opacity-50` when `isDragging`; pass `attributes`, `listeners` to drag handle area; keep existing status dropdown inside card

- [x] T014 [US1] Update kanban-board in `frontend/src/features/tasks/kanban-board.tsx` — wrap each column with `DndContext` + `SortableContext`:
  - Add `DndContext` wrapping the entire board with `onDragEnd` handler
  - Add `DragOverlay` showing the dragged card (clone of active card)
  - Wrap each column's task list in `SortableContext` with `items={columnTasks.map(t => t.id)}` and `strategy={verticalListSortingStrategy}`
  - Replace direct `<TaskCard>` rendering with `<SortableTaskCard>`
  - Implement `onDragEnd` handler:
    1. Extract `active` and `over` from event
    2. If no `over` or `over` is outside columns → return (cancel, FR-111)
    3. Determine target status from `over.data.current.sortable.containerId` (maps to column)
    4. Calculate new position from `over` index in target column
    5. If same status AND same position → return (no-op, FR-110)
    6. Call `updateTaskStatus` mutation with `{ taskId, status: targetStatus, position: targetIndex }`

- [x] T015 [US1] Implement optimistic update in `frontend/src/features/tasks/tasks.api.ts` — in `useUpdateTaskStatus` mutation, add `onMutate`, `onError`, `onSettled` callbacks:
  - `onMutate`: cancel in-flight queries, snapshot current cache, immediately update task in cache to new status+position, return snapshot for rollback
  - `onError`: rollback to snapshot (task snaps back to original position, FR-105)
  - `onSettled`: invalidate `["tasks"]` query to refetch fresh server state
  Use `useQueryClient().getQueryData` / `setQueryData` with Effect-TS compatible types

- [x] T016 [US1] Add drag visual feedback in `frontend/src/features/tasks/kanban-board.tsx` — add `useDroppable` to each column container; apply highlight CSS class (e.g., `ring-2 ring-blue-400 bg-blue-50`) when `isOver` is true; add `DragOverlay` with elevated shadow card during drag

**Checkpoint**: User can drag tasks between columns. Status updates persist. Dropdown still works.

---

## Phase 4: User Story 2 - Reorder Tasks Within a Column (Priority: P2)

**Goal**: User can drag a task to a different vertical position within the same column to prioritize work.

**Independent Test**: Create 3 tasks in "To Do" (A, B, C). Drag C to the top → column shows: C, A, B. Refresh → order persists.

### Backend — Within-Column Shift

- [x] T017 [US2] Handle same-column reorder in `backend/src/core/task/task.service.ts` — extend `moveTask` logic for the `source === target` case:
  - When dragging task from position `oldPos` to `newPos` within same status:
    - If `newPos < oldPos`: shift tasks at `[newPos, oldPos)` by +1 (push down)
    - If `newPos > oldPos`: shift tasks at `(oldPos, newPos]` by -1 (pull up)
    - If `newPos === oldPos`: no-op (already handled by FR-110 check in frontend)
  - All shifts within the same Prisma `$transaction` as the position update

### Frontend — Within-Column Drag

- [x] T018 [US2] Handle intra-column position calculation in `frontend/src/features/tasks/kanban-board.tsx` — in `onDragEnd`, when `activeStatus === overStatus`:
  - Compute `newIndex` from over item's sortable index in the column
  - Pass `position: newIndex` to mutation
  - Ensure the optimistic update in `tasks.api.ts` correctly reorders within column

- [x] T019 [US2] Verify no-op same-position detection in `frontend/src/features/tasks/kanban-board.tsx` — in `onDragEnd`, compare `activeTask.position === overIndex && activeStatus === overStatus`; if true, return without mutation call (FR-110)

**Checkpoint**: Tasks can be reordered within columns. Order persists across refresh.

---

## Phase 5: User Story 3 - Cross-Column Drag with Position (Priority: P3)

**Goal**: A single drag action sets both new status AND exact position in the target column.

**Independent Test**: Drag task from position 1 in "To Do" to position 0 in "In Progress" (which has 2 tasks). Task gets "In Progress" status at position 0; existing "In Progress" tasks shift to positions 1 and 2.

### Backend — Cross-Column Insertion

- [x] T020 [US3] Handle cross-column position insertion in `backend/src/core/task/task.service.ts` — ensure `moveTask` cross-column logic:
  - Target column: shift all tasks at position ≥ `targetPos` by +1, then insert dragged task at `targetPos`
  - Source column: shift all tasks above old position by -1 to close gap
  - Both shifts + status update in single Prisma `$transaction` (constitution 1.12)
  - Empty target column: insert at position 0 (no shifts needed)

### Frontend — Cross-Column Position

- [x] T021 [US3] Handle cross-column position in `frontend/src/features/tasks/kanban-board.tsx` — in `onDragEnd`, when `activeStatus !== overStatus`:
  - Compute `newIndex` from over item's sortable index in the TARGET column
  - Pass both `status: targetStatus` and `position: newIndex` to mutation
  - Optimistic update must handle: task removed from source column AND inserted at correct position in target column

- [x] T022 [US3] Handle empty column drop in `frontend/src/features/tasks/kanban-board.tsx` — when dragging into a column with no tasks, @dnd-kit's `over` will be the droppable container (not a sortable item). Use `useDroppable` per column to detect this case; assign `position: 0`

**Checkpoint**: Full Kanban drag-and-drop — tasks move between any columns at any position. All three user stories functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, and validation

- [x] T023 [P] Implement drag error handling UI in `frontend/src/features/tasks/kanban-board.tsx` — on mutation error (caught by TanStack Query `onError`), display error toast/message (e.g., "Failed to move task. Please try again."); task already snaps back via optimistic rollback (FR-105)

- [x] T024 [P] Handle drop outside columns in `frontend/src/features/tasks/kanban-board.tsx` — in `onDragEnd`, if `over` is null or not a valid column droppable/sortable, return early without mutation (FR-111); no visual snap-back needed since `useSortable` handles this natively

- [x] T025 [P] Ensure status dropdown compatibility in `frontend/src/features/tasks/task-card.tsx` — verify dropdown `onChange` calls `updateTaskStatus` mutation WITHOUT position (task appends to bottom, FR-106); dropdown must coexist with drag handle (listeners only on drag handle area, not entire card)

- [X] T026 Run quickstart.md validation — execute all 9 scenarios from `specs/002-kanban-drag-and-drop/quickstart.md`; verify each passes end-to-end

- [x] T027 [P] Lint and typecheck — run `pnpm lint` and `pnpm typecheck` in both `backend/` and `frontend/`; fix all errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 complete
- **US2 (Phase 4)**: Depends on Phase 3 complete (uses same `onDragEnd` + service method)
- **US3 (Phase 5)**: Depends on Phases 3 + 4 complete (cross-column position = US1 status change + US2 position placement)
- **Polish (Phase 6)**: Depends on Phase 5 complete

### Within Each User Story

- Backend before frontend (service → route → UI)
- Entity/port changes (Phase 2) before service logic (Phase 3)
- Drag infrastructure (T013-T014) before optimistic update (T015)
- Visual feedback (T016) after core drag works

### Parallel Opportunities

- Phase 2: T003, T004, T005 can run in parallel (different files, no deps)
- Phase 2: T007, T008 can run in parallel (different files)
- Phase 3: T013 (sortable-card) and T010 (service) can run in parallel (backend vs frontend)
- Phase 6: T023, T024, T025, T027 can all run in parallel
- **Frontend and backend tasks within each phase can often run in parallel** — they touch different files

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Backend data model tasks — different files, no dependencies:
Task: "T003 — Update backend shared Zod schemas in backend/src/shared/schemas.ts"
Task: "T004 — Update Task entity in backend/src/core/task/task.entity.ts"
Task: "T005 — Update Task port in backend/src/core/task/task.port.ts"

# Frontend data layer tasks — different files, no dependencies:
Task: "T007 — Update frontend task Zod schema in frontend/src/schemas/task.schema.ts"
Task: "T008 — Update task Effect pipeline in frontend/src/core/api/task.effect.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, run migration)
2. Complete Phase 2: Foundational (CRITICAL — all data model changes)
3. Complete Phase 3: User Story 1 (drag between columns)
4. **STOP and VALIDATE**: Test US1 independently per quickstart.md Scenario 1
5. Deploy/demo — basic Kanban drag works

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Drag between columns tested → MVP!
3. Add US2 → Within-column reorder tested
4. Add US3 → Full cross-column + position tested
5. Polish → Error handling, edge cases, lint/typecheck

### Effect-TS Patterns (Must Follow)

| Layer | Pattern |
|-------|---------|
| **Backend service** | `Effect.gen(function* () { ... })` + `yield* Effect.tryPromise(...)` + `yield* Effect.fail(new Data.TaggedError(...))` |
| **Backend route** | `Zod.safeParse` → `Effect.runPromise(Effect.either(service.method(data)))` → `_tag` match |
| **Backend repository** | `Effect.tryPromise(() => prisma.task.findMany(...))` for all Prisma calls |
| **Frontend Effect pipeline** | `Effect.tryPromise(() => effectApi.patch(...))` returning `Effect<Data, HttpError \| NetworkError>` |
| **Frontend bridge** | `function runEffect<T>(program: Effect.Effect<T, TaskError>): Promise<T>` → `Effect.runPromise(Effect.either(program))` → throw on left |
| **Frontend mutation** | `useMutation({ mutationFn: (data) => runEffect(updateTaskStatusEffect(data)), onMutate, onError, onSettled })` |
| **Transaction integrity** | Prisma `$transaction` for all multi-row position updates (constitution 1.12) |
| **Error matching** | `either.left._tag === "TaskNotFound"` — NEVER `instanceof` |
