import { Effect, Either } from "effect";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { createCheckoutEffect } from "../../core/api/payment.effect";
import type { HttpError, NetworkError } from "../../core/errors";

export interface CreateCheckoutResponse {
  checkoutUrl: string;
}

type PaymentError = HttpError | NetworkError;

function runEffect<T>(program: Effect.Effect<T, PaymentError>): Promise<T> {
  return Effect.runPromise(
    Effect.either(program),
  ).then((either) => {
    if (Either.isLeft(either)) {
      throw either.left;
    }
    return either.right;
  });
}

export function useCreateCheckout(): UseMutationResult<
  CreateCheckoutResponse,
  PaymentError,
  { successUrl: string; cancelUrl: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) =>
      runEffect(createCheckoutEffect(data.successUrl, data.cancelUrl)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
