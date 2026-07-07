import Stripe from "stripe";
import config from "../../config.js";
import type { PaymentGateway, WebhookEvent, CheckoutSession } from "./payment.service.js";

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  // Stripe SDK uses its latest supported API version by default
});

export class StripeGateway implements PaymentGateway {
  async createCheckoutSession(
    userId: string,
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSession> {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
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
  ): WebhookEvent {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
    return event as unknown as WebhookEvent;
  }

  getEventId(event: WebhookEvent): string {
    return event.id;
  }

  getSessionId(event: WebhookEvent): string | null {
    if (event.type === "checkout.session.completed") {
      return event.data.object.id;
    }
    return null;
  }
}
