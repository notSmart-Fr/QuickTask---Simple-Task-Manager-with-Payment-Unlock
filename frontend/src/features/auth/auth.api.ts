import { Effect, Either } from "effect";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { registerEffect, loginEffect, fetchMeEffect } from "./auth.effect";
import type { HttpError, NetworkError } from "../../lib/errors";

export interface User {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

type AuthError = HttpError | NetworkError;

function runEffect<T>(program: Effect.Effect<T, AuthError>): Promise<T> {
  return Effect.runPromise(
    Effect.either(program),
  ).then((either) => {
    if (Either.isLeft(either)) {
      throw either.left;
    }
    return either.right;
  });
}

export function useRegister(): UseMutationResult<
  AuthResponse,
  AuthError,
  { name: string; email: string; password: string }
> {
  return useMutation({
    mutationFn: async (data) =>
      runEffect(registerEffect(data.name, data.email, data.password)),
  });
}

export function useLogin(): UseMutationResult<
  AuthResponse,
  AuthError,
  { email: string; password: string }
> {
  return useMutation({
    mutationFn: async (data) =>
      runEffect(loginEffect(data.email, data.password)),
  });
}

export function useMe(): UseQueryResult<AuthResponse, AuthError> {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => runEffect(fetchMeEffect()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}
