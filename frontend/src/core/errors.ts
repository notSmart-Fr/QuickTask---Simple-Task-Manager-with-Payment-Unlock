import { Data } from "effect";

// ── HTTP/Network Errors ──

export class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string;
}> {}

export class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  message: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<Record<string, never>> {}
