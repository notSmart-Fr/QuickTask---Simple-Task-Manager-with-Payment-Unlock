import { Router, type Request, type Response, type RequestHandler } from "express";
import { z } from "zod";
import { Effect, Either } from "effect";
import type { PaymentService } from "../core/payment/payment.service.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import express from "express";

const CreateCheckoutSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

function getUser(req: Request) {
  if (!req.user) throw new Error("Unauthorized");
  return { id: req.user.id, isPremium: req.user.isPremium };
}

// Typed raw body parser for Stripe webhook signature verification.
// express.raw returns a RequestHandler with Buffer body.
const rawBodyParser: RequestHandler = express.raw({
  type: "application/json",
  limit: "1mb",
});

export function createPaymentRouter(paymentService: PaymentService) {
  const router = Router();

  router.post(
    "/create-checkout",
    authMiddleware,
    async (req: Request, res: Response) => {
      const result = CreateCheckoutSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: result.error.errors[0]?.message ?? "Invalid input" });
      }

      const either = await Effect.runPromise(
        Effect.either(
          paymentService.createCheckout(
            getUser(req).id,
            result.data.successUrl,
            result.data.cancelUrl,
          ),
        ),
      );

      if (Either.isLeft(either)) {
        console.error(either.left);
        return res.status(500).json({ error: "Internal server error" });
      }

      res.status(201).json({ checkoutUrl: either.right });
    },
  );

  router.post(
    "/webhook",
    rawBodyParser,
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return res
          .status(400)
          .json({ error: "Missing stripe-signature header" });
      }

      // express.raw gives us a Buffer in req.body
      const rawBody = Buffer.from(req.body as ArrayBuffer);

      const either = await Effect.runPromise(
        Effect.either(paymentService.handleWebhook(rawBody, signature)),
      );

      if (Either.isLeft(either)) {
        if (either.left._tag === "WebhookVerificationFailed") {
          return res.status(400).json({ error: either.left.message });
        }
        if (either.left._tag === "PaymentRecordNotFound") {
          return res
            .status(404)
            .json({
              error: `Payment not found for session ${String(either.left.sessionId)}`,
            });
        }
        console.error(either.left);
        return res.status(500).json({ error: "Internal server error" });
      }

      res.status(200).json({ received: true });
    },
  );

  router.get("/status", authMiddleware, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ isPremium: req.user.isPremium });
  });

  return router;
}
