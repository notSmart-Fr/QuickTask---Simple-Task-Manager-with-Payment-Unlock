import express from "express";
import cors from "cors";
import "express-async-errors";
import { z } from "zod";
import config from "./config.js";
import { createAuthRouter } from "./api/auth.routes.js";
import { createTaskRouter } from "./api/task.routes.js";
import { createPaymentRouter } from "./api/payment.routes.js";
import { AuthService } from "./core/auth/auth.service.js";
import { TaskService } from "./core/task/task.service.js";
import { PaymentService } from "./core/payment/payment.service.js";
import { PrismaUserRepository } from "./adapters/prisma/prisma-user.repository.js";
import { PrismaTaskRepository } from "./adapters/prisma/prisma-task.repository.js";
import { PrismaPaymentRepository } from "./adapters/prisma/prisma-payment.repository.js";
import { BcryptHasher } from "./adapters/bcrypt/bcrypt-hasher.adapter.js";
import { JwtToken } from "./adapters/jwt/jwt-token.adapter.js";
import { StripeGateway } from "./adapters/stripe/stripe-gateway.adapter.js";
import { PrismaClient } from "@prisma/client";

// Composition root — the ONLY place adapters are instantiated
const prisma = new PrismaClient();
const userRepo = new PrismaUserRepository(prisma);
const hasher = new BcryptHasher();
const tokenService = new JwtToken();
const authService = new AuthService(userRepo, hasher, tokenService);
const authRoutes = createAuthRouter(authService);

const taskRepo = new PrismaTaskRepository(prisma);
const taskService = new TaskService(taskRepo);
const taskRoutes = createTaskRouter(taskService);

const paymentRepo = new PrismaPaymentRepository(prisma);
const stripeGateway = new StripeGateway();
const paymentService = new PaymentService(paymentRepo, userRepo, stripeGateway);
const paymentRoutes = createPaymentRouter(paymentService);

const app = express();

app.use(
  cors({
    origin: config.FRONTEND_URL.replace(/\/+$/, ""),
  }),
);
app.use(express.json({
  verify: (req, _res, buf) => {
    // Capture raw body for Stripe webhook signature verification
    (req as unknown as { rawBody: Buffer }).rawBody = buf;
  },
}));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/payment", paymentRoutes);

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

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${String(PORT)}`);
});

// ── Graceful shutdown ──
// ponytail: SIGTERM/SIGINT → stop accepting → drain in-flight → disconnect DB → exit
const shutdown = (signal: string) => {
  console.error(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    void prisma.$disconnect().then(() => {
      console.error("Server shut down cleanly");
      process.exit(0);
    });
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => { shutdown("SIGTERM"); });
process.on("SIGINT", () => { shutdown("SIGINT"); });

export default app;
