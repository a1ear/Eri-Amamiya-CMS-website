import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { asOwner, asStranger, expectCode, setup, storeFile } from "./test.helpers";

const VALID = {
  displayName: "Eri",
  tagline: "Cosplayer & streamer",
  bio: "Short intro.",
  about: "Longer story.",
  timezone: "Asia/Manila",
  notifyEmail: "collabs@example.test",
};

describe("profile authorization", () => {
  test("anonymous and non-admin callers cannot read the private profile or write anything", async () => {
    const t = setup();
    const stranger = await asStranger(t);
    for (const caller of [t, stranger]) {
      const code = caller === t ? "UNAUTHENTICATED" : "FORBIDDEN";
      await expectCode(caller.query(api.profile.get, {}), code);
      await expectCode(caller.mutation(api.profile.update, VALID), code);
      await expectCode(caller.mutation(api.profile.generateAvatarUploadUrl, {}), code);
      await expectCode(caller.mutation(api.profile.removeAvatar, {}), code);
    }
    // Nothing changed.
    const pub = await t.query(api.profile.getPublic, {});
    expect(pub?.displayName).toBe("Owner");
  });

  test("a stranger cannot attach a file as the avatar", async () => {
    const t = setup();
    const stranger = await asStranger(t);
    const id = await storeFile(t, 100, "png");
    await expectCode(stranger.action(api.profile.setAvatar, { storageId: id }), "FORBIDDEN");
  });
});

describe("profile.getPublic", () => {
  test("seed creates a profile so the hero is never empty", async () => {
    const t = setup();
    await asOwner(t);
    expect(await t.query(api.profile.getPublic, {})).toMatchObject({ displayName: "Owner", avatarUrl: null });
  });

  test("never exposes the private notification email or internal ids", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await owner.mutation(api.profile.update, VALID);
    const pub = await t.query(api.profile.getPublic, {});
    expect(Object.keys(pub!).sort()).toEqual(
      ["about", "avatarUrl", "bio", "displayName", "tagline", "timezone"].sort(),
    );
    expect(JSON.stringify(pub)).not.toContain("collabs@example.test");
  });
});

describe("profile.update validation", () => {
  test("saves and normalises valid input", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await owner.mutation(api.profile.update, {
      ...VALID,
      displayName: "  Eri   Cos  ",
      about: "line one\r\nline two\u0000",
      notifyEmail: " Collabs@Example.TEST ",
    });
    const saved = await owner.query(api.profile.get, {});
    expect(saved).toMatchObject({
      displayName: "Eri Cos",
      about: "line one\nline two",
      notifyEmail: "collabs@example.test",
    });
  });

  test("reports every bad field at once and writes nothing", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const data = await expectCode(
      owner.mutation(api.profile.update, {
        displayName: "   ",
        tagline: "x".repeat(121),
        bio: "x".repeat(281),
        about: "x".repeat(5001),
        timezone: "Mars/Olympus_Mons",
        notifyEmail: "not-an-email",
      }),
      "INVALID",
    );
    expect(Object.keys(data.fields!).sort()).toEqual(
      ["about", "bio", "displayName", "notifyEmail", "tagline", "timezone"].sort(),
    );
    expect((await owner.query(api.profile.get, {}))?.displayName).toBe("Owner");
  });

  test("empty notification email is allowed", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await owner.mutation(api.profile.update, { ...VALID, notifyEmail: "" });
    expect((await owner.query(api.profile.get, {}))?.notifyEmail).toBe("");
  });
});

describe("avatar", () => {
  test("accepts an image, and replacing it deletes the old file", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const first = await storeFile(t, 1000, "webp");
    await owner.action(api.profile.setAvatar, { storageId: first });
    expect((await t.query(api.profile.getPublic, {}))?.avatarUrl).toBeTruthy();

    const second = await storeFile(t, 1000, "jpeg");
    await owner.action(api.profile.setAvatar, { storageId: second });
    expect(await t.run((ctx) => ctx.db.system.get(first))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(second))).not.toBeNull();
  });

  test("rejects and deletes a non-image upload", async () => {
    const t = setup();
    const owner = await asOwner(t);
    // Claims nothing; bytes are HTML. A Content-Type header would not save it.
    const id = await storeFile(t, 100, "html");
    expect(await owner.action(api.profile.setAvatar, { storageId: id })).toEqual({
      ok: false,
      error: "Use a JPG, PNG or WebP image.",
    });
    expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
  });

  test("rejects and deletes an oversized image", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await storeFile(t, 5 * 1024 * 1024 + 1, "png");
    expect(await owner.action(api.profile.setAvatar, { storageId: id })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
  });

  test("remove clears the avatar and deletes the file", async () => {
    const t = setup();
    const owner = await asOwner(t);
    const id = await storeFile(t, 1000, "png");
    await owner.action(api.profile.setAvatar, { storageId: id });
    await owner.mutation(api.profile.removeAvatar, {});
    expect((await t.query(api.profile.getPublic, {}))?.avatarUrl).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
  });
});
