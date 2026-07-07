import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Effect, Either } from "effect";
import { AuthService } from "./auth.service.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const RegisterInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be ≤ 100 characters"),
  email: z.string().email("Invalid email address").trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginInputSchema = z.object({
  email: z.string().email("Invalid email address").trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ── Route handlers extracted for line-length compliance ──

function handleError(res: Response, error: unknown, status: number, message: string) {
  if ("_tag" in (error as object)) {
    return res.status(status).json({ error: message });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}

async function handleRegister(req: Request, res: Response, authService: AuthService) {
  const result = RegisterInputSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: result.error.errors[0]?.message ?? "Invalid input" });
  }

  const either = await Effect.runPromise(
    Effect.either(
      authService.register(
        result.data.name,
        result.data.email,
        result.data.password,
      ),
    ),
  );

  if (Either.isLeft(either)) {
    return handleError(res, either.left, 409, "Email already registered");
  }

  const { user, token } = either.right;
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
    token,
  });
}

async function handleLogin(req: Request, res: Response, authService: AuthService) {
  const result = LoginInputSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: result.error.errors[0]?.message ?? "Invalid input" });
  }

  const either = await Effect.runPromise(
    Effect.either(authService.login(result.data.email, result.data.password)),
  );

  if (Either.isLeft(either)) {
    return handleError(res, either.left, 401, "Invalid credentials");
  }

  const { user, token } = either.right;
  res.json({
    user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium },
    token,
  });
}

async function handleMe(req: Request, res: Response, authService: AuthService) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ponytail: read from DB so isPremium reflects webhook updates, not stale JWT
  const either = await Effect.runPromise(
    Effect.either(authService.getUserWithFreshToken(req.user.id)),
  );

  if (Either.isLeft(either)) {
    console.error(either.left);
    return res.status(500).json({ error: "Internal server error" });
  }

  const result = either.right;
  if (!result) {
    return res.status(401).json({ error: "User not found" });
  }

  res.json(result);
}

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post("/register", (req: Request, res: Response) =>
    handleRegister(req, res, authService),
  );
  router.post("/login", (req: Request, res: Response) =>
    handleLogin(req, res, authService),
  );
  router.get("/me", authMiddleware, (req: Request, res: Response) =>
    handleMe(req, res, authService),
  );

  return router;
}
