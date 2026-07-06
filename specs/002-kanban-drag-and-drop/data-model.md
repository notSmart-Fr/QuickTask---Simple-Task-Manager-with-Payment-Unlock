# Data Model: Kanban Drag-and-Drop

**Created**: 2026-07-06
**Feature**: [spec.md](./spec.md)

## Entity Overview

No new entities. The existing `Task` entity gains a `position` field.

```
User ──┬── Task (1:N)        ← Task now has position (integer)
       └── Payment (1:N)     ← Unchanged
```

## Changes to Existing Entities

### Task (Updated)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | (unchanged) |
| title | string | required, 1-200 chars | (unchanged) |
| description | string | optional, max 2000 chars | (unchanged) |
| status | enum | TODO / IN_PROGRESS / DONE | (unchanged) |
| position | **integer** | **required, default 0** | **NEW: ordering within status group, scoped per-user per-status** |
| ownerId | UUID | FK → User.id | (unchanged) |
| createdAt | DateTime | auto-generated | (unchanged) |
| updatedAt | DateTime | auto-updated | (unchanged) |

**New Rules**:
- Tasks within each `(ownerId, status)` group must have sequential positions (0, 1, 2, ...) — no gaps
- New tasks get `position = count` (appended to bottom of "To Do")
- Moving a task between columns resets position numbering in both source and target columns
- Position 0 = top of column; highest position = bottom

**New Index**:

| Table | Index | Purpose |
|-------|-------|---------|
| Task | ownerId + status + position | Ordered task listing for Kanban columns |

## Prisma Migration

```sql
-- Add position column
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Add composite index for ordered queries
CREATE INDEX "Task_ownerId_status_position_idx" ON "Task"("ownerId", "status", "position");
```

Existing tasks all get `position = 0`. After the first drag operation within a column, positions are renumbered sequentially.

## Position Renumbering Algorithm

When dragging task T to position P in column (status S):

1. Read all tasks in target column (ownerId + status S), ordered by position asc
2. Remove T from its current position in source column — shift siblings above T down by 1
3. If target column = source column and T is moving down: insert at P, shift siblings at [P, T.oldPos) down by 1
4. If target column = source column and T is moving up: insert at P, shift siblings at [P, T.oldPos) up by 1
5. If target column ≠ source column: insert T at P in target, shift target siblings at ≥ P down by 1
6. All updates in a single transaction
