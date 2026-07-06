import { Effect, Data } from "effect";
import type {
  UserRepositoryPort,
  PasswordHasherPort,
  TokenPort,
} from "./auth.port.js";
import type { User } from "./user.entity.js";

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
    private readonly userRepo: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokenService: TokenPort,
  ) {}

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
        try: () => this.userRepo.findByEmail(email),
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
        try: () => this.userRepo.create({ name, email, passwordHash }),
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
        try: () => this.userRepo.findByEmail(email),
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
