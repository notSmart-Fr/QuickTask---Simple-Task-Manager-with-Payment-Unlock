import { PrismaClient, Prisma } from '@prisma/client';
import type { User } from '../../core/auth/user.entity.js';
import type { UserRepositoryPort } from '../../core/auth/auth.port.js';

export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async transaction<T>(fn: (txRepo: UserRepositoryPort) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient;
    return client.$transaction(async (tx) => {
      const txRepo = new PrismaUserRepository(tx);
      return fn(txRepo);
    });
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data,
    });
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user;
  }

  async updateToPremium(id: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isPremium: true },
    });
    return user;
  }
}
