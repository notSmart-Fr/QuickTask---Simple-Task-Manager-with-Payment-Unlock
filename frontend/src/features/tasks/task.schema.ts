import { z } from 'zod';

export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);

export const TaskTitleSchema = z
  .string()
  .trim()
  .min(1, "Task title is required")
  .max(200, "Title must be ≤ 200 characters");

export const TaskDescriptionSchema = z
  .string()
  .max(2000, "Description must be ≤ 2000 characters")
  .optional()
  .default("");

export const CreateTaskInputSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
});

export const UpdateTaskStatusInputSchema = z.object({
  status: TaskStatusSchema,
  position: z.number().int().nonnegative().optional(),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
