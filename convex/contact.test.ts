import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { asOwner, asStranger, expectCode, rejection, setup } from "./test.helpers";

const FORM = {
  name: "Brand Person",
  email: "Partnerships@Brand.example",
  topic: "brand" as const,
  message: "We'd love to send you our new wig line for a sponsored stream.",
  turnstileToken: "token-ok",
  website: "",
};

let siteverify: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  siteverify = vi.fn(async (_url: string, init: RequestInit) => {
    const token = new URLSearchParams(init.body as string).get("response");
    return new Response(JSON.stringify({ success: token === "token-ok", hostname: "eri.example" }));
  });
  vi.stubGlobal("fetch", siteverify);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function inbox(owner: Awaited<ReturnType<typeof asOwner>>, status: "new" | "read" | "archived" = "new") {
  return owner.query(api.contact.list, { status });
}

describe("contact.submit", () => {
  test("stores a valid message, normalised, and verifies Turnstile server-side", async () => {
    const t = setup();
    const owner = await asOwner(t);
    expect(await t.action(api.contact.submit, FORM)).toEqual({ ok: true });
    const [msg] = await inbox(owner);
    expect(msg).toMatchObject({ email: "partnerships@brand.example", topic: "brand", status: "new" });
    expect(siteverify).toHaveBeenCalledOnce();
    expect(siteverify.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });

  test("rejects a failed or missing Turnstile token and stores nothing", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await expectCode(t.action(api.contact.submit, { ...FORM, turnstileToken: "forged" }), "CAPTCHA_FAILED");
    await expectCode(t.action(api.contact.submit, { ...FORM, turnstileToken: "" }), "CAPTCHA_FAILED");
    expect(await inbox(owner)).toEqual([]);
  });

  test("fails closed when the Turnstile secret is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const t = setup();
    const owner = await asOwner(t);
    await expectCode(t.action(api.contact.submit, FORM), "CAPTCHA_FAILED");
    expect(await inbox(owner)).toEqual([]);
  });

  test("enforces the expected hostname when configured", async () => {
    vi.stubEnv("TURNSTILE_EXPECTED_HOSTNAME", "other.example");
    const t = setup();
    await expectCode(t.action(api.contact.submit, FORM), "CAPTCHA_FAILED");
  });

  test("honeypot: pretends success, stores nothing, never calls Turnstile", async () => {
    const t = setup();
    const owner = await asOwner(t);
    expect(await t.action(api.contact.submit, { ...FORM, website: "http://spam.example" })).toEqual({ ok: true });
    expect(await inbox(owner)).toEqual([]);
    expect(siteverify).not.toHaveBeenCalled();
  });

  test("validates every field before spending a Turnstile check", async () => {
    const t = setup();
    const data = await expectCode(
      t.action(api.contact.submit, { ...FORM, name: " ", email: "nope", message: "hi" }),
      "INVALID",
    );
    expect(Object.keys(data.fields!).sort()).toEqual(["email", "message", "name"]);
    expect(siteverify).not.toHaveBeenCalled();
  });

  test("per-sender rate limit: 4th message in 10 minutes is refused", async () => {
    const t = setup();
    const owner = await asOwner(t);
    for (let i = 0; i < 3; i++) await t.action(api.contact.submit, FORM);
    const err = await rejection(t.action(api.contact.submit, FORM));
    expect((err as { data?: { kind?: string } }).data?.kind).toBe("RateLimited");
    expect(await inbox(owner)).toHaveLength(3);
    // A different sender is unaffected.
    await t.action(api.contact.submit, { ...FORM, email: "someone@else.example" });
    expect(await inbox(owner)).toHaveLength(4);
  });

  test("global rate limit caps a flood from many senders", async () => {
    const t = setup();
    const owner = await asOwner(t);
    let refused = 0;
    for (let i = 0; i < 25; i++) {
      await t.action(api.contact.submit, { ...FORM, email: `s${i}@flood.example` }).catch(() => refused++);
    }
    expect(refused).toBeGreaterThan(0);
    expect((await inbox(owner)).length).toBeLessThanOrEqual(20);
  });

  test("email status: not_configured, then failed-but-kept in test mode, then queued", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await t.action(api.contact.submit, FORM);
    expect((await inbox(owner))[0].emailStatus).toBe("not_configured");

    // Configured, but Resend test mode refuses real recipients. The message
    // must still be stored.
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Site <inbox@eri.example>");
    await t.action(api.contact.submit, { ...FORM, email: "second@brand.example" });
    expect((await inbox(owner))[0]).toMatchObject({ email: "second@brand.example", emailStatus: "failed" });

    vi.stubEnv("RESEND_TEST_MODE", "false");
    await t.action(api.contact.submit, { ...FORM, email: "third@brand.example" });
    expect((await inbox(owner))[0]).toMatchObject({ email: "third@brand.example", emailStatus: "queued" });
    expect(await inbox(owner)).toHaveLength(3);
  });
});

describe("inbox", () => {
  test.each([
    ["anonymous", "UNAUTHENTICATED"],
    ["stranger", "FORBIDDEN"],
  ] as const)("%s cannot read or change messages", async (who, code) => {
    const t = setup();
    const caller = who === "anonymous" ? t : await asStranger(t);
    await t.action(api.contact.submit, FORM);
    const id = await t.run(async (ctx) => (await ctx.db.query("contactMessages").first())!._id);
    await expectCode(caller.query(api.contact.list, { status: "new" }), code);
    await expectCode(caller.query(api.contact.unreadCount, {}), code);
    await expectCode(caller.mutation(api.contact.setStatus, { id, status: "archived" }), code);
  });

  test("status changes move messages between views; content never changes", async () => {
    const t = setup();
    const owner = await asOwner(t);
    await t.action(api.contact.submit, FORM);
    const [msg] = await inbox(owner);
    expect(await owner.query(api.contact.unreadCount, {})).toBe(1);

    await owner.mutation(api.contact.setStatus, { id: msg._id, status: "read" });
    expect(await owner.query(api.contact.unreadCount, {})).toBe(0);
    await owner.mutation(api.contact.setStatus, { id: msg._id, status: "archived" });
    const [archived] = await inbox(owner, "archived");
    expect({ ...archived, status: undefined }).toEqual({ ...msg, status: undefined });
  });
});
