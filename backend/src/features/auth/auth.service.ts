import { PrismaClient } from "@prisma/client";
import { Effect, Data } from "effect";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../../config.js";

// --------------- User entity ---------------

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --------------- Port interfaces ---------------

export interface Hasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface TokenService {
  sign(userId: string, name: string, email: string, isPremium: boolean): string;
  verify(token: string): { userId: string; name: string; email: string; isPremium: boolean };
}

// --------------- Adapter implementations ---------------

export class BcryptHasher implements Hasher {
  private readonly SALT_ROUNDS = 12;

  async hash(password: string): Promise<string> {
    return bcryptjs.hash(password, this.SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }
}

export class JwtToken implements TokenService {
  private readonly SECRET = config.JWT_SECRET;
  private readonly EXPIRY = "7d";

  sign(userId: string, name: string, email: string, isPremium: boolean): string {
    return jwt.sign({ userId, name, email, isPremium }, this.SECRET, {
      expiresIn: this.EXPIRY,
    });
  }

  verify(token: string): { userId: string; name: string; email: string; isPremium: boolean } {
    const decoded = jwt.verify(token, this.SECRET) as {
      userId: string;
      name: string;
      email: string;
      isPremium: boolean;
    };
    return {
      userId: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      isPremium: decoded.isPremium,
    };
  }
}

// --------------- Typed domain errors ---------------

export class EmailAlreadyRegistered extends Data.TaggedError(
  "EmailAlreadyRegistered",
)<Record<string, never>> {}

export class InvalidCredentials extends Data.TaggedError(
  "InvalidCredentials",
)<Record<string, never>> {}

// --------------- Service ---------------

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: Hasher = new BcryptHasher(),
    private readonly tokenService: TokenService = new JwtToken(),
  ) {}

  // ponytail: returns fresh DB data so isPremium is never stale (JWT is immutable)
  getUserWithFreshToken(
    id: string,
  ): Effect.Effect<{ user: User; token: string } | null, Error> {
    return Effect.gen(this, function* () {
      const user = yield* Effect.tryPromise({
        try: () => this.prisma.user.findUnique({ where: { id } }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });
      if (!user) return null;
      const token = this.tokenService.sign(
        user.id,
        user.name,
        user.email,
        user.isPremium,
      );
      return { user, token };
    });
  }

  register(
    name: string,
    email: string,
    password: string,
  ): Effect.Effect<
    { user: User; token: string },
    EmailAlreadyRegistered | Error
  > {
    return Effect.gen(this, function* () {
      const existingUser = yield* Effect.tryPromise({
        try: () => this.prisma.user.findUnique({ where: { email } }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (existingUser) {
        return yield* Effect.fail(new EmailAlreadyRegistered({}));
      }

      const passwordHash = yield* Effect.tryPromise({
        try: () => this.hasher.hash(password),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const user = yield* Effect.tryPromise({
        try: () =>
          this.prisma.user.create({ data: { name, email, passwordHash } }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const token = this.tokenService.sign(
        user.id,
        user.name,
        user.email,
        user.isPremium,
      );
      return { user, token };
    });
  }

  login(
    email: string,
    password: string,
  ): Effect.Effect<
    { user: User; token: string },
    InvalidCredentials | Error
  > {
    return Effect.gen(this, function* () {
      const user = yield* Effect.tryPromise({
        try: () => this.prisma.user.findUnique({ where: { email } }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!user) {
        return yield* Effect.fail(new InvalidCredentials({}));
      }

      const valid = yield* Effect.tryPromise({
        try: () => this.hasher.compare(password, user.passwordHash),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!valid) {
        return yield* Effect.fail(new InvalidCredentials({}));
      }

      const token = this.tokenService.sign(
        user.id,
        user.name,
        user.email,
        user.isPremium,
      );
      return { user, token };
    });
  }
}
