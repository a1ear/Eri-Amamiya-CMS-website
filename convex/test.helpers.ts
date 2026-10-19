/// <reference types="vite/client" />
// Shared convex-test helpers. The double-dot filename keeps Convex from
// deploying this file.
import betterAuthTest from "@convex-dev/better-auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import resendTest from "@convex-dev/resend/test";
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect } from "vitest";
import { components, internal } from "./_generated/api";
import { buildAuth } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

export const OWNER = { email: "owner@example.test", password: "correct-horse-battery", name: "Owner" };
export const STRANGER = { email: "stranger@example.test", password: "another-long-password", name: "Stranger" };

export function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t, "betterAuth");
  rateLimiterTest.register(t, "rateLimiter");
  resendTest.register(t, "resend");
  rateLimiterTest.register(t, "resend/rateLimiter");
  workpoolTest.register(t, "resend/emailWorkpool");
  workpoolTest.register(t, "resend/callbackWorkpool");
  return t;
}

const MAGIC: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  html: [...new TextEncoder().encode("<!doctype html><script>")],
};

/** Stores `bytes` bytes starting with the given format's signature. */
export async function storeFile(t: T, bytes: number, kind: keyof typeof MAGIC) {
  const data = new Uint8Array(bytes);
  data.set(MAGIC[kind]);
  return t.run((ctx) => ctx.storage.store(new Blob([data])));
}
export type T = ReturnType<typeof setup>;

/** Signs in through real Better Auth and returns a convex-test identity for that session. */
export async function signIn(t: T, creds: { email: string; password: string }) {
  return t.run(async (ctx) => {
    const { token, user } = await buildAuth(ctx).api.signInEmail({ body: creds });
    const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "token", value: token }],
    });
    if (!session) throw new Error("session not created");
    return { subject: user.id, sessionId: session._id as string };
  });
}

/** Creates a Better Auth user that is NOT in the admins table. */
export async function createNonAdminUser(t: T) {
  await t.run(async (ctx) => {
    await buildAuth(ctx, { allowSignUp: true }).api.signUpEmail({ body: STRANGER });
  });
}

/** Seeds the owner and returns a client acting as them. */
export async function asOwner(t: T) {
  await t.action(internal.seed.createAdmin, OWNER);
  return t.withIdentity(await signIn(t, OWNER));
}

/** Seeds the owner plus a signed-in non-admin; returns the non-admin client. */
export async function asStranger(t: T) {
  await t.action(internal.seed.createAdmin, OWNER);
  await createNonAdminUser(t);
  return t.withIdentity(await signIn(t, STRANGER));
}

export async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("expected the call to fail, it succeeded");
    },
    (e: unknown) => e,
  );
}

export async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: string }>).data).toMatchObject({ code });
  return (error as ConvexError<{ code: string; fields?: Record<string, string> }>).data;
}
