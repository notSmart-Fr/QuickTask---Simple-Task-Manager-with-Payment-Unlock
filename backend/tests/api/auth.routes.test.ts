import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Effect } from "effect";
import { createAuthRouter } from "../../src/features/auth/auth.routes.js";
import { EmailAlreadyRegistered, InvalidCredentials } from "../../src/features/auth/auth.service.js";
import type { AuthService } from "../../src/features/auth/auth.service.js";

function makeApp(authService: Partial<AuthService>) {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", createAuthRouter(authService as AuthService));
  return app;
}

describe("POST /api/v1/auth/register", () => {
  it("returns 201 with user and token on success", async () => {
    const app = makeApp({
      register: vi.fn().mockReturnValue(
        Effect.succeed({
          user: { id: "u1", name: "Alice", email: "a@b.com", isPremium: false },
          token: "jwt-token",
        }),
      ),
    });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Alice", email: "a@b.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe("jwt-token");
  });

  it("returns 400 for invalid input (short password)", async () => {
    const app = makeApp({});

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Alice", email: "a@b.com", password: "123" });

    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    const app = makeApp({
      register: vi.fn().mockReturnValue(
        Effect.fail(new EmailAlreadyRegistered({})),
      ),
    });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Alice", email: "a@b.com", password: "password123" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns 200 with user and token on success", async () => {
    const app = makeApp({
      login: vi.fn().mockReturnValue(
        Effect.succeed({
          user: { id: "u1", name: "Alice", email: "a@b.com", isPremium: false },
          token: "jwt-token",
        }),
      ),
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("jwt-token");
  });

  it("returns 401 for invalid credentials", async () => {
    const app = makeApp({
      login: vi.fn().mockReturnValue(
        Effect.fail(new InvalidCredentials({})),
      ),
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.com", password: "wrongpass" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    const app = makeApp({});

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns 401 without auth header", async () => {
    const app = makeApp({});

    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
  });
});
