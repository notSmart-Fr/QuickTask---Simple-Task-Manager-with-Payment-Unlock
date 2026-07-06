import express from "express";
import cors from "cors";
import "express-async-errors";
import { z } from "zod";
import config from "./config.js";
import { createAuthRouter } from "./api/auth.routes.js";
import { createTaskRouter } from "./api/task.routes.js";
import { AuthService } from "./core/auth/auth.service.js";
import { TaskService } from "./core/task/task.service.js";
import { PrismaUserRepository } from "./adapters/prisma/prisma-user.repository.js";
import { PrismaTaskRepository } from "./adapters/prisma/prisma-task.repository.js";
import { BcryptHasher } from "./adapters/bcrypt/bcrypt-hasher.adapter.js";
import { JwtToken } from "./adapters/jwt/jwt-token.adapter.js";
import { PrismaClient } from "@prisma/client";

// Composition root — the ONLY place adapters are instantiated
const prisma = new PrismaClient();
const userRepo = new PrismaUserRepository();
const hasher = new BcryptHasher();
const tokenService = new JwtToken();
const authService = new AuthService(userRepo, hasher, tokenService);
const authRoutes = createAuthRouter(authService);

const taskRepo = new PrismaTaskRepository(prisma);
const taskService = new TaskService(taskRepo);
const taskRoutes = createTaskRouter(taskService);

const app = express();

app.use(
  cors({
    origin: config.FRONTEND_URL,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tasks", taskRoutes);

// Error handling middleware
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? "Invalid input" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${String(PORT)}`);
});

export default app;
