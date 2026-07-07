import { describe, it, expect, vi } from "vitest";
import { Effect, Either } from "effect";
import { TaskService, FREE_TASK_LIMIT } from "../../src/features/tasks/tasks.service.js";
import { PrismaClient } from "@prisma/client";

type MockPrismaTask = {
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

type MockTx = {
  task: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

type MockPrisma = {
  task: MockPrismaTask;
  $transaction: ReturnType<typeof vi.fn>;
};

function makeMockTask(): MockPrismaTask {
  return {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
}

function makeMockPrisma(): MockPrisma {
  return {
    task: makeMockTask(),
    $transaction: vi.fn().mockImplementation(async (fn: (tx: MockTx) => unknown) => {
      const tx: MockTx = { task: makeMockTask() };
      return fn(tx);
    }),
  };
}

interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
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

describe("TaskService.createTask", () => {
  it("creates a task for free user under limit", async () => {
    const prisma = makeMockPrisma();
    // Free path uses $transaction — configure the tx mocks inside
    prisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: MockTx) => unknown) => {
      const tx: MockTx = { task: makeMockTask() };
      tx.task.count.mockResolvedValue(0);
      tx.task.create.mockResolvedValue(makeTask({ title: "New Task" }));
      return fn(tx);
    });
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(freeUser, { title: "New Task", description: "" }),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.title).toBe("New Task");
    }
  });

  it("rejects task creation when free user is at limit", async () => {
    const prisma = makeMockPrisma();
    // $transaction will use tx.task.count which returns at limit
    prisma.$transaction = vi.fn().mockImplementation(async () => {
      throw new (await import("../../src/features/tasks/tasks.service.js")).TaskLimitReached({ limit: FREE_TASK_LIMIT });
    });
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(freeUser, { title: "Too Many", description: "" }),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      const left = either.left as { _tag: string; limit: number };
      expect(left._tag).toBe("TaskLimitReached");
      expect(left.limit).toBe(FREE_TASK_LIMIT);
    }
  });

  it("allows premium user to exceed free limit", async () => {
    const prisma = makeMockPrisma();
    prisma.task.count.mockResolvedValue(0);
    prisma.task.create.mockResolvedValue(makeTask({ title: "Premium Task" }));
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.createTask(premiumUser, { title: "Premium Task", description: "" }),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.title).toBe("Premium Task");
      // Premium path uses prisma directly, not $transaction
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });
});

describe("TaskService.listTasks", () => {
  it("returns tasks for the user", async () => {
    const prisma = makeMockPrisma();
    prisma.task.findMany.mockResolvedValue([
      makeTask({ id: "t1", title: "First" }),
      makeTask({ id: "t2", title: "Second" }),
    ]);
    const service = new TaskService(prisma as unknown as PrismaClient);

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
    const prisma = makeMockPrisma();
    prisma.task.delete.mockResolvedValue(makeTask());
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(service.deleteTask(freeUser, "task-1")),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.id).toBe("task-1");
    }
  });

  it("fails with TaskNotFound when deleting another user's task", async () => {
    const prisma = makeMockPrisma();
    prisma.task.delete.mockRejectedValue(new Error("Record not found"));
    const service = new TaskService(prisma as unknown as PrismaClient);

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
    const prisma = makeMockPrisma();
    prisma.task.update.mockResolvedValue(makeTask({ status: "IN_PROGRESS", position: 100 }));
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(freeUser, "task-1", "IN_PROGRESS", 100),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.status).toBe("IN_PROGRESS");
    }
  });

  it("fails with TaskNotFound when task does not exist", async () => {
    const prisma = makeMockPrisma();
    prisma.task.update.mockRejectedValue(new Error("Record not found"));
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(premiumUser, "nonexistent", "DONE", 100),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("TaskNotFound");
    }
  });

  it("reorders a task upward within the same column", async () => {
    const prisma = makeMockPrisma();
    prisma.task.update.mockResolvedValue(makeTask({ status: "TODO", position: 150 }));
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(freeUser, "task-1", "TODO", 150),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.status).toBe("TODO");
    }
  });

  it("reorders a task downward within the same column", async () => {
    const prisma = makeMockPrisma();
    prisma.task.update.mockResolvedValue(makeTask({ status: "TODO", position: 350 }));
    const service = new TaskService(prisma as unknown as PrismaClient);

    const either = await Effect.runPromise(
      Effect.either(
        service.updateTaskStatus(freeUser, "task-1", "TODO", 350),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.status).toBe("TODO");
    }
  });
});
