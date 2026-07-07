import { Effect } from "effect";
import { HttpError, NetworkError } from "../../lib/errors";
import { effectApi } from "../../lib/effect-client";
import type { AuthResponse } from "./auth.api";

export function registerEffect(
  name: string,
  email: string,
  password: string,
): Effect.Effect<AuthResponse, HttpError | NetworkError> {
  return effectApi.post<AuthResponse>("/auth/register", { name, email, password });
}

export function loginEffect(
  email: string,
  password: string,
): Effect.Effect<AuthResponse, HttpError | NetworkError> {
  return effectApi.post<AuthResponse>("/auth/login", { email, password });
}

// ponytail: /auth/me now returns { user, token } with a fresh DB-backed token,
// so isPremium is never stale from the JWT.
export function fetchMeEffect(): Effect.Effect<AuthResponse, HttpError | NetworkError> {
  return effectApi.get<AuthResponse>("/auth/me");
}
