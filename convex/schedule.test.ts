import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { asOwner, asStranger, expectCode, setup } from "./test.helpers";

const SLOT = { dayOfWeek: 5, startMinute: 22 * 60, durationMinutes: 180, title: "Late night" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T04:00:00Z")); // Wed 12:00 in Manila
});
afterEach(() => vi.useRealTimers());

async function ownerInManila() {
  const t = setup();
  const owner = await asOwner(t);
  await owner.mutation(api.profile.update, {
    displayName: "Eri", tagline: "", bio: "", about: "", timezone: "Asia/Manila", notifyEmail: "",
  });
  return { t, owner };
}

describe("schedule authorization", () => {
  test.each([
    ["anonymous", "UNAUTHENTICATED"],
    ["stranger", "FORBIDDEN"],
  ] as const)("%s is refused on every admin function", async (who, code) => {
    const t = setup();
    const caller = who === "anonymous" ? t : await asStranger(t);
    const slot = await t.run((ctx) => ctx.db.insert("scheduleSlots", { ...SLOT, createdAt: 0 }));
    const ov = await t.run((ctx) =>
      ctx.db.insert("scheduleOverrides", { date: "2026-10-23", kind: "cancelled", title: "", note: "", createdAt: 0 }),
    );
    await expectCode(caller.query(api.schedule.getAdmin, {}), code);
    await expectCode(caller.mutation(api.schedule.addSlot, SLOT), code);
    await expectCode(caller.mutation(api.schedule.updateSlot, { id: slot, ...SLOT, title: "x" }), code);
    await expectCode(caller.mutation(api.schedule.removeSlot, { id: slot }), code);
    await expectCode(
      caller.mutation(api.schedule.addOverride, { date: "2026-10-24", kind: "cancelled", title: "", note: "" }),
      code,
    );
    await expectCode(caller.mutation(api.schedule.removeOverride, { id: ov }), code);
  });
});

describe("weekly slots", () => {
  test("add, update, remove; public view carries the owner's timezone", async () => {
    const { t, owner } = await ownerInManila();
    const id = await owner.mutation(api.schedule.addSlot, { ...SLOT, title: "  " });
    let pub = await t.query(api.schedule.getPublic, { fromDate: "2026-10-21" });
    expect(pub).toMatchObject({ timeZone: "Asia/Manila", slots: [{ ...SLOT, title: "Stream" }] });
    expect(Object.keys(pub.slots[0]).sort()).toEqual(["dayOfWeek", "durationMinutes", "startMinute", "title"]);

    await owner.mutation(api.schedule.updateSlot, { id, ...SLOT, dayOfWeek: 6 });
    pub = await t.query(api.schedule.getPublic, { fromDate: "2026-10-21" });
    expect(pub.slots[0].dayOfWeek).toBe(6);

    await owner.mutation(api.schedule.removeSlot, { id });
    expect((await t.query(api.schedule.getPublic, { fromDate: "2026-10-21" })).slots).toEqual([]);
  });

  test("rejects bad day, times and durations", async () => {
    const { owner } = await ownerInManila();
    const data = await expectCode(
      owner.mutation(api.schedule.addSlot, { dayOfWeek: 7, startMinute: 1440, durationMinutes: 5, title: "x".repeat(61) }),
      "INVALID",
    );
    expect(Object.keys(data.fields!).sort()).toEqual(["day", "end", "start", "title"]);
    await expectCode(owner.mutation(api.schedule.addSlot, { ...SLOT, durationMinutes: 13 * 60 }), "INVALID");
    await expectCode(owner.mutation(api.schedule.addSlot, { ...SLOT, startMinute: 12.5 }), "INVALID");
  });
});

describe("overrides", () => {
  test("day off: one per date, re-adding updates the note", async () => {
    const { t, owner } = await ownerInManila();
    const a = await owner.mutation(api.schedule.addOverride, { date: "2026-10-23", kind: "cancelled", title: "", note: "Con" });
    const b = await owner.mutation(api.schedule.addOverride, { date: "2026-10-23", kind: "cancelled", title: "", note: "AniCon trip" });
    expect(b).toBe(a);
    const pub = await t.query(api.schedule.getPublic, { fromDate: "2026-10-21" });
    expect(pub.overrides).toEqual([{ date: "2026-10-23", kind: "cancelled", note: "AniCon trip" }]);
  });

  test("special stream needs times; gets a default title", async () => {
    const { t, owner } = await ownerInManila();
    await expectCode(
      owner.mutation(api.schedule.addOverride, { date: "2026-10-31", kind: "special", title: "", note: "" }),
      "INVALID",
    );
    await owner.mutation(api.schedule.addOverride, {
      date: "2026-10-31", kind: "special", startMinute: 21 * 60, durationMinutes: 240, title: "", note: "",
    });
    const pub = await t.query(api.schedule.getPublic, { fromDate: "2026-10-21" });
    expect(pub.overrides[0]).toMatchObject({ kind: "special", title: "Special stream", startMinute: 1260 });
  });

  test("rejects past dates, far-future dates and impossible dates", async () => {
    const { owner } = await ownerInManila();
    for (const date of ["2026-10-20", "2027-12-01", "2026-02-30", "next friday"]) {
      await expectCode(owner.mutation(api.schedule.addOverride, { date, kind: "cancelled", title: "", note: "" }), "INVALID");
    }
  });

  test("public query rejects a malformed fromDate", async () => {
    const t = setup();
    await expectCode(t.query(api.schedule.getPublic, { fromDate: "'; DROP TABLE" }), "INVALID");
  });

  test("admin sees today's and future overrides; past ones are kept, not deleted", async () => {
    const { t, owner } = await ownerInManila();
    await owner.mutation(api.schedule.addOverride, { date: "2026-10-22", kind: "cancelled", title: "", note: "x" });
    vi.setSystemTime(new Date("2026-10-25T04:00:00Z"));
    const admin = await owner.query(api.schedule.getAdmin, {});
    expect(admin.today).toBe("2026-10-25");
    expect(admin.overrides).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("scheduleOverrides").collect())).toHaveLength(1);
  });
});
