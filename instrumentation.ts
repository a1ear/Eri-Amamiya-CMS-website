// Server error monitoring for Next.js. A no-op until SENTRY_DSN is set.
// Convex function errors are reported separately (Convex dashboard →
// Integrations → Exception reporting), see README.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
