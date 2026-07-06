import { z } from 'zod';
import { TaskTitleSchema, TaskDescriptionSchema, TaskStatusSchema } from './index';

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
