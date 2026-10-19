import { isRateLimitError } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";

/** Field errors from a server `INVALID` response, or null for anything else. */
export function fieldErrorsOf(err: unknown): Record<string, string> | null {
  if (!(err instanceof ConvexError)) return null;
  const data = err.data as { code?: string; fields?: Record<string, string> };
  return data?.code === "INVALID" && data.fields ? data.fields : null;
}

/** One human sentence for any failed admin call. */
export function messageOf(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (isRateLimitError(err)) {
    return `Too many uploads in a short time. Try again in ${Math.max(1, Math.ceil(err.data.retryAfter / 60000))} min.`;
  }
  const fields = fieldErrorsOf(err);
  if (fields) return Object.values(fields).join(" ");
  return fallback;
}
