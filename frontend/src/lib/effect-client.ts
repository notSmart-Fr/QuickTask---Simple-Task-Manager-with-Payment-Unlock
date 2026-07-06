import { Effect } from "effect";
import { HttpError, NetworkError } from "../core/errors";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function getAuthHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }
  }
  return authHeaders;
}

function fetchEffect<T>(
  url: string,
  options: RequestInit = {},
): Effect.Effect<T, HttpError | NetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: getAuthHeaders(
          options.headers as Record<string, string> | undefined,
        ),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new HttpError({
          status: res.status,
          message: body.error ?? res.statusText,
        });
      }
      return res.json() as T;
    },
    catch: (e) => {
      if (e instanceof HttpError) return e;
      return new NetworkError({
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export const effectApi = {
  get<T>(
    url: string,
    headers?: Record<string, string>,
  ): Effect.Effect<T, HttpError | NetworkError> {
    return fetchEffect<T>(url, { method: "GET", headers });
  },

  post<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Effect.Effect<T, HttpError | NetworkError> {
    return fetchEffect<T>(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  },

  patch<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Effect.Effect<T, HttpError | NetworkError> {
    return fetchEffect<T>(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
  },

  delete<T>(
    url: string,
    headers?: Record<string, string>,
  ): Effect.Effect<T, HttpError | NetworkError> {
    return fetchEffect<T>(url, { method: "DELETE", headers });
  },
};
