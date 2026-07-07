import { Effect, Data } from "effect";
import { PrismaClient } from "@prisma/client";

// --------------- Exported types ---------------

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface Payment {
  id: string;
  ownerId: string;
  stripeSessionId: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
    };
  };
}

export interface PaymentGateway {
  createCheckoutSession(
    userId: string,
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSession>;

  verifyWebhookSignature(body: Buffer, signature: string): WebhookEvent;
  getEventId(event: WebhookEvent): string;
  getSessionId(event: WebhookEvent): string | null;
}

// --------------- Typed domain errors ---------------

export class WebhookVerificationFailed extends Data.TaggedError(
  "WebhookVerificationFailed",
)<{ message: string }> {}

export class PaymentRecordNotFound extends Data.TaggedError(
  "PaymentRecordNotFound",
)<{ sessionId: string }> {}

// --------------- Helpers ---------------

// --------------- Service ---------------

export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: PaymentGateway,
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
          this.gateway.createCheckoutSession(
            userId,
            customerEmail,
            successUrl,
            cancelUrl,
          ),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      yield* Effect.tryPromise({
        try: () =>
          this.prisma.payment.create({
            data: {
              userId,
              stripeSessionId: session.sessionId,
              status: "PENDING",
            },
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
      const event = yield* Effect.try({
        try: () => this.gateway.verifyWebhookSignature(body, signature),
        catch: (e) =>
          new WebhookVerificationFailed({
            message: e instanceof Error ? e.message : "Invalid signature",
          }),
      });

      const eventId = this.gateway.getEventId(event);
      const sessionId = this.gateway.getSessionId(event);
      if (!sessionId) {
        console.error("No session ID in event");
        return;
      }

      yield* Effect.tryPromise({
        try: () =>
          this.prisma.$transaction(async (tx) => {
            const alreadyProcessed = await tx.payment.findFirst({
              where: { stripeEventId: eventId },
            });
            if (alreadyProcessed) {
              console.error(`Event ${eventId} already processed`);
              return;
            }

            const payment = await tx.payment.findUnique({
              where: { stripeSessionId: sessionId },
            });
            if (!payment) {
              throw new Error(
                `Payment not found for session ${sessionId}`,
              );
            }

            if (event.type === "checkout.session.completed") {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: "COMPLETED", stripeEventId: eventId },
              });
              await tx.user.update({
                where: { id: payment.userId },
                data: { isPremium: true },
              });
            } else {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: "FAILED", stripeEventId: eventId },
              });
            }
          }),
        catch: (e) => {
          if (
            e instanceof Error &&
            e.message.startsWith("Payment not found for session")
          ) {
            return new PaymentRecordNotFound({ sessionId });
          }
          return e instanceof Error ? e : new Error(String(e));
        },
      });
    });
  }
}
