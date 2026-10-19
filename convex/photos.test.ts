import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asOwner, asStranger, expectCode, rejection, setup, storeFile, type T } from "./test.helpers";

type Client = Awaited<ReturnType<typeof asOwner>>;

async function addPhoto(t: T, owner: Client, kind: "png" | "jpeg" | "webp" = "png") {
  const storageId = await storeFile(t, 2000, kind);
  const res = await owner.action(api.photos.add, { storageId, width: 800, height: 1000 });
  if (!res.ok) throw new Error(res.error);
  return res.id;
}

async function adminOrder(owner: Client) {
  return (await owner.query(api.photos.listAdmin, {})).map((p) => p._id);
}

describe("photos authorization", () => {
  test.each([
    ["anonymous", "UNAUTHENTICATED"],
    ["stranger", "FORBIDDEN"],
  ] as const)("%s is refused on every admin function", async (who, code) => {
    const t = setup();
    const caller = who === "anonymous" ? t : await asStranger(t);
    const storageId = await storeFile(t, 2000, "png");
    const photo = await t.run(async (ctx) =>
      ctx.db.insert("photos", {
        storageId, caption: "", tag: "", order: 0, visible: false, width: 1, height: 1, createdAt: 0,
      }),
    );

    await expectCode(caller.query(api.photos.listAdmin, {}), code);
    await expectCode(caller.mutation(api.photos.generateUploadUrl, {}), code);
    await expectCode(caller.action(api.photos.add, { storageId, width: 1, height: 1 }), code);
    await expectCode(caller.mutation(api.photos.update, { id: photo, caption: "x", tag: "", visible: true }), code);
    await expectCode(caller.mutation(api.photos.move, { id: photo, afterId: null }), code);
    await expectCode(caller.mutation(api.photos.remove, { id: photo }), code);

    // Still hidden, still there, file intact.
    expect(await t.query(api.photos.listPublic, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(photo))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
  });
});

describe("photos.add", () => {
  test("new photos go to the top and are visible", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const a = await addPhoto(t, owner);
    const b = await addPhoto(t, owner, "jpeg");
    const c = await addPhoto(t, owner, "webp");
    expect(await adminOrder(owner)).toEqual([c, b, a]);
    expect((await t.query(api.photos.listPublic, {})).map((p) => p.id)).toEqual([c, b, a]);
  });

  test("rejects and deletes a non-image upload", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const storageId = await storeFile(t, 500, "html");
    const res = await owner.action(api.photos.add, { storageId, width: 10, height: 10 });
    expect(res).toEqual({ ok: false, error: "Use a JPG, PNG or WebP image." });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
    expect(await adminOrder(owner)).toEqual([]);
  });

  test("rejects and deletes an image over 10 MB", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const storageId = await storeFile(t, 10 * 1024 * 1024 + 1, "jpeg");
    const res = await owner.action(api.photos.add, { storageId, width: 10, height: 10 });
    expect(res.ok).toBe(false);
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  });

  test("clamps nonsense dimensions from the browser", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const storageId = await storeFile(t, 2000, "png");
    await owner.action(api.photos.add, { storageId, width: -5, height: 1e9 });
    const [photo] = await owner.query(api.photos.listAdmin, {});
    expect([photo.width, photo.height]).toEqual([1, 20000]);
  });
});

describe("photos.update", () => {
  test("saves caption, tag and visibility; hidden photos leave the public list", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await addPhoto(t, owner);
    await owner.mutation(api.photos.update, { id, caption: "  Frieren   at  AniCon ", tag: "Frieren", visible: true });
    expect((await t.query(api.photos.listPublic, {}))[0]).toMatchObject({
      caption: "Frieren at AniCon",
      tag: "Frieren",
    });

    await owner.mutation(api.photos.update, { id, caption: "x", tag: "", visible: false });
    expect(await t.query(api.photos.listPublic, {})).toEqual([]);
    expect(await adminOrder(owner)).toEqual([id]);
  });

  test("rejects over-long fields", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await addPhoto(t, owner);
    const data = await expectCode(
      owner.mutation(api.photos.update, { id, caption: "x".repeat(201), tag: "y".repeat(61), visible: true }),
      "INVALID",
    );
    expect(Object.keys(data.fields!).sort()).toEqual(["caption", "tag"]);
  });

  test("public list exposes only display fields", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await addPhoto(t, owner);
    const [p] = await t.query(api.photos.listPublic, {});
    expect(Object.keys(p).sort()).toEqual(["caption", "height", "id", "tag", "url", "width"]);
  });
});

describe("photos.move", () => {
  async function three() {
    const t = setup();
    const owner = await asOwner(t);
    const a = await addPhoto(t, owner);
    const b = await addPhoto(t, owner);
    const c = await addPhoto(t, owner);
    // Order is now c, b, a
    return { t, owner, a, b, c };
  }

  test("move to first", async () => {
    const { owner, a, b, c } = await three();
    await owner.mutation(api.photos.move, { id: a, afterId: null });
    expect(await adminOrder(owner)).toEqual([a, c, b]);
  });

  test("move to the middle", async () => {
    const { owner, a, b, c } = await three();
    await owner.mutation(api.photos.move, { id: c, afterId: b });
    expect(await adminOrder(owner)).toEqual([b, c, a]);
  });

  test("move to last", async () => {
    const { owner, a, b, c } = await three();
    await owner.mutation(api.photos.move, { id: c, afterId: a });
    expect(await adminOrder(owner)).toEqual([b, a, c]);
  });

  test("moving after itself or to its current spot changes nothing", async () => {
    const { owner, a, b, c } = await three();
    await owner.mutation(api.photos.move, { id: b, afterId: b });
    await owner.mutation(api.photos.move, { id: b, afterId: c });
    expect(await adminOrder(owner)).toEqual([c, b, a]);
  });

  test("survives 200 moves into the same gap (renumbers when floats run out)", async () => {
    const { owner, a, b, c } = await three();
    // Repeatedly put the last photo between the first two.
    let order = await adminOrder(owner);
    for (let i = 0; i < 200; i++) {
      const last = order[order.length - 1];
      await owner.mutation(api.photos.move, { id: last, afterId: order[0] });
      order = [order[0], last, ...order.slice(1, -1)];
    }
    expect(await adminOrder(owner)).toEqual(order);
    expect(new Set(order)).toEqual(new Set([a, b, c]));
  });

  test("unknown target is NOT_FOUND", async () => {
    const { t, owner, a } = await three();
    const ghost = await t.run(async (ctx) => {
      const id = await ctx.db.insert("photos", {
        storageId: (await ctx.storage.store(new Blob(["x"]))) as Id<"_storage">,
        caption: "", tag: "", order: 99, visible: true, width: 1, height: 1, createdAt: 0,
      });
      await ctx.db.delete(id);
      return id;
    });
    await expectCode(owner.mutation(api.photos.move, { id: a, afterId: ghost }), "NOT_FOUND");
  });
});

describe("photos.remove", () => {
  test("deletes the row and the stored file", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await addPhoto(t, owner);
    const [{ storageId }] = await owner.query(api.photos.listAdmin, {});
    await owner.mutation(api.photos.remove, { id });
    expect(await adminOrder(owner)).toEqual([]);
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  });
});

describe("upload rate limit", () => {
  test("a leaked session cannot mint unlimited upload URLs", async () => {
    const t = setup();
    const owner = await asOwner(t);
    for (let i = 0; i < 60; i++) await owner.mutation(api.photos.generateUploadUrl, {});
    const err = await rejection(owner.mutation(api.photos.generateUploadUrl, {}));
    expect((err as { data?: { kind?: string } }).data?.kind).toBe("RateLimited");
    // The avatar endpoint shares the same bucket.
    const err2 = await rejection(owner.mutation(api.profile.generateAvatarUploadUrl, {}));
    expect((err2 as { data?: { kind?: string } }).data?.kind).toBe("RateLimited");
  });
});
