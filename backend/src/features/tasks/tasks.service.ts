import { Effect, Data, Either } from "effect";
import { PrismaClient } from "@prisma/client";

// --------------- Domain Types ---------------

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserForTaskService {
  id: string;
  isPremium: boolean;
}

export const FREE_TASK_LIMIT = 3;

// --------------- Typed domain errors ---------------

export class TaskLimitReached extends Data.TaggedError("TaskLimitReached")<{
  limit: number;
}> {}

export class TaskNotFound extends Data.TaggedError("TaskNotFound")<{
  taskId: string;
}> {}

// --------------- Service ---------------

export class TaskService {
  constructor(private readonly prisma: PrismaClient) {}

  createTask(
    user: UserForTaskService,
    data: { title: string; description: string },
  ): Effect.Effect<Task, TaskLimitReached | Error> {
    if (user.isPremium) {
      return Effect.tryPromise({
        try: async () => {
          // ponytail: fractional indexing — new tasks append past the last position.
          const lastTask = await this.prisma.task.findFirst({
            where: { ownerId: user.id, status: "TODO" },
            orderBy: { position: "desc" },
          });
          const task = await this.prisma.task.create({
            data: {
              title: data.title,
              description: data.description,
              ownerId: user.id,
              position: (lastTask?.position ?? 0) + 100,
            },
          });
          return this.toDomainTask(task);
        },
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });
    }

    return Effect.gen(this, function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const task = await this.prisma.$transaction(async (tx) => {
            const count = await tx.task.count({ where: { ownerId: user.id } });
            if (count >= FREE_TASK_LIMIT) {
              throw new TaskLimitReached({ limit: FREE_TASK_LIMIT });
            }
            const lastTask = await tx.task.findFirst({
              where: { ownerId: user.id, status: "TODO" },
              orderBy: { position: "desc" },
            });
            const t = await tx.task.create({
              data: {
                title: data.title,
                description: data.description,
                ownerId: user.id,
                position: (lastTask?.position ?? 0) + 100,
              },
            });
            return t;
          });
          return this.toDomainTask(task);
        },
        catch: (e) => {
          if (e instanceof TaskLimitReached) return e;
          return e instanceof Error ? e : new Error(String(e));
        },
      });

      if (result instanceof TaskLimitReached) {
        return yield* Effect.fail(result);
      }
      return result;
    });
  }

  listTasks(user: UserForTaskService): Effect.Effect<Task[], Error> {
    return Effect.tryPromise({
      try: async () => {
        const tasks = await this.prisma.task.findMany({
          where: { ownerId: user.id },
          orderBy: [{ status: "asc" }, { position: "asc" }],
        });
        return tasks.map((t) => this.toDomainTask(t));
      },
      catch: (e) => (e instanceof Error ? e : new Error(String(e))),
    });
  }

  deleteTask(
    user: UserForTaskService,
    taskId: string,
  ): Effect.Effect<Task, TaskNotFound | Error> {
    return Effect.gen(this, function* () {
      // ponytail: fractional indexing — no need to shift other tasks on delete.
      // Effect.either converts Prisma's throw-on-not-found into Either.
      const either = yield* Effect.either(
        Effect.tryPromise({
          try: async () => {
            const t = await this.prisma.task.delete({
              where: { id: taskId, ownerId: user.id },
            });
            return this.toDomainTask(t);
          },
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );

      if (Either.isLeft(either)) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }
      return either.right;
    });
  }

  updateTaskStatus(
    user: UserForTaskService,
    taskId: string,
    status: TaskStatus,
    position?: number,
  ): Effect.Effect<Task, TaskNotFound | Error> {
    // ponytail: frontend computes the fractional position from neighbors.
    // Backend just writes it — single-row UPDATE, no shifting, no index conversion.
    return Effect.gen(this, function* () {
      const either = yield* Effect.either(
        Effect.tryPromise({
          try: async () => {
            const updated = await this.prisma.task.update({
              where: { id: taskId, ownerId: user.id },
              data: { status, position: position ?? 0 },
            });
            return this.toDomainTask(updated);
          },
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );

      if (Either.isLeft(either)) {
        return yield* Effect.fail(new TaskNotFound({ taskId }));
      }
      return either.right;
    });
  }

  // ponytail: inline mapping avoids a dependency on Prisma's generated Task type;
  // status cast is safe because the DB enum values match the domain union.
  private toDomainTask(t: {
    id: string;
    title: string;
    description: string;
    status: string;
    position: number;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Task {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      position: t.position,
      ownerId: t.ownerId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}

