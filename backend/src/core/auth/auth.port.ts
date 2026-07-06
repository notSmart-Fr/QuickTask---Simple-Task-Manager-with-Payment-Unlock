import type { User } from './user.entity.js';

export interface UserRepositoryPort {
  create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updateToPremium(id: string): Promise<User>;
  transaction<T>(fn: (txRepo: UserRepositoryPort) => Promise<T>): Promise<T>;
}

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface TokenPort {
  sign(userId: string, name: string, email: string, isPremium: boolean): string;
  verify(token: string): { userId: string; name: string; email: string; isPremium: boolean };
}
