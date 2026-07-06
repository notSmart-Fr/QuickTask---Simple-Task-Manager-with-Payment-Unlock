import type { Task, TaskStatus, UserForTaskService } from "./task.entity.js";
import type { TaskRepositoryPort } from "./task.port.js";
import { FREE_TASK_LIMIT } from "./task.entity.js";

export class TaskLimitError extends Error {
  constructor(message: string = "Task limit reached") {
    super(message);
    this.name = "TaskLimitError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(message: string = "Task not found") {
    super(message);
    this.name = "TaskNotFoundError";
  }
}

export class TaskService {
  constructor(private readonly taskRepository: TaskRepositoryPort) {}

  async createTask(
    user: UserForTaskService,
    data: { title: string; description: string }
  ): Promise<Task> {
    if (!user.isPremium) {
      return this.taskRepository.transaction(async (tx) => {
        const currentCount = await tx.countByOwnerId(user.id);
        if (currentCount >= FREE_TASK_LIMIT) {
          throw new TaskLimitError(
            `Free users can only create ${String(FREE_TASK_LIMIT)} tasks. Upgrade to premium for unlimited tasks!`
          );
        }
        return tx.create({ ...data, ownerId: user.id });
      });
    }

    return this.taskRepository.create({
      ...data,
      ownerId: user.id,
    });
  }

  async listTasks(user: UserForTaskService): Promise<Task[]> {
    return this.taskRepository.listByOwnerId(user.id);
  }

  async deleteTask(user: UserForTaskService, taskId: string): Promise<Task> {
    const task = await this.taskRepository.deleteByIdAndOwnerId(
      taskId,
      user.id
    );
    if (!task) {
      throw new TaskNotFoundError();
    }
    return task;
  }

  async updateTaskStatus(
    user: UserForTaskService,
    taskId: string,
    status: TaskStatus
  ): Promise<Task> {
    const task = await this.taskRepository.updateStatusByIdAndOwnerId(
      taskId,
      user.id,
      status
    );
    if (!task) {
      throw new TaskNotFoundError();
    }
    return task;
  }
}
