import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { CONTACT_RULES, parseContact } from "./lib/contactRules";
import { emailConfigured, resend } from "./lib/email";
import { rateLimiter } from "./lib/rateLimits";
import { adminMutation, adminQuery } from "./lib/requireAdmin";

const topic = v.union(v.literal("collab"), v.literal("brand"), v.literal("other"));
const status = v.union(v.literal("new"), v.literal("read"), v.literal("archived"));

/**
 * Verifies a Cloudflare Turnstile token. Fails closed: no secret configured
 * means no messages accepted, rather than an open form.
 */
async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("contact: TURNSTILE_SECRET_KEY is not set; rejecting submission");
    return false;
  }
  if (!token || token.length > 2048) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  if (!res.ok) return false;
  const result = (await res.json()) as { success?: boolean; hostname?: string };
  const expectedHost = process.env.TURNSTILE_EXPECTED_HOSTNAME;
  return result.success === true && (!expectedHost || result.hostname === expectedHost);
}

type SubmitResult = { ok: true };

/** Public: the contact form posts here. */
export const submit = action({
  args: {
    name: v.string(),
    email: v.string(),
    topic,
    message: v.string(),
    turnstileToken: v.string(),
    // Honeypot: hidden from people, filled in by naive bots.
    website: v.string(),
  },
  handler: async (ctx, { turnstileToken, website, ...input }): Promise<SubmitResult> => {
    // Pretend success so the bot moves on; store nothing.
    if (website.trim() !== "") return { ok: true };

    const values = parseContact(input);
    if (!(await verifyTurnstile(turnstileToken))) {
      throw new ConvexError({ code: "CAPTCHA_FAILED" });
    }
    await ctx.runMutation(internal.contact.store, values);
    return { ok: true };
  },
});

/** Rate-limits, stores, then queues the notification email, all in one transaction. */
export const store = internalMutation({
  args: { name: v.string(), email: v.string(), topic, message: v.string() },
  handler: async (ctx, values): Promise<Id<"contactMessages">> => {
    await rateLimiter.limit(ctx, "contactGlobal", { throws: true });
    await rateLimiter.limit(ctx, "contactPerSender", { key: values.email, throws: true });

    const profile = await ctx.db.query("profile").first();
    const to = profile?.notifyEmail;
    const canEmail = Boolean(to) && emailConfigured();
    const id = await ctx.db.insert("contactMessages", {
      ...values,
      status: "new",
      emailStatus: canEmail ? "queued" : "not_configured",
      createdAt: Date.now(),
    });

    if (canEmail) {
      // The message is already stored: a mail problem must never lose it, so
      // a refusal to enqueue (bad config, test mode) is recorded, not thrown.
      try {
        await queueNotification(ctx, id, to!, values);
      } catch (error) {
        console.error("contact: could not queue notification email", error);
        await ctx.db.patch(id, { emailStatus: "failed" });
      }
    }
    return id;
  },
});

async function queueNotification(
  ctx: MutationCtx,
  id: Id<"contactMessages">,
  to: string,
  values: { name: string; email: string; topic: keyof typeof CONTACT_RULES.topics; message: string },
) {
  const topicLabel = CONTACT_RULES.topics[values.topic];
  await resend().sendEmail(ctx, {
    from: process.env.RESEND_FROM!,
    to,
    replyTo: [values.email],
    // Name is single-line already (cleaned); subject is plain text.
    subject: `${topicLabel} inquiry from ${values.name}`,
    text: [
      `${values.name} <${values.email}> sent a message from your website.`,
      `Topic: ${topicLabel}`,
      "",
      values.message,
      "",
      "Reply to this email to answer them directly. All messages are also in your dashboard inbox.",
    ].join("\n"),
    idempotencyKey: id,
  });
}

/* ------------------------------------------------------------------ inbox */

export const list = adminQuery({
  args: { status },
  handler: async (ctx, args) =>
    ctx.db
      .query("contactMessages")
      .withIndex("by_status_created", (q) => q.eq("status", args.status))
      .order("desc")
      .take(200),
});

export const unreadCount = adminQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("contactMessages")
        .withIndex("by_status_created", (q) => q.eq("status", "new"))
        .take(100)
    ).length,
});

/** The only change allowed to a message. Its content is never edited. */
export const setStatus = adminMutation({
  args: { id: v.id("contactMessages"), status },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.id))) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(args.id, { status: args.status });
  },
});
