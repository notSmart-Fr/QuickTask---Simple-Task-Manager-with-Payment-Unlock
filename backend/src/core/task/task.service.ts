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
  ): Effect.Effect<Task, TaskNotFound | Error> {
    return Effect.gen(this, function* () {
      const task = yield* Effect.tryPromise({
        try: () =>
          this.taskRepository.updateStatusByIdAndOwnerId(taskId, user.id, status),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!task) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }
      return task;
    });
  }
}
