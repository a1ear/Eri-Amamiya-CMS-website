import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { asOwner, asStranger, expectCode, setup } from "./test.helpers";

describe("social links authorization", () => {
  test.each([
    ["anonymous", "UNAUTHENTICATED"],
    ["stranger", "FORBIDDEN"],
  ] as const)("%s is refused on every write", async (who, code) => {
    const t = setup();
    const caller = who === "anonymous" ? t : await asStranger(t);
    const id = await t.run((ctx) =>
      ctx.db.insert("socialLinks", { platform: "tiktok", url: "https://www.tiktok.com/@eri", label: "TikTok", order: 0, createdAt: 0 }),
    );
    const evil = { platform: "website", url: "https://phish.example", label: "Free skins" };
    await expectCode(caller.mutation(api.socials.add, evil), code);
    await expectCode(caller.mutation(api.socials.update, { id, ...evil }), code);
    await expectCode(caller.mutation(api.socials.move, { id, afterId: null }), code);
    await expectCode(caller.mutation(api.socials.remove, { id }), code);
    expect(await t.query(api.socials.list, {})).toEqual([
      { id, platform: "tiktok", url: "https://www.tiktok.com/@eri", label: "TikTok" },
    ]);
  });
});

describe("social links", () => {
  test("add normalises handles and defaults the label; appended in order", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await owner.mutation(api.socials.add, { platform: "twitch", url: "@eri_live", label: "" });
    await owner.mutation(api.socials.add, { platform: "instagram", url: "instagram.com/eri", label: "Insta" });
    expect(await t.query(api.socials.list, {})).toMatchObject([
      { platform: "twitch", url: "https://www.twitch.tv/eri_live", label: "Twitch" },
      { platform: "instagram", url: "https://instagram.com/eri", label: "Insta" },
    ]);
  });

  test("rejects javascript: URLs, wrong-platform links and lookalike hosts", async () => {
    const t = setup();
    const owner = await asOwner(t);
    for (const [platform, url] of [
      ["website", "javascript:alert(document.cookie)"],
      ["tiktok", "https://instagram.com/eri"],
      ["tiktok", "https://tiktok.com.evil.example/@eri"],
      ["myspace", "https://myspace.com/x"],
    ]) {
      await expectCode(owner.mutation(api.socials.add, { platform, url, label: "" }), "INVALID");
    }
    expect(await t.query(api.socials.list, {})).toEqual([]);
  });

  test("update re-validates; move and remove work", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const a = await owner.mutation(api.socials.add, { platform: "tiktok", url: "@eri", label: "" });
    const b = await owner.mutation(api.socials.add, { platform: "x", url: "@eri", label: "" });
    await expectCode(
      owner.mutation(api.socials.update, { id: a, platform: "tiktok", url: "data:text/html,hi", label: "" }),
      "INVALID",
    );
    await owner.mutation(api.socials.move, { id: b, afterId: null });
    expect((await t.query(api.socials.list, {})).map((l) => l.id)).toEqual([b, a]);
    await owner.mutation(api.socials.remove, { id: a });
    expect((await t.query(api.socials.list, {})).map((l) => l.id)).toEqual([b]);
  });

  test("caps the number of links", async () => {
    const t = setup();
    const owner = await asOwner(t);
    for (let i = 0; i < 30; i++) await owner.mutation(api.socials.add, { platform: "website", url: `site${i}.example`, label: "" });
    await expectCode(owner.mutation(api.socials.add, { platform: "website", url: "one-more.example", label: "" }), "INVALID");
  });
});
