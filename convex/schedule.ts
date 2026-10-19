import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { cleanText } from "./lib/profileRules";
import { adminMutation, adminQuery } from "./lib/requireAdmin";
import { addDays, dateInZone, parseDate, SCHEDULE_RULES, type Override } from "./lib/schedule";

const R = SCHEDULE_RULES;

async function ownerTimeZone(ctx: QueryCtx) {
  return (await ctx.db.query("profile").first())?.timezone ?? "UTC";
}

function invalid(fields: Record<string, string>): never {
  throw new ConvexError({ code: "INVALID", fields });
}

function checkTimes(startMinute: number, durationMinutes: number, fields: Record<string, string>) {
  if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute >= 1440) fields.start = "Pick a start time.";
  if (!Number.isInteger(durationMinutes) || durationMinutes < R.minDuration || durationMinutes > R.maxDuration)
    fields.end = `Streams must be between ${R.minDuration} minutes and ${R.maxDuration / 60} hours long.`;
}

function cleanLine(value: string) {
  return cleanText(value).replace(/\s+/g, " ");
}

function parseSlot(args: { dayOfWeek: number; startMinute: number; durationMinutes: number; title: string }) {
  const fields: Record<string, string> = {};
  if (!Number.isInteger(args.dayOfWeek) || args.dayOfWeek < 0 || args.dayOfWeek > 6) fields.day = "Pick a day.";
  checkTimes(args.startMinute, args.durationMinutes, fields);
  const title = cleanLine(args.title) || "Stream";
  if (title.length > R.title.max) fields.title = `Keep it under ${R.title.max} characters.`;
  if (Object.keys(fields).length) invalid(fields);
  return { dayOfWeek: args.dayOfWeek, startMinute: args.startMinute, durationMinutes: args.durationMinutes, title };
}

function toOverride(o: Doc<"scheduleOverrides">): Override {
  return o.kind === "cancelled"
    ? { date: o.date, kind: "cancelled", note: o.note }
    : { date: o.date, kind: "special", startMinute: o.startMinute!, durationMinutes: o.durationMinutes!, title: o.title, note: o.note };
}

/**
 * Everything the public page needs to compute upcoming streams in the
 * visitor's timezone. `fromDate` only trims old overrides; all of this is
 * public information.
 */
export const getPublic = query({
  args: { fromDate: v.string() },
  handler: async (ctx, { fromDate }) => {
    if (!parseDate(fromDate)) invalid({ fromDate: "Invalid date" });
    const timeZone = await ownerTimeZone(ctx);
    const slots = await ctx.db.query("scheduleSlots").withIndex("by_day").take(R.maxSlots);
    const overrides = await ctx.db
      .query("scheduleOverrides")
      .withIndex("by_date", (q) => q.gte("date", addDays(fromDate, -1)))
      .take(200);
    return {
      timeZone,
      slots: slots.map(({ dayOfWeek, startMinute, durationMinutes, title }) => ({ dayOfWeek, startMinute, durationMinutes, title })),
      overrides: overrides.map(toOverride),
    };
  },
});

export const getAdmin = adminQuery({
  args: {},
  handler: async (ctx) => {
    const timeZone = await ownerTimeZone(ctx);
    const today = dateInZone(Date.now(), timeZone);
    const slots = await ctx.db.query("scheduleSlots").withIndex("by_day").take(R.maxSlots);
    const upcoming = await ctx.db
      .query("scheduleOverrides")
      .withIndex("by_date", (q) => q.gte("date", today))
      .take(200);
    return { timeZone, today, slots, overrides: upcoming };
  },
});

export const addSlot = adminMutation({
  args: { dayOfWeek: v.number(), startMinute: v.number(), durationMinutes: v.number(), title: v.string() },
  handler: async (ctx, args) => {
    const count = (await ctx.db.query("scheduleSlots").take(R.maxSlots)).length;
    if (count >= R.maxSlots) invalid({ day: `You can have up to ${R.maxSlots} weekly streams.` });
    return ctx.db.insert("scheduleSlots", { ...parseSlot(args), createdAt: Date.now() });
  },
});

export const updateSlot = adminMutation({
  args: {
    id: v.id("scheduleSlots"),
    dayOfWeek: v.number(),
    startMinute: v.number(),
    durationMinutes: v.number(),
    title: v.string(),
  },
  handler: async (ctx, { id, ...args }) => {
    if (!(await ctx.db.get(id))) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(id, parseSlot(args));
  },
});

export const removeSlot = adminMutation({
  args: { id: v.id("scheduleSlots") },
  handler: async (ctx, { id }) => {
    if (!(await ctx.db.get(id))) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
  },
});

export const addOverride = adminMutation({
  args: {
    date: v.string(),
    kind: v.union(v.literal("cancelled"), v.literal("special")),
    startMinute: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    title: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const fields: Record<string, string> = {};
    const today = dateInZone(Date.now(), await ownerTimeZone(ctx));
    if (!parseDate(args.date)) fields.date = "Pick a date.";
    else if (args.date < today) fields.date = "That date has already passed.";
    else if (args.date > addDays(today, R.maxOverrideDaysAhead)) fields.date = "Pick a date within the next year.";

    const note = cleanLine(args.note);
    if (note.length > R.note.max) fields.note = `Keep it under ${R.note.max} characters.`;
    const title = cleanLine(args.title) || (args.kind === "special" ? "Special stream" : "");
    if (title.length > R.title.max) fields.title = `Keep it under ${R.title.max} characters.`;

    if (args.kind === "special") {
      if (args.startMinute === undefined || args.durationMinutes === undefined) fields.start = "Pick a start and end time.";
      else checkTimes(args.startMinute, args.durationMinutes, fields);
    }
    if (Object.keys(fields).length) invalid(fields);

    if (args.kind === "cancelled") {
      // One day-off per date: update the note rather than stacking duplicates.
      const sameDay = await ctx.db
        .query("scheduleOverrides")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect();
      const existing = sameDay.find((o) => o.kind === "cancelled");
      if (existing) {
        await ctx.db.patch(existing._id, { note });
        return existing._id;
      }
      return ctx.db.insert("scheduleOverrides", { date: args.date, kind: "cancelled", title: "", note, createdAt: Date.now() });
    }
    return ctx.db.insert("scheduleOverrides", {
      date: args.date,
      kind: "special",
      startMinute: args.startMinute,
      durationMinutes: args.durationMinutes,
      title,
      note,
      createdAt: Date.now(),
    });
  },
});

export const removeOverride = adminMutation({
  args: { id: v.id("scheduleOverrides") },
  handler: async (ctx, { id }) => {
    if (!(await ctx.db.get(id))) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
  },
});
