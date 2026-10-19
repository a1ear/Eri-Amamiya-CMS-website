import { Resend } from "@convex-dev/resend";
import { components } from "../_generated/api";

/** True when the deployment has what it needs to send mail. */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Outgoing email via the Resend component (durable queue with retries).
 * Built per call so it always sees the deployment's current env vars, the
 * same ones `emailConfigured` checks. Test mode, which only delivers to
 * Resend's test inboxes, stays on unless RESEND_TEST_MODE=false is set.
 */
export function resend() {
  return new Resend(components.resend, {
    apiKey: process.env.RESEND_API_KEY ?? "",
    testMode: process.env.RESEND_TEST_MODE !== "false",
  });
}
