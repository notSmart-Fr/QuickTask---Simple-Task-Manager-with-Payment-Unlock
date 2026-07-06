import { Effect, Data } from "effect";
import type { Task, TaskStatus, UserForTaskService } from "./task.entity.js";
import type { TaskRepositoryPort } from "./task.port.js";
import { FREE_TASK_LIMIT } from "./task.entity.js";

// --------------- Typed domain errors ---------------

export class TaskLimitReached extends Data.TaggedError("TaskLimitReached")<{
  limit: number;
}> {}

export class TaskNotFound extends Data.TaggedError("TaskNotFound")<{
  taskId: string;
}> {}

// --------------- Service ---------------

export class TaskService {
  constructor(private readonly taskRepository: TaskRepositoryPort) {}

  createTask(
    user: UserForTaskService,
    data: { title: string; description: string },
  ): Effect.Effect<Task, TaskLimitReached | Error> {
    if (user.isPremium) {
      return Effect.tryPromise({
        try: () => this.taskRepository.create({ ...data, ownerId: user.id }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });
    }

    return Effect.gen(this, function* () {
      // ponytail: the transaction callback is plain async (Prisma API), so
      // the limit check + create runs with regular await, and the whole wrapper
      // is lifted into Effect via tryPromise.
      const result = yield* Effect.tryPromise({
        try: () =>
          this.taskRepository.transaction(async (tx) => {
            const count = await tx.countByOwnerId(user.id);
            if (count >= FREE_TASK_LIMIT) {
              // Throw a typed marker through the promise boundary.
              // tryPromise's catch will rewrap it — we detect it in the
              // generator below via instanceof.
              throw new TaskLimitReached({ limit: FREE_TASK_LIMIT });
            }
            return tx.create({ ...data, ownerId: user.id });
          }),
        catch: (e) => {
          // Pass TaskLimitReached through so we can match it in the generator
          if (e instanceof TaskLimitReached) return e;
          return e instanceof Error ? e : new Error(String(e));
        },
      });

      // Typed error branching in the Effect pipeline
      if (result instanceof TaskLimitReached) {
        return yield* Effect.fail(result);
      }
      return result;
    });
  }

  listTasks(user: UserForTaskService): Effect.Effect<Task[], Error> {
    return Effect.tryPromise({
      try: () => this.taskRepository.listByOwnerId(user.id),
      catch: (e) => (e instanceof Error ? e : new Error(String(e))),
    });
  }

  deleteTask(
    user: UserForTaskService,
    taskId: string,
  ): Effect.Effect<Task, TaskNotFound | Error> {
    return Effect.gen(this, function* () {
      const task = yield* Effect.tryPromise({
        try: () => this.taskRepository.deleteByIdAndOwnerId(taskId, user.id),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!task) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }
      return task;
    });
  }

  updateTaskStatus(
    user: UserForTaskService,
    taskId: string,
    status: TaskStatus,
    position?: number,
  ): Effect.Effect<Task, TaskNotFound | Error> {
    return this.moveTask(user, taskId, status, position);
  }

  moveTask(
    user: UserForTaskService,
    taskId: string,
    newStatus: TaskStatus,
    newPosition?: number,
  ): Effect.Effect<Task, TaskNotFound | Error> {
    return Effect.gen(this, function* () {
      const task = yield* Effect.tryPromise({
        try: () => this.taskRepository.findByIdAndOwnerId(taskId, user.id),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!task) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }

      // If no change, return early
      if (task.status === newStatus && newPosition === task.position) {
        return task;
      }

      // Execute everything in a transaction
      const result = yield* Effect.tryPromise({
        try: () =>
          this.taskRepository.transaction(async (tx) => {
            // Get target column tasks
            const targetColumn = await tx.listByOwnerIdAndStatus(user.id, newStatus);
            let targetPos = newPosition;
            if (targetPos === undefined) {
              targetPos = targetColumn.length;
            }
            // Clamp targetPos
            targetPos = Math.max(0, Math.min(targetPos, targetColumn.length));

            // Handle shifts
            if (task.status === newStatus) {
              // Same column: shift between old and new position
              const oldPos = task.position;
              if (targetPos < oldPos) {
                // Shift tasks from targetPos to oldPos-1 to the right by 1
                await tx.shiftPositions(user.id, newStatus, targetPos, 1);
              } else if (targetPos > oldPos) {
                // Shift tasks from oldPos+1 to targetPos to the left by 1
                await tx.shiftPositions(user.id, newStatus, oldPos + 1, -1);
              }
            } else {
              // Different columns
              // Shift target column from targetPos right by 1
              await tx.shiftPositions(user.id, newStatus, targetPos, 1);
              // Shift source column from oldPos+1 left by 1
              await tx.shiftPositions(user.id, task.status, task.position + 1, -1);
            }

            // Update the task with new status and position
            const updatedTask = await tx.updateStatusByIdAndOwnerId(
              taskId,
              user.id,
              newStatus,
              targetPos,
            );
            return updatedTask;
          }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!result) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }
      return result;
    });
  }
}
