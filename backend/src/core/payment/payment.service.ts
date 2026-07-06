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
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
  ): Effect.Effect<string, Error> {
    return Effect.gen(this, function* () {
      const session = yield* Effect.tryPromise({
        try: () =>
          this.stripeGateway.createCheckoutSession(
            userId,
            customerEmail,
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
      const sessionId = this.stripeGateway.getSessionId(event);
      if (!sessionId) {
        console.error("No session ID in event");
        return;
      }

      // Atomic: idempotency check + processing in one Prisma transaction.
      // Two concurrent Stripe webhooks for the same event serialize here —
      // the second one sees the already-processed record and does nothing.
      yield* Effect.tryPromise({
        try: () =>
          this.paymentRepo.transaction(async (tx) => {
            const alreadyProcessed = await tx.findByEventId(eventId);
            if (alreadyProcessed) {
              console.error(`Event ${eventId} already processed`);
              return;
            }

            const payment = await tx.findBySessionId(sessionId);
            if (!payment) {
              throw new Error(`Payment not found for session ${sessionId}`);
            }

            if (event.type === "checkout.session.completed") {
              await tx.updateStatus(payment.id, "COMPLETED", eventId);
              await this.userRepo.transaction(async (txUserRepo) => {
                await txUserRepo.updateToPremium(payment.ownerId);
              });
            } else {
              await tx.updateStatus(payment.id, "FAILED", eventId);
            }
          }),
        catch: (e) => {
          if (e instanceof Error && e.message.startsWith("Payment not found for session")) {
            return new PaymentRecordNotFound({ sessionId });
          }
          return e instanceof Error ? e : new Error(String(e));
        },
      });
    });
  }
}
