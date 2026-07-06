import { Effect, Data } from "effect";
import type { PaymentRepositoryPort, PaymentGatewayPort } from "./payment.port.js";
import type { UserRepositoryPort } from "../auth/auth.port.js";

// --------------- Typed domain errors ---------------

export class WebhookVerificationFailed extends Data.TaggedError(
  "WebhookVerificationFailed",
)<{ message: string }> {}

export class PaymentRecordNotFound extends Data.TaggedError(
  "PaymentRecordNotFound",
)<{ sessionId: string }> {}

// --------------- Service ---------------

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly stripeGateway: PaymentGatewayPort,
  ) {}

  createCheckout(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Effect.Effect<string, Error> {
    return Effect.gen(this, function* () {
      const session = yield* Effect.tryPromise({
        try: () =>
          this.stripeGateway.createCheckoutSession(
            userId,
            successUrl,
            cancelUrl,
          ),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      yield* Effect.tryPromise({
        try: () =>
          this.paymentRepo.create({
            ownerId: userId,
            stripeSessionId: session.sessionId,
            status: "PENDING",
          }),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      return session.checkoutUrl;
    });
  }

  handleWebhook(
    body: Buffer,
    signature: string,
  ): Effect.Effect<void, WebhookVerificationFailed | PaymentRecordNotFound | Error> {
    return Effect.gen(this, function* () {
      // Verify signature
      // verifyWebhookSignature is synchronous but can throw
      const event = yield* Effect.try({
        try: () => this.stripeGateway.verifyWebhookSignature(body, signature),
        catch: (e) =>
          new WebhookVerificationFailed({
            message: e instanceof Error ? e.message : "Invalid signature",
          }),
      });

      const eventId = this.stripeGateway.getEventId(event);

      // Idempotency check
      const existingPayment = yield* Effect.tryPromise({
        try: () => this.paymentRepo.findByEventId(eventId),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (existingPayment) {
        console.error(`Event ${eventId} already processed`);
        return;
      }

      const sessionId = this.stripeGateway.getSessionId(event);
      if (!sessionId) {
        console.error("No session ID in event");
        return;
      }

      const payment = yield* Effect.tryPromise({
        try: () => this.paymentRepo.findBySessionId(sessionId),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      if (!payment) {
        return yield* Effect.fail(
          new PaymentRecordNotFound({ sessionId }),
        );
      }

      if (event.type === "checkout.session.completed") {
        // Atomic upgrade via Prisma transaction
        // ponytail: Prisma $transaction uses plain async, wrap in Effect.tryPromise
        yield* Effect.tryPromise({
          try: () =>
            this.paymentRepo.transaction(async (txPaymentRepo) => {
              await txPaymentRepo.updateStatus(payment.id, "COMPLETED", eventId);
              await this.userRepo.transaction(async (txUserRepo) => {
                await txUserRepo.updateToPremium(payment.ownerId);
              });
            }),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        });
      } else {
        yield* Effect.tryPromise({
          try: () => this.paymentRepo.updateStatus(payment.id, "FAILED", eventId),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        });
      }
    });
  }
}
