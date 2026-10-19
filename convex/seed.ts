import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { buildAuth } from "./auth";

/**
 * Creates the one owner account. Internal only: run from the CLI
 * (`npm run seed:admin`), never callable from a browser.
 * Refuses if an admin already exists.
 */
export const createAdmin = internalAction({
  args: { email: v.string(), password: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<{ authUserId: string }> => {
    if (await ctx.runQuery(internal.seed.adminExists, {})) {
      throw new ConvexError({ code: "ADMIN_EXISTS" });
    }

    const auth = buildAuth(ctx, { allowSignUp: true });
    const { user } = await auth.api.signUpEmail({
      body: { email: args.email, password: args.password, name: args.name },
    });

    await ctx.runMutation(internal.seed.grantAdmin, { authUserId: user.id });
    await ctx.runMutation(internal.seed.ensureProfile, {
      displayName: args.name,
      notifyEmail: args.email,
    });
    return { authUserId: user.id };
  },
});

export const adminExists = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("admins").first()) !== null,
});

export const grantAdmin = internalMutation({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("admins", { authUserId, createdAt: Date.now() });
  },
});

/**
 * Creates the profile singleton with placeholder copy if it does not exist, so
 * the public hero is never empty. Safe to re-run: never overwrites.
 * Existing deployments: `npx convex run seed:ensureProfile '{"displayName":"..."}'`.
 */
export const ensureProfile = internalMutation({
  args: { displayName: v.string(), notifyEmail: v.optional(v.string()) },
  handler: async (ctx, { displayName, notifyEmail }) => {
    const existing = await ctx.db.query("profile").first();
    if (existing) return existing._id;
    return ctx.db.insert("profile", {
      displayName,
      tagline: "Cosplayer & streamer",
      bio: "",
      about: "",
      timezone: "UTC",
      notifyEmail: notifyEmail ?? "",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Developer recovery when the owner is locked out and email isn't set up:
 * `npm run reset:admin-password` (reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 * Signs the owner out everywhere. Internal only.
 */
export const resetAdminPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    if (password.length < 12 || password.length > 128) {
      throw new ConvexError({ code: "INVALID", fields: { password: "Use 12 to 128 characters." } });
    }
    const auth = await buildAuth(ctx).$context;
    const found = await auth.internalAdapter.findUserByEmail(email.trim().toLowerCase());
    if (!found) throw new ConvexError({ code: "NOT_FOUND" });
    const isAdmin = await ctx.runQuery(internal.seed.isAdminUser, { authUserId: found.user.id });
    if (!isAdmin) throw new ConvexError({ code: "NOT_ADMIN" });
    await auth.internalAdapter.updatePassword(found.user.id, await auth.password.hash(password));
    await auth.internalAdapter.deleteUserSessions(found.user.id);
    return { ok: true };
  },
});

export const isAdminUser = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) =>
    (await ctx.db
      .query("admins")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique()) !== null,
});
