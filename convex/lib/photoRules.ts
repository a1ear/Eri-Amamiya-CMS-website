import { ConvexError } from "convex/values";
import { cleanText } from "./profileRules";

export const PHOTO_RULES = {
  maxBytes: 10 * 1024 * 1024,
  // The browser resizes to this before upload; the server only enforces bytes.
  resizeMaxSide: 2048,
  maxDimension: 20000,
  caption: { max: 200 },
  tag: { max: 60 },
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
  // Cap on what the public page loads in one go.
  publicLimit: 200,
} as const;

export type PhotoFields = { caption: string; tag: string; visible: boolean };

export function parsePhotoFields(input: PhotoFields): PhotoFields {
  const out = {
    caption: cleanText(input.caption).replace(/\s+/g, " "),
    tag: cleanText(input.tag).replace(/\s+/g, " "),
    visible: input.visible,
  };
  const fields: Record<string, string> = {};
  if (out.caption.length > PHOTO_RULES.caption.max)
    fields.caption = `Keep it under ${PHOTO_RULES.caption.max} characters.`;
  if (out.tag.length > PHOTO_RULES.tag.max) fields.tag = `Keep it under ${PHOTO_RULES.tag.max} characters.`;
  if (Object.keys(fields).length > 0) throw new ConvexError({ code: "INVALID", fields });
  return out;
}

/** Dimensions come from the browser and only drive layout; keep them sane. */
export function clampDimension(n: number): number {
  return Number.isFinite(n) ? Math.min(PHOTO_RULES.maxDimension, Math.max(1, Math.round(n))) : 1;
}
