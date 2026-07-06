import { z } from "zod";

export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const PaymentStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED"]);

export const NameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be ≤ 100 characters");

export const EmailSchema = z.string().email("Invalid email address").trim();
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

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

export const TaskPositionSchema = z.number().int().nonnegative().default(0);

export const CreateTaskInputSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
});

export const UpdateTaskStatusInputSchema = z.object({
  status: TaskStatusSchema,
  position: TaskPositionSchema.optional(),
});

export const TaskResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  position: TaskPositionSchema,
  ownerId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ListTasksResponseSchema = z.object({
  tasks: z.array(TaskResponseSchema),
  total: z.number(),
  limit: z.number(),
  isPremium: z.boolean(),
});
