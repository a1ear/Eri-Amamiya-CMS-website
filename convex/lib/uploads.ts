import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { sniffImageType } from "./imageSniff";
import { rateLimiter } from "./rateLimits";

/** Upload URL for an admin, counted against the shared upload rate limit. */
export async function limitedUploadUrl(ctx: MutationCtx, adminId: string) {
  await rateLimiter.limit(ctx, "upload", { key: adminId, throws: true });
  return ctx.storage.generateUploadUrl();
}

/**
 * Verifies an uploaded file by its bytes (never the Content-Type the browser
 * claimed). On failure the file is deleted and a user-facing message returned.
 * Call from an action, so the delete is not rolled back by a later error.
 */
export async function checkUploadedImage(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  maxBytes: number,
): Promise<string | null> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) return "Upload not found. Try again.";

  const type = sniffImageType(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  const error = !type
    ? "Use a JPG, PNG or WebP image."
    : blob.size > maxBytes
      ? `Image is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`
      : null;
  if (error) await ctx.storage.delete(storageId);
  return error;
}
