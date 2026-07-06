# Tasks — End-to-End Trace

## List Tasks

**Request shape**: No body. `GET /api/v1/tasks`

**Entry**: [task.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/task.routes.ts#L40-51)

**Middleware**: [auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/middleware/auth.middleware.ts) — JWT verify, sets `req.user`

**Service**: `TaskService.listTasks(user)`
- `repo.listByOwnerId(user.id)` → sorted by `[{ status: "asc" }, { position: "asc" }]`
- Maps to `{ tasks, total, limit: FREE_TASK_LIMIT, isPremium }`

**Repository**: `PrismaTaskRepository.listByOwnerId` → `prisma.task.findMany({ where: { ownerId }, orderBy: [...] })`

**Response shape**: `200`
```typescript
{ tasks: Task[]; total: number; limit: number; isPremium: boolean }
```

---

## Create Task

**Request shape** (Zod):
```typescript
{ title: string; description?: string }
```

**Entry**: `POST /api/v1/tasks`
[task.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/task.routes.ts#L53-79)

**Service**: `TaskService.createTask(user, { title, description })`
1. `repo.countByOwnerId(user.id)` — if ≥ 3 and !user.isPremium → `Effect.fail(TaskLimitReached)`
2. `repo.create({ title, description, ownerId: user.id })`
3. New task always created as TODO with position = current count of TODO tasks

**Repository**: `PrismaTaskRepository.create`
- Counts existing TODO tasks for the user
- `prisma.task.create({ data: { title, description, ownerId, position: count } })`

**Response shape**: `201 Task`

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Limit reached | `TaskLimitReached` | 403 | Free user has ≥3 tasks |
| DB failure | `Error` | 500 | Infrastructure failure |

---

## Update Task Status (Drag-and-Drop)

**Request shape**:
```typescript
{ status: "TODO" | "IN_PROGRESS" | "DONE"; position?: number }
```

**Entry**: `PATCH /api/v1/tasks/:id/status`
[task.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/task.routes.ts#L99-120)

**Service**: `TaskService.moveTask(user, taskId, newStatus, newPosition)`
Inside a Prisma transaction:
1. Find task by id + ownerId → if not found, `TaskNotFound`
2. If same status and same position → no-op
3. Compute target position (default: end of target column)
4. **Same column reorder**: shift tasks between old and new position by ±1
5. **Cross-column move**: shift target column up by 1, shift source column down by 1
6. Update task status + position

**Repository**: Uses `PrismaTaskRepository.shiftPositions` + `updateStatusByIdAndOwnerId` inside a single `$transaction`

**Response shape**: `200 Task` (updated)

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Task not found | `TaskNotFound` | 404 | Task doesn't exist or doesn't belong to user |
| Transaction failure | `Error` | 500 | DB deadlock, constraint violation, etc. |

---

## Delete Task

**Request shape**: No body. `DELETE /api/v1/tasks/:id`

**Entry**: [task.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/task.routes.ts#L81-97)

**Service**: `TaskService.deleteTask(user, taskId)`
1. `repo.findByIdAndOwnerId(taskId, user.id)` → if not found, `TaskNotFound`
2. `repo.deleteByIdAndOwnerId(taskId, user.id)`
3. Deletion also shifts remaining tasks in the same column down by 1 position

**Repository**: Two-step in repository: `prisma.task.delete` + `prisma.task.updateMany` (position decrement)

**Response shape**: `200 Task` (deleted)

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Task not found | `TaskNotFound` | 404 | Task doesn't exist or not owned by user |
| DB failure | `Error` | 500 | Infrastructure failure |
