export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface Api {
  get<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
  post<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
  patch<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
  delete<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function getAuthHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch {
    // no-op for SSR
  }
  return authHeaders;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: getAuthHeaders(options.headers as Record<string, string>),
    });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { error: data.error ?? res.statusText };
    }
    return { data: data as unknown as T };
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : "An unexpected error occurred",
    };
  }
}

export const api: Api = {
  get: (url, headers) => request(url, { method: "GET", headers }),
  post: (url, body, headers) =>
    request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  patch: (url, body, headers) =>
    request(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    }),
  delete: (url, headers) => request(url, { method: "DELETE", headers }),
};

export default api;
