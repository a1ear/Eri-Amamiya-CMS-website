import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { asOwner, asStranger, expectCode, setup, storeFile } from "./test.helpers";

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const TT = "https://www.tiktok.com/@eri/video/7234567890123456789";

describe("videos authorization", () => {
  test.each([
    ["anonymous", "UNAUTHENTICATED"],
    ["stranger", "FORBIDDEN"],
  ] as const)("%s is refused on every admin function", async (who, code) => {
    const t = setup();
    const caller = who === "anonymous" ? t : await asStranger(t);
    const id = await t.run((ctx) =>
      ctx.db.insert("videos", { url: YT, platform: "youtube", title: "x", order: 0, visible: false, createdAt: 0 }),
    );
    const storageId = await storeFile(t, 100, "png");

    await expectCode(caller.query(api.videos.listAdmin, {}), code);
    await expectCode(caller.mutation(api.videos.add, { url: YT, title: "x" }), code);
    await expectCode(caller.mutation(api.videos.update, { id, title: "y", visible: true }), code);
    await expectCode(caller.mutation(api.videos.move, { id, afterId: null }), code);
    await expectCode(caller.mutation(api.videos.remove, { id }), code);
    await expectCode(caller.mutation(api.videos.generateCoverUploadUrl, {}), code);
    await expectCode(caller.action(api.videos.setCover, { id, storageId }), code);
    await expectCode(caller.mutation(api.videos.removeCover, { id }), code);
    expect(await t.query(api.videos.listPublic, {})).toEqual([]);
  });
});

describe("videos", () => {
  test("add detects platform, derives a YouTube thumbnail, newest first", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await owner.mutation(api.videos.add, { url: TT, title: "Transformation" });
    await owner.mutation(api.videos.add, { url: "youtu.be/dQw4w9WgXcQ", title: "  Build   log " });
    const pub = await t.query(api.videos.listPublic, {});
    expect(pub.map((v) => [v.platform, v.title])).toEqual([
      ["youtube", "Build log"],
      ["tiktok", "Transformation"],
    ]);
    expect(pub[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(pub[0].url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(pub[1].thumbnailUrl).toBeNull();
    expect(pub[1].platformLabel).toBe("TikTok");
    expect(pub[0].embed).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(Object.keys(pub[0]).sort()).toEqual(["embed", "id", "platform", "platformLabel", "thumbnailUrl", "title", "url"]);
  });

  test("rejects script URLs and empty titles together", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const data = await expectCode(owner.mutation(api.videos.add, { url: "javascript:alert(1)", title: " " }), "INVALID");
    expect(Object.keys(data.fields!).sort()).toEqual(["title", "url"]);
  });

  test("hide removes it from the public list", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await owner.mutation(api.videos.add, { url: TT, title: "x" });
    await owner.mutation(api.videos.update, { id, title: "x", visible: false });
    expect(await t.query(api.videos.listPublic, {})).toEqual([]);
  });

  test("cover image: accepted, replaces thumbnail, old file deleted, removed with video", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await owner.mutation(api.videos.add, { url: YT, title: "x" });
    const first = await storeFile(t, 500, "jpeg");
    expect(await owner.action(api.videos.setCover, { id, storageId: first })).toEqual({ ok: true });
    expect((await t.query(api.videos.listPublic, {}))[0].thumbnailUrl).not.toContain("ytimg");

    const second = await storeFile(t, 500, "webp");
    await owner.action(api.videos.setCover, { id, storageId: second });
    expect(await t.run((ctx) => ctx.db.system.get(first))).toBeNull();

    await owner.mutation(api.videos.remove, { id });
    expect(await t.run((ctx) => ctx.db.system.get(second))).toBeNull();
  });

  test("cover upload that is not an image is rejected and deleted", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await owner.mutation(api.videos.add, { url: TT, title: "x" });
    const evil = await storeFile(t, 100, "html");
    expect((await owner.action(api.videos.setCover, { id, storageId: evil })).ok).toBe(false);
    expect(await t.run((ctx) => ctx.db.system.get(evil))).toBeNull();
  });

  test("cover for a video deleted mid-upload does not leak the file", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await owner.mutation(api.videos.add, { url: TT, title: "x" });
    await owner.mutation(api.videos.remove, { id });
    const file = await storeFile(t, 500, "png");
    expect(await owner.action(api.videos.setCover, { id, storageId: file })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get(file))).toBeNull();
  });

  test("move", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const a = await owner.mutation(api.videos.add, { url: TT, title: "a" });
    const b = await owner.mutation(api.videos.add, { url: TT, title: "b" });
    await owner.mutation(api.videos.move, { id: a, afterId: null });
    expect((await owner.query(api.videos.listAdmin, {})).map((v) => v._id)).toEqual([a, b]);
  });
});
