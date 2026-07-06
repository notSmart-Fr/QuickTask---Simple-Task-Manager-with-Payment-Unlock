import type {
  UserRepositoryPort,
  PasswordHasherPort,
  TokenPort,
} from './auth.port.js';
import type { User } from './user.entity.js';

export class AuthService {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokenService: TokenPort,
  ) {}

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<{ user: User; token: string }> {
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await this.hasher.hash(password);
    const user = await this.userRepo.create({
      name,
      email,
      passwordHash,
    });

    const token = this.tokenService.sign(user.id, user.name, user.email, user.isPremium);
    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const valid = await this.hasher.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const token = this.tokenService.sign(user.id, user.name, user.email, user.isPremium);
    return { user, token };
  }
}
