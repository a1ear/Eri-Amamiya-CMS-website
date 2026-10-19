import { ConvexError } from "convex/values";
import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { internal } from "../_generated/api";
import { action, mutation, query, type QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

export type AdminIdentity = {
  authUserId: string;
  email: string;
  name: string;
};

/**
 * The single authorization fence for the dashboard.
 *
 * Passes only when the caller has a live, unexpired Better Auth session AND
 * that user is listed in the `admins` table. Hiding UI is a courtesy; this is
 * the permission. Every admin function is built on `adminQuery` /
 * `adminMutation` below so the check cannot be forgotten.
 */
export async function requireAdmin(ctx: QueryCtx): Promise<AdminIdentity> {
  const result = await getAdmin(ctx);
  if (result.status !== "ok") {
    throw new ConvexError({
      code: result.status === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN",
    });
  }
  return result.admin;
}

/** Non-throwing form of `requireAdmin`. */
export async function getAdmin(
  ctx: QueryCtx,
): Promise<
  | { status: "ok"; admin: AdminIdentity }
  | { status: "unauthenticated" | "forbidden" }
> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return { status: "unauthenticated" };

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
    .unique();
  if (!admin) return { status: "forbidden" };

  return {
    status: "ok",
    admin: { authUserId: user._id, email: user.email, name: user.name },
  };
}

/** Query that only runs for an authenticated admin. `ctx.admin` is set. */
export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx: { admin: await requireAdmin(ctx) }, args: {} }),
});

/** Mutation that only runs for an authenticated admin. `ctx.admin` is set. */
export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: { admin: await requireAdmin(ctx) }, args: {} }),
});

/**
 * Action that only runs for an authenticated admin. Actions have no `ctx.db`,
 * so the check runs in an internal query; the caller's identity carries over.
 */
export const adminAction = customAction(action, {
  args: {},
  input: async (ctx): Promise<{ ctx: { admin: AdminIdentity }; args: Record<string, never> }> => ({
    ctx: { admin: await ctx.runQuery(internal.admin.assertAdmin, {}) },
    args: {},
  }),
});
