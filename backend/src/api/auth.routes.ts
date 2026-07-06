import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Effect, Either } from "effect";
import type { AuthService } from "../core/auth/auth.service.js";
import { NameSchema, EmailSchema, PasswordSchema } from "../shared/schemas.js";
import authMiddleware from "./middleware/auth.middleware.js";

const RegisterInputSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post("/register", async (req: Request, res: Response) => {
    // Step 1: Zod validates shape at the boundary
    const result = RegisterInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message ?? "Invalid input" });
    }

    // Step 2: Effect.either converts typed errors to values — runPromise never throws
    const either = await Effect.runPromise(
      Effect.either(
        authService.register(result.data.name, result.data.email, result.data.password),
      ),
    );

    if (Either.isLeft(either)) {
      if (either.left._tag === "EmailAlreadyRegistered") {
        return res.status(409).json({ error: "Email already registered" });
      }
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }

    const { user, token } = either.right;
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
      token,
    });
  });

  router.post("/login", async (req: Request, res: Response) => {
    const result = LoginInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message ?? "Invalid input" });
    }

    const either = await Effect.runPromise(
      Effect.either(
        authService.login(result.data.email, result.data.password),
      ),
    );

    if (Either.isLeft(either)) {
      if (either.left._tag === "InvalidCredentials") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      console.error(either.left);
      return res.status(500).json({ error: "Internal server error" });
    }

    const { user, token } = either.right;
    res.json({
      user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
      token,
    });
  });

  router.get("/me", authMiddleware, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json(req.user);
  });

  return router;
}
