import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { VIDEO_RULES } from "./lib/linkRules";
import { normalizeHttpsUrl, parseVideoUrl, VIDEO_PLATFORMS, videoEmbedFrom } from "./lib/links";
import { moveAfter, orderForFirst } from "./lib/ordering";
import { cleanText } from "./lib/profileRules";
import { adminAction, adminMutation, adminQuery } from "./lib/requireAdmin";
import { checkUploadedImage, limitedUploadUrl } from "./lib/uploads";


function parseTitle(raw: string) {
  const title = cleanText(raw).replace(/\s+/g, " ");
  if (title.length < VIDEO_RULES.title.min) return { error: "Give the video a title." };
  if (title.length > VIDEO_RULES.title.max) return { error: `Keep it under ${VIDEO_RULES.title.max} characters.` };
  return { title };
}

async function getOrThrow(ctx: QueryCtx, id: Id<"videos">) {
  const video = await ctx.db.get(id);
  if (!video) throw new ConvexError({ code: "NOT_FOUND" });
  return video;
}

async function thumbnailUrl(ctx: QueryCtx, video: Doc<"videos">) {
  if (video.coverStorageId) return ctx.storage.getUrl(video.coverStorageId);
  // Public, cookie-free thumbnail derived from the id; no API call needed.
  if (video.youtubeId) return `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
  return null;
}

/** Derived from the stored link on read, so older videos need no backfill. */
function embedFor(url: string) {
  const parsed = normalizeHttpsUrl(url);
  return parsed ? videoEmbedFrom(parsed) : null;
}

function platformLabel(platform: string, url: string) {
  return VIDEO_PLATFORMS[platform]?.label ?? new URL(url).hostname.replace(/^www\./, "");
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_visible_order", (q) => q.eq("visible", true))
      .take(VIDEO_RULES.publicLimit);
    return Promise.all(
      videos.map(async (v) => ({
        id: v._id,
        url: v.url,
        title: v.title,
        platform: v.platform,
        platformLabel: platformLabel(v.platform, v.url),
        thumbnailUrl: await thumbnailUrl(ctx, v),
        embed: embedFor(v.url),
      })),
    );
  },
});

export const listAdmin = adminQuery({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").withIndex("by_order").take(500);
    return Promise.all(
      videos.map(async (v) => ({
        ...v,
        platformLabel: platformLabel(v.platform, v.url),
        thumbnailUrl: await thumbnailUrl(ctx, v),
        embed: embedFor(v.url),
      })),
    );
  },
});

export const add = adminMutation({
  args: { url: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const parsed = parseVideoUrl(args.url);
    const title = parseTitle(args.title);
    const fields: Record<string, string> = {};
    if (!parsed.ok) fields.url = parsed.error;
    if ("error" in title) fields.title = title.error!;
    if (!parsed.ok || "error" in title) throw new ConvexError({ code: "INVALID", fields });

    return ctx.db.insert("videos", {
      url: parsed.url,
      platform: parsed.platform,
      youtubeId: parsed.youtubeId,
      title: title.title,
      order: await orderForFirst(ctx, "videos"),
      visible: true,
      createdAt: Date.now(),
    });
  },
});

export const update = adminMutation({
  args: { id: v.id("videos"), title: v.string(), visible: v.boolean() },
  handler: async (ctx, { id, title: rawTitle, visible }) => {
    await getOrThrow(ctx, id);
    const title = parseTitle(rawTitle);
    if ("error" in title) throw new ConvexError({ code: "INVALID", fields: { title: title.error } });
    await ctx.db.patch(id, { title: title.title, visible });
  },
});

export const move = adminMutation({
  args: { id: v.id("videos"), afterId: v.union(v.id("videos"), v.null()) },
  handler: async (ctx, { id, afterId }) => moveAfter(ctx, "videos", id, afterId),
});

export const remove = adminMutation({
  args: { id: v.id("videos") },
  handler: async (ctx, { id }) => {
    const video = await getOrThrow(ctx, id);
    await ctx.db.delete(id);
    if (video.coverStorageId) await ctx.storage.delete(video.coverStorageId);
  },
});

/* ------------------------------------------------------------- cover image */

export const generateCoverUploadUrl = adminMutation({
  args: {},
  handler: async (ctx) => limitedUploadUrl(ctx, ctx.admin.authUserId),
});

type CoverResult = { ok: true } | { ok: false; error: string };

/** Same contract as the avatar: bytes verified, rejects deleted, errors returned. */
export const setCover = adminAction({
  args: { id: v.id("videos"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }): Promise<CoverResult> => {
    const error = await checkUploadedImage(ctx, storageId, VIDEO_RULES.coverMaxBytes);
    if (error) return { ok: false, error };
    const result = await ctx.runMutation(internal.videos.attachCover, { id, storageId });
    if (!result.found) {
      // Video deleted mid-upload: don't leave the file behind.
      await ctx.storage.delete(storageId);
      return { ok: false, error: "That video was deleted." };
    }
    if (result.previous) await ctx.storage.delete(result.previous);
    return { ok: true };
  },
});

/** Returns instead of throwing so the calling action can clean up storage. */
export const attachCover = internalMutation({
  args: { id: v.id("videos"), storageId: v.id("_storage") },
  handler: async (
    ctx,
    { id, storageId },
  ): Promise<{ found: false } | { found: true; previous: Id<"_storage"> | null }> => {
    const video = await ctx.db.get(id);
    if (!video) return { found: false };
    await ctx.db.patch(id, { coverStorageId: storageId });
    const previous = video.coverStorageId && video.coverStorageId !== storageId ? video.coverStorageId : null;
    return { found: true, previous };
  },
});

export const removeCover = adminMutation({
  args: { id: v.id("videos") },
  handler: async (ctx, { id }) => {
    const video = await getOrThrow(ctx, id);
    if (!video.coverStorageId) return;
    await ctx.db.patch(id, { coverStorageId: undefined });
    await ctx.storage.delete(video.coverStorageId);
  },
});
