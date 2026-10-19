import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Who may use the dashboard. Keyed by Better Auth user id (not email), so
  // changing the login email can neither grant nor revoke access. Rows are only
  // written by internal functions (the seed); no public mutation touches this.
  admins: defineTable({
    authUserId: v.string(),
    createdAt: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  // Singleton: exactly one row, created by the seed. Only `profile.update` and
  // the avatar mutations write it, all admin-gated.
  profile: defineTable({
    displayName: v.string(),
    tagline: v.string(),
    bio: v.string(),
    about: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    timezone: v.string(),
    // Private: where collab inquiries are sent. Never returned by public queries.
    notifyEmail: v.string(),
    updatedAt: v.number(),
  }),

  photos: defineTable({
    storageId: v.id("_storage"),
    caption: v.string(),
    // Character / series, e.g. "Frieren — Sousou no Frieren".
    tag: v.string(),
    // Fractional sort key: moving a photo patches only that row.
    order: v.number(),
    visible: v.boolean(),
    width: v.number(),
    height: v.number(),
    createdAt: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_visible_order", ["visible", "order"]),

  // Featured videos are link-out cards (no embedded players).
  videos: defineTable({
    url: v.string(), // normalised https URL
    platform: v.string(), // detected from the host, for the label; "other" otherwise
    title: v.string(),
    youtubeId: v.optional(v.string()), // derives a thumbnail, YouTube only
    coverStorageId: v.optional(v.id("_storage")), // optional uploaded cover
    order: v.number(),
    visible: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_visible_order", ["visible", "order"]),

  // Weekly recurring streams, as wall-clock times in profile.timezone.
  scheduleSlots: defineTable({
    dayOfWeek: v.number(), // 0 = Sunday
    startMinute: v.number(), // minutes after midnight
    durationMinutes: v.number(),
    title: v.string(),
    createdAt: v.number(),
  }).index("by_day", ["dayOfWeek", "startMinute"]),

  // One-off changes: a day off, or an extra stream. Kept after the date
  // passes, so the history of what was announced is not rewritten.
  scheduleOverrides: defineTable({
    date: v.string(), // YYYY-MM-DD in profile.timezone
    kind: v.union(v.literal("cancelled"), v.literal("special")),
    startMinute: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    title: v.string(),
    note: v.string(),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  // Inbox. Content is never edited after submission; only status changes.
  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    topic: v.union(v.literal("collab"), v.literal("brand"), v.literal("other")),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("archived")),
    // "queued": handed to Resend; "not_configured": no API key/recipient yet;
    // "failed": Resend refused to enqueue (see logs). The message is kept.
    emailStatus: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
    createdAt: v.number(),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_created", ["createdAt"]),

  socialLinks: defineTable({
    platform: v.string(), // key into SOCIAL_PLATFORMS
    url: v.string(), // normalised https URL, host checked against the platform
    label: v.string(), // shown text; defaults to the platform name
    order: v.number(),
    createdAt: v.number(),
  }).index("by_order", ["order"]),
});
