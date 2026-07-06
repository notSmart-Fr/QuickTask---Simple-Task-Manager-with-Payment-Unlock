import bcryptjs from 'bcryptjs';
import type { PasswordHasherPort } from '../../core/auth/auth.port.js';

export class BcryptHasher implements PasswordHasherPort {
  private readonly SALT_ROUNDS = 12;

  async hash(password: string): Promise<string> {
    return bcryptjs.hash(password, this.SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }
}
