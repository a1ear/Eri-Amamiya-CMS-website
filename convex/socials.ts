import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { SOCIAL_RULES } from "./lib/linkRules";
import { parseSocialUrl, SOCIAL_PLATFORMS } from "./lib/links";
import { moveAfter, orderForLast } from "./lib/ordering";
import { cleanText } from "./lib/profileRules";
import { adminMutation } from "./lib/requireAdmin";

function parseInput(platform: string, rawUrl: string, rawLabel: string) {
  const parsed = parseSocialUrl(platform, rawUrl);
  const label = cleanText(rawLabel).replace(/\s+/g, " ") || SOCIAL_PLATFORMS[platform]?.label || "";
  const fields: Record<string, string> = {};
  if (!parsed.ok) fields.url = parsed.error;
  if (label.length > SOCIAL_RULES.label.max) fields.label = `Keep it under ${SOCIAL_RULES.label.max} characters.`;
  if (!parsed.ok || fields.label) throw new ConvexError({ code: "INVALID", fields });
  return { platform, url: parsed.url, label };
}

async function getOrThrow(ctx: QueryCtx, id: Id<"socialLinks">) {
  const link = await ctx.db.get(id);
  if (!link) throw new ConvexError({ code: "NOT_FOUND" });
  return link;
}

/** Social links are all public; used by both the site and the dashboard. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("socialLinks").withIndex("by_order").take(SOCIAL_RULES.maxLinks);
    return links.map((l) => ({ id: l._id, platform: l.platform, url: l.url, label: l.label }));
  },
});

export const add = adminMutation({
  args: { platform: v.string(), url: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const count = (await ctx.db.query("socialLinks").take(SOCIAL_RULES.maxLinks)).length;
    if (count >= SOCIAL_RULES.maxLinks) {
      throw new ConvexError({ code: "INVALID", fields: { url: `You can have up to ${SOCIAL_RULES.maxLinks} links.` } });
    }
    const values = parseInput(args.platform, args.url, args.label);
    return ctx.db.insert("socialLinks", {
      ...values,
      order: await orderForLast(ctx, "socialLinks"),
      createdAt: Date.now(),
    });
  },
});

export const update = adminMutation({
  args: { id: v.id("socialLinks"), platform: v.string(), url: v.string(), label: v.string() },
  handler: async (ctx, { id, ...args }) => {
    await getOrThrow(ctx, id);
    await ctx.db.patch(id, parseInput(args.platform, args.url, args.label));
  },
});

export const move = adminMutation({
  args: { id: v.id("socialLinks"), afterId: v.union(v.id("socialLinks"), v.null()) },
  handler: async (ctx, { id, afterId }) => moveAfter(ctx, "socialLinks", id, afterId),
});

export const remove = adminMutation({
  args: { id: v.id("socialLinks") },
  handler: async (ctx, { id }) => {
    await getOrThrow(ctx, id);
    await ctx.db.delete(id);
  },
});
