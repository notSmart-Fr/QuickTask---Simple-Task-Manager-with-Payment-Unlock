import { PrismaClient, Prisma, type Task as PrismaTask } from "@prisma/client";
import type { Task, TaskStatus } from "../../core/task/task.entity.js";
import type { TaskRepositoryPort } from "../../core/task/task.port.js";

export class PrismaTaskRepository implements TaskRepositoryPort {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  // Starts a new DB transaction (safe: PrismaClient has $transaction,
  // Prisma.TransactionClient doesn't, but we only construct with TransactionClient
  // inside an existing transaction — where nesting is unnecessary)
  async transaction<T>(fn: (txRepo: TaskRepositoryPort) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient;
    return client.$transaction(async (tx) => {
      const txRepo = new PrismaTaskRepository(tx);
      return fn(txRepo);
    });
  }

  async listByOwnerId(ownerId: string): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      where: { ownerId },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
    return tasks.map((t) => this.toDomainTask(t));
  }

  async listByOwnerIdAndStatus(ownerId: string, status: TaskStatus): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      where: { ownerId, status },
      orderBy: { position: "asc" },
    });
    return tasks.map((t) => this.toDomainTask(t));
  }

  async create(data: {
    title: string;
    description: string;
    ownerId: string;
  }): Promise<Task> {
    const count = await this.prisma.task.count({
      where: { ownerId: data.ownerId, status: "TODO" },
    });
    const task = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
        position: count,
      },
    });
    return this.toDomainTask(task);
  }

  async deleteByIdAndOwnerId(
    id: string,
    ownerId: string
  ): Promise<Task | null> {
    try {
      const task = await this.prisma.task.delete({
        where: { id, ownerId },
      });
      // Shift remaining tasks in the same column down by 1
      await this.prisma.task.updateMany({
        where: {
          ownerId,
          status: task.status,
          position: { gt: task.position },
        },
        data: { position: { decrement: 1 } },
      });
      return this.toDomainTask(task);
    } catch {
      return null;
    }
  }

  async findByIdAndOwnerId(
    id: string,
    ownerId: string
  ): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id, ownerId },
    });
    return task ? this.toDomainTask(task) : null;
  }

  async updateStatusByIdAndOwnerId(
    id: string,
    ownerId: string,
    status: TaskStatus,
    position?: number
  ): Promise<Task | null> {
    try {
      const updateData: Prisma.TaskUpdateInput = { status };
      if (position !== undefined) {
        updateData.position = position;
      }
      const task = await this.prisma.task.update({
        where: { id, ownerId },
        data: updateData,
      });
      return this.toDomainTask(task);
    } catch {
      return null;
    }
  }

  async shiftPositions(
    ownerId: string,
    status: TaskStatus,
    fromPosition: number,
    delta: number
  ): Promise<void> {
    await this.prisma.task.updateMany({
      where: {
        ownerId,
        status,
        position: { gte: fromPosition },
      },
      data: { position: { increment: delta } },
    });
  }

  async countByOwnerId(ownerId: string): Promise<number> {
    return this.prisma.task.count({
      where: { ownerId },
    });
  }

  private toDomainTask(prismaTask: PrismaTask): Task {
    return {
      id: prismaTask.id,
      title: prismaTask.title,
      description: prismaTask.description,
      status: prismaTask.status,
      position: prismaTask.position,
      ownerId: prismaTask.ownerId,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
    };
  }
}
