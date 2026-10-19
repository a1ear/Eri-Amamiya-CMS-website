import { describe, expect, test } from "vitest";
import { api, components, internal } from "./_generated/api";
import { buildAuth } from "./auth";
import {
  OWNER,
  STRANGER,
  createNonAdminUser,
  expectCode,
  setup,
  signIn,
} from "./test.helpers";

describe("requireAdmin via admin.me", () => {
  test("rejects a caller with no identity", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    await expectCode(t.query(api.admin.me, {}), "UNAUTHENTICATED");
  });

  test("allows the seeded admin with a live session", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const identity = await signIn(t, OWNER);
    const me = await t.withIdentity(identity).query(api.admin.me, {});
    expect(me).toMatchObject({ email: OWNER.email, name: OWNER.name });
  });

  test("rejects a signed-in user who is not in the admins table", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    await createNonAdminUser(t);
    const identity = await signIn(t, STRANGER);
    await expectCode(t.withIdentity(identity).query(api.admin.me, {}), "FORBIDDEN");
  });

  test("rejects a forged identity whose session does not exist", async () => {
    const t = setup();
    const { authUserId } = await t.action(internal.seed.createAdmin, OWNER);
    // Right user id, made-up session: a leaked user id alone must not be enough.
    const forged = t.withIdentity({ subject: authUserId, sessionId: "not-a-real-session" });
    await expectCode(forged.query(api.admin.me, {}), "UNAUTHENTICATED");
  });

  test("rejects an expired session", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const identity = await signIn(t, OWNER);
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: identity.sessionId }],
          update: { expiresAt: Date.now() - 1000 },
        },
      }),
    );
    await expectCode(t.withIdentity(identity).query(api.admin.me, {}), "UNAUTHENTICATED");
  });

  test("rejects a session after sign-out", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const identity = await signIn(t, OWNER);
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: "session", where: [{ field: "_id", value: identity.sessionId }] },
      }),
    );
    await expectCode(t.withIdentity(identity).query(api.admin.me, {}), "UNAUTHENTICATED");
  });
});

describe("admin.isAdmin (route-guard hint)", () => {
  test("is false for anonymous and non-admin, true for the admin", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    await createNonAdminUser(t);

    expect(await t.query(api.admin.isAdmin, {})).toBe(false);
    expect(await t.withIdentity(await signIn(t, STRANGER)).query(api.admin.isAdmin, {})).toBe(false);
    expect(await t.withIdentity(await signIn(t, OWNER)).query(api.admin.isAdmin, {})).toBe(true);
  });
});

describe("account creation", () => {
  test("public sign-up is disabled", async () => {
    const t = setup();
    await expect(
      t.run((ctx) =>
        buildAuth(ctx).api.signUpEmail({
          body: { email: "attacker@example.test", password: "attacker-password-123", name: "x" },
        }),
      ),
    ).rejects.toThrow(/sign up is not enabled/i);
  });

  test("the seed refuses to create a second admin", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    await expectCode(
      t.action(internal.seed.createAdmin, { ...STRANGER }),
      "ADMIN_EXISTS",
    );
  });

  test("rejects a weak seed password", async () => {
    const t = setup();
    await expect(
      t.action(internal.seed.createAdmin, { ...OWNER, password: "short" }),
    ).rejects.toThrow(/password/i);
    expect(await t.run((ctx) => ctx.db.query("admins").collect())).toHaveLength(0);
  });
});
