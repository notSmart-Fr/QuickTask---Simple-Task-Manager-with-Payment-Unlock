import { Effect } from "effect";
import { HttpError, NetworkError } from "../../lib/errors";
import { effectApi } from "../../lib/effect-client";
import type { CreateCheckoutResponse } from "./payment.api";

export function createCheckoutEffect(
  successUrl: string,
  cancelUrl: string,
): Effect.Effect<CreateCheckoutResponse, HttpError | NetworkError> {
  return effectApi.post<CreateCheckoutResponse>("/payment/create-checkout", {
    successUrl,
    cancelUrl,
  });
}
