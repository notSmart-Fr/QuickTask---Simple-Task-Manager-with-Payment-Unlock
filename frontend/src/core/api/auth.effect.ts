import { Effect } from "effect";
import { HttpError, NetworkError } from "../errors";
import { effectApi } from "../../lib/effect-client";
import type { User, AuthResponse } from "../../features/auth/auth.api";

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

export function fetchMeEffect(): Effect.Effect<User, HttpError | NetworkError> {
  return effectApi.get<User>("/auth/me");
}
