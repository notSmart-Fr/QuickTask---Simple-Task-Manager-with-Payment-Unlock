import { describe, it, expect, vi } from "vitest";
import { Effect, Either } from "effect";
import { AuthService } from "../../src/core/auth/auth.service.js";
import type { UserRepositoryPort } from "../../src/core/auth/auth.port.js";
import type { PasswordHasherPort } from "../../src/core/auth/auth.port.js";
import type { TokenPort } from "../../src/core/auth/auth.port.js";
import type { User } from "../../src/core/auth/user.entity.js";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  passwordHash: "hashed-password",
  isPremium: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function makeAuthService(mocks: {
  userRepo?: Partial<UserRepositoryPort>;
  hasher?: Partial<PasswordHasherPort>;
  tokenService?: Partial<TokenPort>;
}) {
  const userRepo: UserRepositoryPort = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    updateToPremium: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn) => fn(userRepo)),
    ...mocks.userRepo,
  };
  const hasher: PasswordHasherPort = {
    hash: vi.fn(),
    compare: vi.fn(),
    ...mocks.hasher,
  };
  const tokenService: TokenPort = {
    sign: vi.fn(),
    verify: vi.fn(),
    ...mocks.tokenService,
  };
  return {
    authService: new AuthService(userRepo, hasher, tokenService),
    userRepo,
    hasher,
    tokenService,
  };
}

describe("AuthService.register", () => {
  it("creates a user and returns a token on success", async () => {
    const user = makeUser();
    const { authService, userRepo, hasher, tokenService } = makeAuthService({
      userRepo: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(user),
      },
      hasher: { hash: vi.fn().mockResolvedValue("hashed-password") },
      tokenService: { sign: vi.fn().mockReturnValue("jwt-token") },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.register("Alice", "alice@test.com", "password123"),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.user).toEqual(user);
      expect(either.right.token).toBe("jwt-token");
      expect(userRepo.findByEmail).toHaveBeenCalledWith("alice@test.com");
      expect(hasher.hash).toHaveBeenCalledWith("password123");
      expect(userRepo.create).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@test.com",
        passwordHash: "hashed-password",
      });
    }
  });

  it("fails with EmailAlreadyRegistered when email exists", async () => {
    const { authService } = makeAuthService({
      userRepo: { findByEmail: vi.fn().mockResolvedValue(makeUser()) },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.register("Alice", "alice@test.com", "password123"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect(either.left._tag).toBe("EmailAlreadyRegistered");
    }
  });
});

describe("AuthService.login", () => {
  it("returns user and token on valid credentials", async () => {
    const user = makeUser();
    const { authService, userRepo, hasher, tokenService } = makeAuthService({
      userRepo: { findByEmail: vi.fn().mockResolvedValue(user) },
      hasher: { compare: vi.fn().mockResolvedValue(true) },
      tokenService: { sign: vi.fn().mockReturnValue("jwt-token") },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.login("alice@test.com", "password123"),
      ),
    );

    expect(Either.isRight(either)).toBe(true);
    if (Either.isRight(either)) {
      expect(either.right.user).toEqual(user);
      expect(either.right.token).toBe("jwt-token");
    }
  });

  it("fails with InvalidCredentials for unknown email", async () => {
    const { authService } = makeAuthService({
      userRepo: { findByEmail: vi.fn().mockResolvedValue(null) },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.login("unknown@test.com", "password123"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect(either.left._tag).toBe("InvalidCredentials");
    }
  });

  it("fails with InvalidCredentials for wrong password", async () => {
    const user = makeUser();
    const { authService } = makeAuthService({
      userRepo: { findByEmail: vi.fn().mockResolvedValue(user) },
      hasher: { compare: vi.fn().mockResolvedValue(false) },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.login("alice@test.com", "wrong-password"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect(either.left._tag).toBe("InvalidCredentials");
    }
  });
});
