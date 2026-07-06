import Stripe from "stripe";
import config from "../../config.js";
import type {
  PaymentGatewayPort,
  StripeWebhookEvent,
  StripeCheckoutSession,
} from "../../core/payment/payment.port.js";

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export class StripeGateway implements PaymentGatewayPort {
  async createCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeCheckoutSession> {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "QuickTask Unlimited Tasks",
            },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ],
      client_reference_id: userId,
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  verifyWebhookSignature(
    body: Buffer,
    signature: string,
  ): StripeWebhookEvent {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
    return event as unknown as StripeWebhookEvent;
  }

  getEventId(event: StripeWebhookEvent): string {
    return event.id;
  }

  getSessionId(event: StripeWebhookEvent): string | null {
    if (event.type === "checkout.session.completed") {
      return event.data.object.id;
    }
    return null;
  }
}
