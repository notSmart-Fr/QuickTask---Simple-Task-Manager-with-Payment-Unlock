# Implementation Plan: Kanban Drag-and-Drop

**Branch**: `002-kanban-drag-and-drop` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-kanban-drag-and-drop/spec.md`

## Summary

Add drag-and-drop to the existing Kanban board so users can move tasks between columns and reorder tasks within columns. A new `position` integer field on Task provides ordering; drag operations update both `status` and `position` in a single API call. The existing status dropdown remains as a fallback for accessibility.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, both frontend and backend)

**Primary Dependencies**:
- Frontend: Next.js 16 (App Router), TanStack Query, Effect-TS 3.x, Zod, Tailwind CSS, @dnd-kit/core, @dnd-kit/sortable
- Backend: Express, Effect-TS 3.x, Prisma, Zod
- Shared: Zod schemas (validation parity between frontend and backend)

**Storage**: PostgreSQL (existing), Prisma migration for `position` column

**Testing**: Vitest (unit + integration), Supertest (API integration tests)

**Target Platform**: Web — Vercel (frontend), Render/Railway (backend)

**Project Type**: Web application enhancement (modifies existing backend and frontend)

**Performance Goals**:
- Drag-and-drop visual update within 1s of drop (SC-101)
- Server persistence within 2s of drop (SC-101)
- Reorder 5 tasks within 30s via drag (SC-102)
- Works on 320px–1920px screen widths (SC-106)

**Constraints**:
- Existing Effect-TS architecture must be maintained (Zod at boundary, Effect in core)
- Existing try/catch ban in core/ and api/ enforced by ESLint
- No new external services or infrastructure
- Position integer, scoped per-status per-user

**Scale/Scope**: Existing Kanban board enhancement. Touches ~6 backend files, ~5 frontend files. One new frontend dependency (@dnd-kit). One Prisma migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| 1.1 Separation of Concerns | PASS | Drag logic stays in frontend UI; position renumbering is pure domain logic in backend core |
| 1.2 Dependency Direction | PASS | Core task service accepts position param; adapters (Prisma) renumber; routes just delegate |
| 1.3 Testability First | PASS | Position renumbering is pure logic testable without mocks; drag UI testable via integration |
| 1.4 Type Safety | PASS | Strict TS; position is `number`. Zod schemas validate position in API requests |
| 1.5 Observability by Default | PASS | Drag operations logged at API layer (existing pattern) |
| 1.6 Fail Gracefully | PASS | Drag snaps back on error (FR-105); Effect-TS typed errors |
| 1.7 Data Integrity | PASS | Position renumbering within Prisma transaction; Zod validates position at boundary |
| 1.8 Idempotency | PASS | Drag-to-same-position is no-op (FR-110); rapid drags discard intermediates |
| 1.9 Backward Compatibility | PASS | New `position` field defaults to 0 for existing tasks; status dropdown still works (FR-106) |
| 1.10 Resource Lifecycle | PASS | No new resources; Prisma transaction scope managed by existing patterns |
| 1.11 State Sanitization | PASS | No new sensitive data |
| 1.12 Transaction Integrity | PASS | Position renumbering (select + update siblings + update target) wrapped in Prisma $transaction |
| 1.13 Forward Migration Contracts | PASS | Prisma migration adds `position Int @default(0)` — expand-migrate-contract |
| 1.14 Invariant Preservation | PASS | Position always sequential (0,1,2...); status always valid enum; enforced at service layer |

**Gate Result**: All 14 principles pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-kanban-drag-and-drop/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── tasks.yaml       # Updated: PATCH /tasks/:id/status now accepts position
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (files changed/added)

```text
backend/
├── prisma/
│   └── schema.prisma              # MODIFIED: Task.position field + index
│   └── migrations/
│       └── add_task_position/     # NEW
├── src/
│   ├── core/
│   │   └── task/
│   │       ├── task.entity.ts     # MODIFIED: add position field
│   │       ├── task.port.ts       # MODIFIED: updateStatus signature
│   │       └── task.service.ts    # MODIFIED: position renumbering logic
│   ├── adapters/
│   │   └── prisma/
│   │       └── prisma-task.repository.ts  # MODIFIED: order by position, renumber
│   ├── api/
│   │   └── task.routes.ts         # MODIFIED: accept position in status update
│   └── shared/
│       └── schemas.ts             # MODIFIED: position field in task schema
├── tests/
│   ├── core/
│   │   └── task.service.test.ts   # MODIFIED: position renumbering tests
│   └── api/
│       └── task.routes.test.ts    # MODIFIED: position in status update tests

frontend/
├── src/
│   ├── core/
│   │   └── api/
│   │       └── task.effect.ts     # MODIFIED: updateTaskStatusEffect accepts position
│   ├── features/
│   │   └── tasks/
│   │       ├── tasks.api.ts       # MODIFIED: useUpdateTaskStatus accepts position
│   │       ├── kanban-board.tsx   # MODIFIED: DndContext + SortableContext wrapping
│   │       ├── task-card.tsx      # MODIFIED: useSortable integration
│   │       └── sortable-task-card.tsx  # NEW: draggable task card wrapper
│   └── schemas/
│       └── task.schema.ts         # MODIFIED: position field
├── package.json                   # MODIFIED: add @dnd-kit/core, @dnd-kit/sortable
```

## Complexity Tracking

> No violations detected. All 14 constitutional principles pass.
