import { Router } from "express";
import { z } from "zod";
import { TaskStatusSchema, TaskTitleSchema, TaskDescriptionSchema } from "../shared/schemas.js";
import type { Request, Response, NextFunction } from "express";
import type { TaskService } from "../core/task/task.service.js";
import { TaskLimitError, TaskNotFoundError } from "../core/task/task.service.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const CreateTaskSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
});

const UpdateTaskStatusSchema = z.object({
  status: TaskStatusSchema,
});

// ponytail: narrow req.user (guaranteed present by authMiddleware) + req.params.id
function getUser(req: Request) {
  if (!req.user) throw new Error("Unauthorized");
  return { id: req.user.id, isPremium: req.user.isPremium };
}
function getParamId(req: Request): string {
  return req.params.id as string;
}

export function createTaskRouter(taskService: TaskService) {
  const router = Router();

  router.use(authMiddleware);

  // GET /api/v1/tasks - list user's tasks
  router.get("/", async (req: Request, res: Response, _next: NextFunction) => {
    const tasks = await taskService.listTasks(getUser(req));
    res.json(tasks);
  });

  // POST /api/v1/tasks - create a task
  router.post("/", async (req: Request, res: Response, _next: NextFunction) => {
    const validatedData = CreateTaskSchema.parse(req.body);
    try {
      const task = await taskService.createTask(getUser(req), validatedData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof TaskLimitError) {
        res.status(403).json({ error: error.message });
      } else {
        throw error;
      }
    }
  });

  // DELETE /api/v1/tasks/:id - delete a task
  router.delete("/:id", async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const task = await taskService.deleteTask(getUser(req), getParamId(req));
      res.json(task);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        throw error;
      }
    }
  });

  // PATCH /api/v1/tasks/:id/status - update task status
  router.patch("/:id/status", async (req: Request, res: Response, _next: NextFunction) => {
    const validatedData = UpdateTaskStatusSchema.parse(req.body);
    try {
      const task = await taskService.updateTaskStatus(
        getUser(req),
        getParamId(req),
        validatedData.status
      );
      res.json(task);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        throw error;
      }
    }
  });

  return router;
}
