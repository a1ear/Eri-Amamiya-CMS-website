import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { moveAfter, orderForFirst } from "./lib/ordering";
import { clampDimension, parsePhotoFields, PHOTO_RULES } from "./lib/photoRules";
import { adminAction, adminMutation, adminQuery } from "./lib/requireAdmin";
import { checkUploadedImage, limitedUploadUrl } from "./lib/uploads";

async function withUrl(ctx: QueryCtx, photo: Doc<"photos">) {
  return { ...photo, url: await ctx.storage.getUrl(photo.storageId) };
}

async function getOrThrow(ctx: QueryCtx, id: Id<"photos">) {
  const photo = await ctx.db.get(id);
  if (!photo) throw new ConvexError({ code: "NOT_FOUND" });
  return photo;
}

/** Visible photos in gallery order. Explicit field allowlist. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_visible_order", (q) => q.eq("visible", true))
      .take(PHOTO_RULES.publicLimit);
    const out = await Promise.all(
      photos.map(async (p) => ({
        id: p._id,
        url: await ctx.storage.getUrl(p.storageId),
        caption: p.caption,
        tag: p.tag,
        width: p.width,
        height: p.height,
      })),
    );
    return out.filter((p): p is typeof p & { url: string } => p.url !== null);
  },
});

/** All photos, hidden ones included, for the dashboard. */
export const listAdmin = adminQuery({
  args: {},
  handler: async (ctx) => {
    const photos = await ctx.db.query("photos").withIndex("by_order").take(1000);
    return Promise.all(photos.map((p) => withUrl(ctx, p)));
  },
});

export const generateUploadUrl = adminMutation({
  args: {},
  handler: async (ctx) => limitedUploadUrl(ctx, ctx.admin.authUserId),
});

type AddResult = { ok: true; id: Id<"photos"> } | { ok: false; error: string };

/**
 * Adds an uploaded file to the gallery (at the top). Bytes are verified here;
 * a rejected file is deleted and the error returned rather than thrown so the
 * delete is kept.
 */
export const add = adminAction({
  args: { storageId: v.id("_storage"), width: v.number(), height: v.number() },
  handler: async (ctx, args): Promise<AddResult> => {
    const error = await checkUploadedImage(ctx, args.storageId, PHOTO_RULES.maxBytes);
    if (error) return { ok: false, error };
    const id = await ctx.runMutation(internal.photos.insert, args);
    return { ok: true, id };
  },
});

export const insert = internalMutation({
  args: { storageId: v.id("_storage"), width: v.number(), height: v.number() },
  handler: async (ctx, { storageId, width, height }): Promise<Id<"photos">> => {
    return ctx.db.insert("photos", {
      storageId,
      caption: "",
      tag: "",
      order: await orderForFirst(ctx, "photos"),
      visible: true,
      width: clampDimension(width),
      height: clampDimension(height),
      createdAt: Date.now(),
    });
  },
});

export const update = adminMutation({
  args: { id: v.id("photos"), caption: v.string(), tag: v.string(), visible: v.boolean() },
  handler: async (ctx, { id, ...fields }) => {
    await getOrThrow(ctx, id);
    await ctx.db.patch(id, parsePhotoFields(fields));
  },
});

/**
 * Places a photo directly after `afterId`, or first when `afterId` is null.
 */
export const move = adminMutation({
  args: { id: v.id("photos"), afterId: v.union(v.id("photos"), v.null()) },
  handler: async (ctx, { id, afterId }) => moveAfter(ctx, "photos", id, afterId),
});

export const remove = adminMutation({
  args: { id: v.id("photos") },
  handler: async (ctx, { id }) => {
    const photo = await getOrThrow(ctx, id);
    await ctx.db.delete(id);
    await ctx.storage.delete(photo.storageId);
  },
});
