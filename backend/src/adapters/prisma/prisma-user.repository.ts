import { PrismaClient } from '@prisma/client';
import type { User } from '../../core/auth/user.entity.js';
import type { UserRepositoryPort } from '../../core/auth/auth.port.js';

const prisma = new PrismaClient();

export class PrismaUserRepository implements UserRepositoryPort {
  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const user = await prisma.user.create({
      data,
    });
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user;
  }

  async updateToPremium(id: string): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: { isPremium: true },
    });
    return user;
  }
}
