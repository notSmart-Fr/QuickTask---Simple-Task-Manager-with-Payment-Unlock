export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserForTaskService {
  id: string;
  isPremium: boolean;
}

export const FREE_TASK_LIMIT = 3;
