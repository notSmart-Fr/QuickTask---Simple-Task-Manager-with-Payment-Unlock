import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Effect } from "effect";
import jwt from "jsonwebtoken";
import { createTaskRouter } from "../../src/features/tasks/tasks.routes.js";
import { TaskLimitReached, TaskNotFound } from "../../src/features/tasks/tasks.service.js";
import type { TaskService } from "../../src/features/tasks/tasks.service.js";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars!!";
const validToken = jwt.sign(
  { userId: "test-user", name: "Test", email: "test@test.com", isPremium: false },
  JWT_SECRET,
  { expiresIn: "7d" },
);

function makeApp(taskService: Partial<TaskService>) {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/tasks", createTaskRouter(taskService as TaskService));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: unknown, _req: Request, res: any, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? "Invalid input" });
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

describe("POST /api/v1/tasks", () => {
  it("returns 201 on successful creation", async () => {
    const app = makeApp({
      createTask: vi.fn().mockReturnValue(
        Effect.succeed({
          id: "t1",
          title: "New Task",
          description: "",
          status: "TODO" as const,
          ownerId: "test-user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    });

    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ title: "New Task", description: "" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New Task");
  });

  it("returns 403 when free user hits limit", async () => {
    const app = makeApp({
      createTask: vi.fn().mockReturnValue(
        Effect.fail(new TaskLimitReached({ limit: 3 })),
      ),
    });

    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ title: "4th Task", description: "" });

    expect(res.status).toBe(403);
  });

  it("returns 400 for empty title", async () => {
    const app = makeApp({});

    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ title: "", description: "" });

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth header", async () => {
    const app = makeApp({});

    const res = await request(app)
      .post("/api/v1/tasks")
      .send({ title: "Task", description: "" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/tasks", () => {
  it("returns list of tasks", async () => {
    const app = makeApp({
      listTasks: vi.fn().mockReturnValue(
        Effect.succeed([
          { id: "t1", title: "Task 1", description: "", status: "TODO" as const, ownerId: "test-user" },
        ]),
      ),
    });

    const res = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("DELETE /api/v1/tasks/:id", () => {
  it("returns 200 on successful deletion", async () => {
    const app = makeApp({
      deleteTask: vi.fn().mockReturnValue(
        Effect.succeed({ id: "t1", title: "Deleted Task" }),
      ),
    });

    const res = await request(app)
      .delete("/api/v1/tasks/t1")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
  });

  it("returns 404 when task not found", async () => {
    const app = makeApp({
      deleteTask: vi.fn().mockReturnValue(
        Effect.fail(new TaskNotFound({ taskId: "nonexistent" })),
      ),
    });

    const res = await request(app)
      .delete("/api/v1/tasks/nonexistent")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/tasks/:id/status", () => {
  it("returns 200 on status update", async () => {
    const app = makeApp({
      updateTaskStatus: vi.fn().mockReturnValue(
        Effect.succeed({
          id: "t1",
          title: "Task",
          status: "DONE" as const,
        }),
      ),
    });

    const res = await request(app)
      .patch("/api/v1/tasks/t1/status")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ status: "DONE" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DONE");
  });

  it("returns 404 when task not found", async () => {
    const app = makeApp({
      updateTaskStatus: vi.fn().mockReturnValue(
        Effect.fail(new TaskNotFound({ taskId: "nonexistent" })),
      ),
    });

    const res = await request(app)
      .patch("/api/v1/tasks/nonexistent/status")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ status: "DONE" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    const app = makeApp({});

    const res = await request(app)
      .patch("/api/v1/tasks/t1/status")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ status: "INVALID" });

    expect(res.status).toBe(400);
  });
});
