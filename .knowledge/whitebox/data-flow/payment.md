# Payment — End-to-End Trace

## Create Checkout Session

**Request shape**:
```typescript
{ successUrl: string; cancelUrl: string }
```

**Entry**: `POST /api/v1/payment/create-checkout`
[payment.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/payment.routes.ts#L20-52)

**Middleware**: [auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/middleware/auth.middleware.ts) — JWT verify, sets `req.user`

**Service**: [PaymentService.createCheckout()](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/payment/payment.service.ts#L24-52)
1. `stripeGateway.createCheckoutSession(userId, successUrl, cancelUrl)` → Stripe Checkout
   - Creates Stripe session with `mode: "payment"`, `unit_amount: 500` ($5), `product_name: "QuickTask Unlimited Tasks"`
   - Returns `{ sessionId, checkoutUrl }`
2. `paymentRepo.create({ ownerId, stripeSessionId, status: "PENDING" })` → stores record

**Gateway**: [StripeGateway](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/adapters/stripe/stripe-gateway.adapter.ts#L14-46)
- `stripe.checkout.sessions.create(...)` → SDK call to Stripe API

**Response shape**: `201 { checkoutUrl: string }`

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Auth missing/invalid | — | 401 | `auth.middleware` rejects |
| Stripe API failure | `Error` | 500 | Stripe auth failure, network timeout, rate limit |
| DB failure | `Error` | 500 | Payment record insert fails |

---

## Stripe Webhook

**Request shape**: Raw Buffer body + `stripe-signature` header

**Entry**: `POST /api/v1/payment/webhook`
[payment.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/payment.routes.ts#L54-87)

**No auth middleware** — Stripe sends raw requests with signature header.

**Raw body capture**: `main.ts` uses Express's `verify` callback on `json()` middleware:
```typescript
express.json({
  verify: (req, _res, buf) => {
    (req as unknown as { rawBody: Buffer }).rawBody = buf;
  },
})
```

**Service**: [PaymentService.handleWebhook()](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/payment/payment.service.ts#L54-L108)
1. `stripeGateway.verifyWebhookSignature(body, signature)` → verifies signature using `STRIPE_WEBHOOK_SECRET`
2. Stripe session ID extracted from event — if none, returns early
3. **Atomic Prisma transaction** wraps everything below, ensuring concurrent webhooks serialize:
   - `paymentRepo.findByEventId(eventId)` → **idempotency check** (inside transaction): if already processed, return early
   - `paymentRepo.findBySessionId(sessionId)` → if not found, `PaymentRecordNotFound`
   - On `checkout.session.completed`:
     - `updateStatus("COMPLETED", eventId)` + `userRepo.transaction(updateToPremium)`
   - Other events: `updateStatus("FAILED", eventId)`

**Gateway**: `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`

**Response shape**: `200 { received: true }`

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Missing signature | — | 400 | No `stripe-signature` header |
| Bad signature | `WebhookVerificationFailed` | 400 | Signature verification fails (wrong secret, tampered body) |
| Payment not found | `PaymentRecordNotFound` | 404 | No PENDING payment with that session ID |
| DB failure | `Error` | 500 | Transaction or update fails |

---

## GET Payment Status

**Entry**: `GET /api/v1/payment/status`
[payment.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/payment.routes.ts#L89-94)

**Response shape**: `200 { isPremium: boolean }`
