import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { AVATAR_RULES, parseProfileInput } from "./lib/profileRules";
import { adminAction, adminMutation, adminQuery } from "./lib/requireAdmin";
import { checkUploadedImage, limitedUploadUrl } from "./lib/uploads";

async function getProfileDoc(ctx: QueryCtx): Promise<Doc<"profile"> | null> {
  return ctx.db.query("profile").first();
}

async function avatarUrl(ctx: QueryCtx, profile: Doc<"profile">) {
  return profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null;
}

/**
 * What visitors see. An explicit allowlist of fields: anything added to the
 * table later stays private until it is added here on purpose.
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getProfileDoc(ctx);
    if (!profile) return null;
    return {
      displayName: profile.displayName,
      tagline: profile.tagline,
      bio: profile.bio,
      about: profile.about,
      timezone: profile.timezone,
      avatarUrl: await avatarUrl(ctx, profile),
    };
  },
});

/** Everything, for the edit form. */
export const get = adminQuery({
  args: {},
  handler: async (ctx) => {
    const profile = await getProfileDoc(ctx);
    if (!profile) return null;
    return { ...profile, avatarUrl: await avatarUrl(ctx, profile) };
  },
});

export const update = adminMutation({
  args: {
    displayName: v.string(),
    tagline: v.string(),
    bio: v.string(),
    about: v.string(),
    timezone: v.string(),
    notifyEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const values = parseProfileInput(args);
    const existing = await getProfileDoc(ctx);
    if (existing) {
      await ctx.db.patch(existing._id, { ...values, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("profile", { ...values, updatedAt: Date.now() });
    }
  },
});

export const generateAvatarUploadUrl = adminMutation({
  args: {},
  handler: async (ctx) => limitedUploadUrl(ctx, ctx.admin.authUserId),
});

type AvatarResult = { ok: true } | { ok: false; error: string };

/**
 * Attaches an uploaded file as the avatar. The browser's claimed type is not
 * trusted: the stored bytes are sniffed here. A rejected file is deleted, and
 * because this is an action (not a transaction) that delete sticks even though
 * the call reports failure. Errors are returned, not thrown, for that reason.
 */
export const setAvatar = adminAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<AvatarResult> => {
    const error = await checkUploadedImage(ctx, storageId, AVATAR_RULES.maxBytes);
    if (error) return { ok: false, error };

    const previous = await ctx.runMutation(internal.profile.attachAvatar, { storageId });
    if (previous) await ctx.storage.delete(previous);
    return { ok: true };
  },
});

/** Swaps the avatar id and returns the previous one for deletion. */
export const attachAvatar = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<Id<"_storage"> | null> => {
    const profile = await getProfileDoc(ctx);
    if (!profile) throw new ConvexError({ code: "NOT_FOUND" });
    const previous = profile.avatarStorageId ?? null;
    await ctx.db.patch(profile._id, { avatarStorageId: storageId, updatedAt: Date.now() });
    return previous !== storageId ? previous : null;
  },
});

export const removeAvatar = adminMutation({
  args: {},
  handler: async (ctx) => {
    const profile = await getProfileDoc(ctx);
    if (!profile?.avatarStorageId) return;
    await ctx.db.patch(profile._id, { avatarStorageId: undefined, updatedAt: Date.now() });
    await ctx.storage.delete(profile.avatarStorageId);
  },
});
