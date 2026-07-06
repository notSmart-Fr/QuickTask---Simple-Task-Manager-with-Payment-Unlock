import { describe, it, expect, vi } from "vitest";
import { Effect, Either } from "effect";
import { TaskService } from "../../src/core/task/task.service.js";
import type { TaskRepositoryPort } from "../../src/core/task/task.port.js";
import type { Task } from "../../src/core/task/task.entity.js";
import { FREE_TASK_LIMIT } from "../../src/core/task/task.entity.js";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "My Task",
  description: "",
  status: "TODO",
  position: 0,
  ownerId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const freeUser = { id: "user-1", isPremium: false };
const premiumUser = { id: "user-2", isPremium: true };

function makeRepo(mocks: Partial<TaskRepositoryPort> = {}): TaskRepositoryPort {
  const repo = {
    listByOwnerId: vi.fn(),
    listByOwnerIdAndStatus: vi.fn(),
    create: vi.fn(),
    deleteByIdAndOwnerId: vi.fn(),
    findByIdAndOwnerId: vi.fn(),
    updateStatusByIdAndOwnerId: vi.fn(),
    shiftPositions: vi.fn(),
    countByOwnerId: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn) => fn(repo)),
  };
  Object.assign(repo, mocks);
  return repo as unknown as TaskRepositoryPort;
}

describe("TaskService.createTask", () => {
  it("creates a task for free user under limit", async () => {
    const repo = makeRepo({
      countByOwnerId: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(makeTask({ title: "New Task" })),
    });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(freeUser, { title: "New Task", description: "" }),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.title).toBe("New Task");
      expect(repo.countByOwnerId).toHaveBeenCalledWith("user-1");
    }
  });

  it("rejects task creation when free user is at limit", async () => {
    const repo = makeRepo({
      countByOwnerId: vi.fn().mockResolvedValue(FREE_TASK_LIMIT),
    });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(freeUser, { title: "Too Many", description: "" }),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("TaskLimitReached");
      expect((either.left as { limit: number }).limit).toBe(FREE_TASK_LIMIT);
    }
  });

  it("allows premium user to exceed free limit", async () => {
    const repo = makeRepo({
      create: vi.fn().mockResolvedValue(makeTask({ title: "Premium Task" })),
    });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(premiumUser, { title: "Premium Task", description: "" }),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.title).toBe("Premium Task");
      expect(repo.countByOwnerId).not.toHaveBeenCalled();
    }
  });
});

describe("TaskService.listTasks", () => {
  it("returns tasks for the user", async () => {
    const tasks = [
      makeTask({ id: "t1", title: "First" }),
      makeTask({ id: "t2", title: "Second" }),
    ];
    const repo = makeRepo({ listByOwnerId: vi.fn().mockResolvedValue(tasks) });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(service.listTasks(freeUser)),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right).toHaveLength(2);
    }
  });
});

describe("TaskService.deleteTask", () => {
  it("deletes a task owned by the user", async () => {
    const task = makeTask();
    const repo = makeRepo({ deleteByIdAndOwnerId: vi.fn().mockResolvedValue(task) });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(service.deleteTask(freeUser, "task-1")),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.id).toBe("task-1");
    }
  });

  it("fails with TaskNotFound when deleting another user's task", async () => {
    const repo = makeRepo({ deleteByIdAndOwnerId: vi.fn().mockResolvedValue(null) });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(service.deleteTask(freeUser, "task-owned-by-other")),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("TaskNotFound");
    }
  });
});

describe("TaskService.updateTaskStatus", () => {
  it("updates task status", async () => {
    const existing = makeTask({ status: "TODO", position: 0 });
    const updated = makeTask({ status: "IN_PROGRESS", position: 0 });
    const repo = makeRepo({
      findByIdAndOwnerId: vi.fn().mockResolvedValue(existing),
      listByOwnerIdAndStatus: vi.fn().mockResolvedValue([] as Task[]),
      shiftPositions: vi.fn().mockResolvedValue(undefined),
      updateStatusByIdAndOwnerId: vi.fn().mockResolvedValue(updated),
    });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(freeUser, "task-1", "IN_PROGRESS"),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.status).toBe("IN_PROGRESS");
    }
  });

  it("fails with TaskNotFound when task does not exist", async () => {
    const repo = makeRepo({
      findByIdAndOwnerId: vi.fn().mockResolvedValue(null),
    });
    const service = new TaskService(repo);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(premiumUser, "nonexistent", "DONE"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("TaskNotFound");
    }
  });
});
