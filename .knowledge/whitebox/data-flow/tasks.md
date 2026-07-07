# Tasks — End-to-End Trace

## List Tasks

**Request shape**: No body. `GET /api/v1/tasks`

**Entry**: [tasks.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.routes.ts)

**Middleware**: [auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/middleware/auth.middleware.ts) — JWT verify, sets `req.user`

**Service**: `TaskService.listTasks(user)`
- `prisma.task.findMany({ where: { ownerId }, orderBy: [{ status: "asc" }, { position: "asc" }] })` — direct Prisma call, no repository layer
- Maps to `Task[]`
- Response includes `isPremium` flag from `req.user`

**Response shape**: `200`
```typescript
{ tasks: Task[]; total: number; limit: number; isPremium: boolean }
```

---

## Create Task

**Request shape** (Zod):
```typescript
{ title: string; description: string }
```

**Entry**: `POST /api/v1/tasks`
[tasks.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.routes.ts)

**Service**: `TaskService.createTask(user, { title, description })`

**Premium path** (no transaction needed):
1. Query last task in TODO column for position: `prisma.task.findFirst({ where: { ownerId, status: "TODO" }, orderBy: { position: "desc" } })`
2. `prisma.task.create({ position: (lastPos ?? 0) + 100 })` — fractional indexing

**Free path** (uses `$transaction` for atomicity):
1. `$transaction` wraps count check + create
2. `tx.task.count({ where: { ownerId } })` — if ≥ 3 → `throw TaskLimitReached`
3. Query last task position as above, create with `position = (lastPos ?? 0) + 100`
4. `instanceof TaskLimitReached` check in Effect.catch re-throws as `Effect.fail`

**Response shape**: `201 Task`

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Limit reached | `TaskLimitReached` | 403 | Free user has ≥3 tasks |
| DB failure | `Error` | 500 | Infrastructure failure |

---

## Update Task Status (Drag-and-Drop with Fractional Indexing)

**Request shape**:
```typescript
{ status: "TODO" | "IN_PROGRESS" | "DONE"; position: number }
```
`position` is a **fractional float** computed by the frontend from neighboring cards
(e.g., `150.0`, `250.5`). It is NOT a sequential integer index.

**Entry**: `PATCH /api/v1/tasks/:id/status`
[tasks.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.routes.ts)

**Service**: `TaskService.updateTaskStatus(user, taskId, status, position)`

**Single-row UPDATE** — no transaction, no `findMany`, no shifting:
1. `prisma.task.update({ where: { id, ownerId }, data: { status, position } })`
2. Prisma throws on not-found → caught by `Effect.either` → `Effect.fail(TaskNotFound)`

**Fractional indexing**: The frontend computes the midpoint of the two neighboring
cards' positions using `arrayMove` to determine the new sort order. The backend
blindly writes the float — no other rows are touched.

**Response shape**: `200 Task` (updated)

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Task not found | `TaskNotFound` | 404 | Task doesn't exist or doesn't belong to user |
| DB failure | `Error` | 500 | Infrastructure failure |

---

## Delete Task

**Request shape**: No body. `DELETE /api/v1/tasks/:id`

**Entry**: [tasks.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.routes.ts)

**Service**: `TaskService.deleteTask(user, taskId)`
1. `prisma.task.delete({ where: { id, ownerId } })` — direct Prisma call
2. Prisma throws on not-found → `Effect.either` wraps → `Either.isLeft` → `TaskNotFound`
3. **No `updateMany`** — fractional indexing means no position shifting needed on delete

**Response shape**: `200 Task` (deleted)

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Task not found | `TaskNotFound` | 404 | Task doesn't exist or not owned by user |
| DB failure | `Error` | 500 | Infrastructure failure |
