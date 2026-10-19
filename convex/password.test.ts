import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import { buildAuth } from "./auth";
import { createNonAdminUser, expectCode, OWNER, setup, signIn, STRANGER } from "./test.helpers";

afterEach(() => vi.unstubAllEnvs());

const NEW_PASSWORD = "a-brand-new-long-password";

describe("CLI password recovery (seed:resetAdminPassword)", () => {
  test("sets the new password, kills the old one and signs out every session", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const session = await signIn(t, OWNER);
    expect(await t.withIdentity(session).query(api.admin.me, {})).toMatchObject({ email: OWNER.email });

    await t.action(internal.seed.resetAdminPassword, { email: OWNER.email, password: NEW_PASSWORD });

    await expectCode(t.withIdentity(session).query(api.admin.me, {}), "UNAUTHENTICATED");
    await expect(signIn(t, OWNER)).rejects.toThrow();
    const fresh = await signIn(t, { email: OWNER.email, password: NEW_PASSWORD });
    expect(await t.withIdentity(fresh).query(api.admin.isAdmin, {})).toBe(true);
  });

  test("refuses short passwords, unknown emails and non-admin accounts", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    await createNonAdminUser(t);
    await expectCode(t.action(internal.seed.resetAdminPassword, { email: OWNER.email, password: "short" }), "INVALID");
    await expectCode(t.action(internal.seed.resetAdminPassword, { email: "nobody@x.example", password: NEW_PASSWORD }), "NOT_FOUND");
    await expectCode(t.action(internal.seed.resetAdminPassword, { email: STRANGER.email, password: NEW_PASSWORD }), "NOT_ADMIN");
  });
});

describe("password reset by email", () => {
  test("answers identically for real and unknown emails (no account enumeration)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Site <inbox@eri.example>");
    vi.stubEnv("RESEND_TEST_MODE", "false");
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const ask = (email: string) =>
      t.run((ctx) =>
        buildAuth(ctx).api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3000/admin/reset-password" } }),
      );
    expect(await ask(OWNER.email)).toEqual(await ask("nobody@x.example"));
  });

  // Redirect-origin checks are HTTP middleware; they are verified against
  // the running server in the live smoke test, not here.

  test("a reset token works once, changes the password and revokes sessions", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const session = await signIn(t, OWNER);
    // Issue a token the way the email flow does, then use it.
    const token = "test-reset-token-0123456789";
    await t.run(async (ctx) => {
      const auth = await buildAuth(ctx).$context;
      await auth.internalAdapter.createVerificationValue({
        value: session.subject,
        identifier: `reset-password:${token}`,
        expiresAt: new Date(Date.now() + 60_000),
      });
    });
    await t.run((ctx) => buildAuth(ctx).api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } }));
    await expectCode(t.withIdentity(session).query(api.admin.me, {}), "UNAUTHENTICATED");
    await signIn(t, { email: OWNER.email, password: NEW_PASSWORD });
    await expect(
      t.run((ctx) => buildAuth(ctx).api.resetPassword({ body: { token, newPassword: "yet-another-password-1" } })),
    ).rejects.toThrow();
  });
});

describe("change password (signed in)", () => {
  test("requires the current password; revokes other sessions", async () => {
    const t = setup();
    await t.action(internal.seed.createAdmin, OWNER);
    const other = await signIn(t, OWNER);
    const current = await signIn(t, OWNER);
    const token = await t.run(async (ctx) => {
      const s = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "_id", value: current.sessionId }],
      });
      return s!.token as string;
    });
    const bearer = () => new Headers({ authorization: `Bearer ${token}` });

    await expect(
      t.run((ctx) =>
        buildAuth(ctx).api.changePassword({
          body: { currentPassword: "wrong-password-123", newPassword: NEW_PASSWORD },
          headers: bearer(),
        }),
      ),
    ).rejects.toThrow();

    await t.run((ctx) =>
      buildAuth(ctx).api.changePassword({
        body: { currentPassword: OWNER.password, newPassword: NEW_PASSWORD, revokeOtherSessions: true },
        headers: bearer(),
      }),
    );
    await expectCode(t.withIdentity(other).query(api.admin.me, {}), "UNAUTHENTICATED");
    await signIn(t, { email: OWNER.email, password: NEW_PASSWORD });
  });
});
