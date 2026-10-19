import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import authConfig from "./auth.config";
import { emailConfigured, resend } from "./lib/email";

export const authComponent = createClient<DataModel>(components.betterAuth);

type BuildOptions = {
  /**
   * Public sign-up is always off. Only the internal seed action passes `true`,
   * and internal functions cannot be called from a browser.
   */
  allowSignUp?: boolean;
};

export const buildAuth = (
  ctx: GenericCtx<DataModel>,
  { allowSignUp = false }: BuildOptions = {},
) => {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is not set on the Convex deployment");

  return betterAuth({
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Single owner account created by the seed; nothing to verify.
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Reset requests arrive over HTTP, so ctx can enqueue mail. Better Auth
        // answers the browser identically whether or not the email exists.
        if (!emailConfigured() || !("runMutation" in ctx)) {
          console.error("auth: password reset requested but email is not configured");
          return;
        }
        await resend().sendEmail(ctx as MutationCtx | ActionCtx, {
          from: process.env.RESEND_FROM!,
          to: user.email,
          subject: "Reset your website password",
          text: [
            "Someone (hopefully you) asked to reset the password for your website dashboard.",
            "",
            `Choose a new password: ${url}`,
            "",
            "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email; your password stays the same.",
          ].join("\n"),
        });
      },
    },
    // Convex isolates do not share memory between requests, so the default
    // in-memory limiter would never trip. Store counters in the component DB.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 15 * 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    plugins: [convex({ authConfig })],
  });
};

/** The auth instance used by HTTP routes. Sign-up disabled. */
export const createAuth = (ctx: GenericCtx<DataModel>) => buildAuth(ctx);
