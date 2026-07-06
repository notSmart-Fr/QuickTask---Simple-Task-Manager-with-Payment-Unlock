import type { Task, TaskStatus } from "./task.entity.js";

export interface TaskRepositoryPort {
  listByOwnerId(ownerId: string): Promise<Task[]>;
  listByOwnerIdAndStatus(ownerId: string, status: TaskStatus): Promise<Task[]>;
  create(data: {
    title: string;
    description: string;
    ownerId: string;
  }): Promise<Task>;
  deleteByIdAndOwnerId(id: string, ownerId: string): Promise<Task | null>;
  findByIdAndOwnerId(id: string, ownerId: string): Promise<Task | null>;
  updateStatusByIdAndOwnerId(
    id: string,
    ownerId: string,
    status: TaskStatus,
    position?: number
  ): Promise<Task | null>;
  shiftPositions(
    ownerId: string,
    status: TaskStatus,
    fromPosition: number,
    delta: number
  ): Promise<void>;
  countByOwnerId(ownerId: string): Promise<number>;
  transaction<T>(fn: (tx: TaskRepositoryPort) => Promise<T>): Promise<T>;
}
