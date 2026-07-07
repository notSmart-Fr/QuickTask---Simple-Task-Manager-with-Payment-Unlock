import { Router } from "express";
import { z } from "zod";
import { Effect, Either } from "effect";
import type { Request, Response } from "express";
import { TaskService } from "./tasks.service.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

// --------------- Zod boundary schemas ---------------

const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);

const TaskTitleSchema = z
  .string()
  .trim()
  .min(1, "Task title is required")
  .max(200, "Title must be ≤ 200 characters");

const TaskDescriptionSchema = z
  .string()
  .max(2000, "Description must be ≤ 2000 characters")
  .optional()
  .default("");

const TaskPositionSchema = z.number().nonnegative();

const CreateTaskInputSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
});

const UpdateTaskStatusInputSchema = z.object({
  status: TaskStatusSchema,
  position: TaskPositionSchema.optional(),
});

// --------------- Helpers ---------------

function getUser(req: Request) {
  if (!req.user) throw new Error("Unauthorized");
  return { id: req.user.id, isPremium: req.user.isPremium };
}

function getParamId(req: Request): string {
  return req.params.id as string;
}

// --------------- Router ---------------

export function createTaskRouter(taskService: TaskService) {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (_req: Request, res: Response) => {
    const user = getUser(_req);
    const either = await Effect.runPromise(
      Effect.either(taskService.listTasks(user)),
    );

    if (Either.isLeft(either)) {
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(either.right);
  });

  router.post("/", async (req: Request, res: Response) => {
    // Step 1: Zod at the boundary — validates shape, rejects with 400
    const result = CreateTaskInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message ?? "Invalid input" });
    }

    // Step 2: Effect.either converts typed domain errors to Either.left — runPromise never throws
    const either = await Effect.runPromise(
      Effect.either(
        taskService.createTask(getUser(req), result.data),
      ),
    );

    if (Either.isLeft(either)) {
      // Step 3: Pattern match on _tag — typed, predictable error routing
      if ("_tag" in either.left) {
        return res.status(403).json({
          error: `Free users can only create ${String(either.left.limit)} tasks. Upgrade to premium for unlimited tasks!`,
        });
      }
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.status(201).json(either.right);
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const either = await Effect.runPromise(
      Effect.either(
        taskService.deleteTask(getUser(req), getParamId(req)),
      ),
    );

    if (Either.isLeft(either)) {
      if ("_tag" in either.left) {
        return res.status(404).json({ error: `Task ${either.left.taskId} not found` });
      }
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(either.right);
  });

  router.patch("/:id/status", async (req: Request, res: Response) => {
    const result = UpdateTaskStatusInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message ?? "Invalid input" });
    }

    const either = await Effect.runPromise(
      Effect.either(
        taskService.updateTaskStatus(getUser(req), getParamId(req), result.data.status, result.data.position),
      ),
    );

    if (Either.isLeft(either)) {
      if ("_tag" in either.left) {
        return res.status(404).json({ error: `Task ${either.left.taskId} not found` });
      }
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(either.right);
  });

  return router;
}
