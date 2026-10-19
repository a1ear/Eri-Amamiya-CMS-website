import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { asOwner, setup, storeFile } from "./test.helpers";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("cleanupOrphanedFiles", () => {
  test("deletes old unreferenced files; keeps referenced and in-progress ones", async () => {
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const t = setup();
    const owner = await asOwner(t);

    const avatar = await storeFile(t, 100, "png");
    await owner.action(api.profile.setAvatar, { storageId: avatar });
    const photoFile = await storeFile(t, 100, "jpeg");
    await owner.action(api.photos.add, { storageId: photoFile, width: 1, height: 1 });
    const videoId = await owner.mutation(api.videos.add, { url: "https://youtu.be/dQw4w9WgXcQ", title: "x" });
    const cover = await storeFile(t, 100, "webp");
    await owner.action(api.videos.setCover, { id: videoId, storageId: cover });
    const abandoned = await storeFile(t, 100, "png");

    vi.setSystemTime(new Date(Date.parse("2026-10-01T00:00:00Z") + 2 * DAY));
    const fresh = await storeFile(t, 100, "png"); // uploaded just now, attach pending

    const { deleted } = await t.mutation(internal.maintenance.cleanupOrphanedFiles, {});
    expect(deleted).toBe(1);
    const exists = (id: typeof avatar) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
    expect(await exists(abandoned)).toBe(false);
    for (const kept of [avatar, photoFile, cover, fresh]) expect(await exists(kept)).toBe(true);
  });
});

describe("purgeOldArchivedMessages", () => {
  test("only archived messages older than a year are deleted", async () => {
    vi.setSystemTime(new Date("2027-10-01T00:00:00Z"));
    const t = setup();
    const base = { name: "n", email: "e@x.example", topic: "other" as const, message: "m".repeat(20), emailStatus: "queued" as const };
    await t.run(async (ctx) => {
      await ctx.db.insert("contactMessages", { ...base, status: "archived", createdAt: Date.parse("2026-09-01T00:00:00Z") });
      await ctx.db.insert("contactMessages", { ...base, status: "archived", createdAt: Date.parse("2027-01-01T00:00:00Z") });
      await ctx.db.insert("contactMessages", { ...base, status: "new", createdAt: Date.parse("2025-01-01T00:00:00Z") });
      await ctx.db.insert("contactMessages", { ...base, status: "read", createdAt: Date.parse("2025-01-01T00:00:00Z") });
    });
    expect(await t.mutation(internal.maintenance.purgeOldArchivedMessages, {})).toEqual({ deleted: 1 });
    const left = await t.run((ctx) => ctx.db.query("contactMessages").collect());
    expect(left.map((m) => m.status).sort()).toEqual(["archived", "new", "read"]);
  });
});
