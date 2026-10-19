import { internalQuery, query } from "./_generated/server";
import { adminQuery, getAdmin, requireAdmin, type AdminIdentity } from "./lib/requireAdmin";

/** The signed-in admin. Throws for anyone else. */
export const me = adminQuery({
  args: {},
  handler: async (ctx) => ctx.admin,
});

/**
 * Non-throwing check used by the dashboard route guard to decide whether to
 * redirect. Grants nothing: every admin function re-checks on its own.
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => (await getAdmin(ctx)).status === "ok",
});

/** Used by `adminAction`: throws unless the caller is the admin. */
export const assertAdmin = internalQuery({
  args: {},
  handler: async (ctx): Promise<AdminIdentity> => requireAdmin(ctx),
});
