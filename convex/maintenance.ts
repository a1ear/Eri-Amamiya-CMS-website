import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const ORPHAN_GRACE_MS = DAY; // uploads in progress are never touched
const ARCHIVE_RETENTION_MS = 365 * DAY;
const PAGE = 200;

/**
 * Deletes stored files that nothing references and that are older than a day:
 * uploads abandoned between "upload" and "attach" (closed tab, lost signal).
 * Walks storage a page at a time, rescheduling itself, so it never hits
 * per-mutation read limits however large storage gets.
 */
export const cleanupOrphanedFiles = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }): Promise<{ deleted: number }> => {
    const referenced = new Set<Id<"_storage">>();
    const profile = await ctx.db.query("profile").first();
    if (profile?.avatarStorageId) referenced.add(profile.avatarStorageId);
    for (const p of await ctx.db.query("photos").collect()) referenced.add(p.storageId);
    for (const vid of await ctx.db.query("videos").collect()) if (vid.coverStorageId) referenced.add(vid.coverStorageId);

    const page = await ctx.db.system.query("_storage").paginate({ cursor: cursor ?? null, numItems: PAGE });
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    let deleted = 0;
    for (const file of page.page) {
      if (!referenced.has(file._id) && file._creationTime < cutoff) {
        await ctx.storage.delete(file._id);
        deleted++;
      }
    }
    if (deleted) console.log(`maintenance: deleted ${deleted} orphaned file(s)`);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.maintenance.cleanupOrphanedFiles, { cursor: page.continueCursor });
    }
    return { deleted };
  },
});

/**
 * Archived contact messages hold strangers' emails; keep them a year, then
 * delete. New and read messages are never removed automatically.
 */
export const purgeOldArchivedMessages = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const cutoff = Date.now() - ARCHIVE_RETENTION_MS;
    const old = await ctx.db
      .query("contactMessages")
      .withIndex("by_status_created", (q) => q.eq("status", "archived").lt("createdAt", cutoff))
      .take(PAGE);
    for (const m of old) await ctx.db.delete(m._id);
    if (old.length === PAGE) await ctx.scheduler.runAfter(0, internal.maintenance.purgeOldArchivedMessages, {});
    if (old.length) console.log(`maintenance: purged ${old.length} archived message(s) older than a year`);
    return { deleted: old.length };
  },
});
