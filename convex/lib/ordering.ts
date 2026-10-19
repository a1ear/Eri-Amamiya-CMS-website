import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Tables sorted by a fractional `order` field with a `by_order` index. */
export type OrderedTable = "photos" | "videos" | "socialLinks";

type OrderedDoc = { _id: Id<OrderedTable>; order: number };

// Below this gap, midpoints lose float precision; renumber everything first.
const MIN_GAP = 1e-6;

function byOrder(ctx: QueryCtx, table: OrderedTable) {
  // The three tables share the same index shape; TS cannot see that through
  // the union, hence the narrow cast.
  return ctx.db.query(table as "photos").withIndex("by_order");
}

/** Sort key that places a new row first. */
export async function orderForFirst(ctx: QueryCtx, table: OrderedTable): Promise<number> {
  const first = await byOrder(ctx, table).first();
  return first ? first.order - 1 : 0;
}

/** Sort key that places a new row last. */
export async function orderForLast(ctx: QueryCtx, table: OrderedTable): Promise<number> {
  const last = await byOrder(ctx, table).order("desc").first();
  return last ? last.order + 1 : 0;
}

async function renumber(ctx: MutationCtx, table: OrderedTable) {
  const all = (await byOrder(ctx, table).collect()) as OrderedDoc[];
  await Promise.all(all.map((d, i) => (d.order === i ? null : ctx.db.patch(d._id, { order: i }))));
}

/** First row after `order` in sort order, skipping `skip`. */
async function nextAfter(ctx: QueryCtx, table: OrderedTable, order: number | null, skip: Id<OrderedTable>) {
  const candidates = (await ctx.db
    .query(table as "photos")
    .withIndex("by_order", (q) => (order === null ? q : q.gt("order", order)))
    .take(2)) as OrderedDoc[];
  return candidates.find((d) => d._id !== skip) ?? null;
}

/**
 * Places row `id` directly after `afterId`, or first when `afterId` is null.
 * One row is patched unless the gap is exhausted, then all are renumbered.
 * Throws NOT_FOUND if either row is missing.
 */
export async function moveAfter<T extends OrderedTable>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  afterId: Id<T> | null,
) {
  const getOrThrow = async (rowId: Id<T>) => {
    const doc = (await ctx.db.get(rowId)) as OrderedDoc | null;
    if (!doc) throw new ConvexError({ code: "NOT_FOUND" });
    return doc;
  };
  await getOrThrow(id);
  if (afterId === id) return;

  const compute = async (): Promise<number | null> => {
    if (afterId === null) {
      const first = await nextAfter(ctx, table, null, id);
      return first ? first.order - 1 : 0;
    }
    const after = await getOrThrow(afterId);
    const next = await nextAfter(ctx, table, after.order, id);
    if (!next) return after.order + 1;
    if (next.order - after.order < MIN_GAP) return null;
    return (after.order + next.order) / 2;
  };

  let order = await compute();
  if (order === null) {
    await renumber(ctx, table);
    order = (await compute())!;
  }
  await ctx.db.patch(id as Id<"photos">, { order });
}
