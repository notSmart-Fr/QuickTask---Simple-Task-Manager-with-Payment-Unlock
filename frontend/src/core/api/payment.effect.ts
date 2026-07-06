import { Effect } from "effect";
import { HttpError, NetworkError } from "../errors";
import { effectApi } from "../../lib/effect-client";
import type { CreateCheckoutResponse } from "../../features/payment/payment.api";

export function createCheckoutEffect(
  successUrl: string,
  cancelUrl: string,
): Effect.Effect<CreateCheckoutResponse, HttpError | NetworkError> {
  return effectApi.post<CreateCheckoutResponse>("/payment/create-checkout", {
    successUrl,
    cancelUrl,
  });
}
