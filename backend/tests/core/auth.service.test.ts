import { describe, it, expect, vi } from "vitest";
import { Effect, Either } from "effect";
import { AuthService } from "../../src/features/auth/auth.service.js";
import type { Hasher, TokenService } from "../../src/features/auth/auth.service.js";
import { PrismaClient } from "@prisma/client";

type MockPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeAuthService(mocks: {
  prisma?: { user?: Partial<MockPrisma["user"]> };
  hasher?: Partial<Hasher>;
  tokenService?: Partial<TokenService>;
}) {
  const prisma = makeMockPrisma();
  Object.assign(prisma.user, mocks.prisma?.user);

  const hasher: Hasher = {
    hash: vi.fn(),
    compare: vi.fn(),
    ...mocks.hasher,
  };
  const tokenService: TokenService = {
    sign: vi.fn(),
    verify: vi.fn(),
    ...mocks.tokenService,
  };
  return {
    authService: new AuthService(prisma as unknown as PrismaClient, hasher, tokenService),
    prisma,
    hasher,
    tokenService,
  };
}

describe("AuthService.register", () => {
  it("creates a user and returns a token on success", async () => {
    const { authService, prisma, hasher } = makeAuthService({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "user-1",
            name: "Alice",
            email: "alice@test.com",
            passwordHash: "hashed-password",
            isPremium: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
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
      expect(either.right.token).toBe("jwt-token");
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "alice@test.com" } });
      expect(hasher.hash).toHaveBeenCalledWith("password123");
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { name: "Alice", email: "alice@test.com", passwordHash: "hashed-password" },
      });
    }
  });

  it("fails with EmailAlreadyRegistered when email exists", async () => {
    const { authService } = makeAuthService({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "existing",
            name: "Existing",
            email: "alice@test.com",
          }),
        },
      },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.register("Alice", "alice@test.com", "password123"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("EmailAlreadyRegistered");
    }
  });
});

describe("AuthService.login", () => {
  it("returns user and token on valid credentials", async () => {
    const user = {
      id: "user-1",
      name: "Alice",
      email: "alice@test.com",
      passwordHash: "hashed-password",
      isPremium: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { authService } = makeAuthService({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue(user) } },
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
      expect(either.right.token).toBe("jwt-token");
    }
  });

  it("fails with InvalidCredentials for unknown email", async () => {
    const { authService } = makeAuthService({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.login("unknown@test.com", "password123"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("InvalidCredentials");
    }
  });

  it("fails with InvalidCredentials for wrong password", async () => {
    const user = {
      id: "user-1",
      name: "Alice",
      email: "alice@test.com",
      passwordHash: "hashed",
      isPremium: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { authService } = makeAuthService({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue(user) } },
      hasher: { compare: vi.fn().mockResolvedValue(false) },
    });

    const either = await Effect.runPromise(
      Effect.either(
        authService.login("alice@test.com", "wrong-password"),
      ),
    );

    expect(Either.isLeft(either)).toBe(true);
    if (Either.isLeft(either)) {
      expect((either.left as { _tag: string })._tag).toBe("InvalidCredentials");
    }
  });
});
