import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Even admin-only endpoints are limited: if the session leaks, an attacker
 * should not be able to fill storage. 300 uploads an hour, bursts of 60,
 * comfortably covers a big photo dump from a phone.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  upload: { kind: "token bucket", rate: 300, period: HOUR, capacity: 60 },
  // Contact form. Turnstile stops bots per submission; these cap volume even
  // if someone farms tokens. Keyed by sender email, plus one global bucket.
  contactPerSender: { kind: "fixed window", rate: 3, period: 10 * MINUTE },
  contactGlobal: { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
});
