import type { Payment } from "./payment.entity.js";

// ponytail: Stripe SDK types are heavy and would add 100+ types to the port.
// Define minimal interfaces for what we actually use.
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
    };
  };
}

export interface StripeCheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentGatewayPort {
  createCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeCheckoutSession>;

  verifyWebhookSignature(
    body: Buffer,
    signature: string,
  ): StripeWebhookEvent;

  getEventId(event: StripeWebhookEvent): string;
  getSessionId(event: StripeWebhookEvent): string | null;
}

export interface PaymentRepositoryPort {
  create(data: {
    ownerId: string;
    stripeSessionId: string;
    status: "PENDING" | "COMPLETED" | "FAILED";
  }): Promise<Payment>;
  findBySessionId(stripeSessionId: string): Promise<Payment | null>;
  findByEventId(stripeEventId: string): Promise<Payment | null>;
  updateStatus(
    id: string,
    status: "PENDING" | "COMPLETED" | "FAILED",
    stripeEventId?: string,
  ): Promise<Payment | null>;
  listByUser(ownerId: string): Promise<Payment[]>;
  transaction<T>(
    fn: (txRepo: PaymentRepositoryPort) => Promise<T>,
  ): Promise<T>;
}
