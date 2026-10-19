import { ConvexError } from "convex/values";

/**
 * Profile field rules. Imported by the admin form for counters and hints, but
 * the server (`parseProfileInput`) is the only authority.
 */
export const PROFILE_LIMITS = {
  displayName: { min: 1, max: 60 },
  tagline: { max: 120 },
  bio: { max: 280 },
  about: { max: 5000 },
  notifyEmail: { max: 254 },
} as const;

export const AVATAR_RULES = {
  maxBytes: 5 * 1024 * 1024,
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export type ProfileInput = {
  displayName: string;
  tagline: string;
  bio: string;
  about: string;
  timezone: string;
  notifyEmail: string;
};

export type FieldErrors = Partial<Record<keyof ProfileInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims, normalises newlines, and drops control characters other than \n and \t. */
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and normalises a profile update. Throws a ConvexError carrying
 * every field error at once so the form can show them together.
 */
export function parseProfileInput(input: ProfileInput): ProfileInput {
  const out: ProfileInput = {
    displayName: cleanText(input.displayName).replace(/\s+/g, " "),
    tagline: cleanText(input.tagline).replace(/\s+/g, " "),
    bio: cleanText(input.bio),
    about: cleanText(input.about),
    timezone: input.timezone.trim(),
    notifyEmail: input.notifyEmail.trim().toLowerCase(),
  };

  const errors: FieldErrors = {};
  const L = PROFILE_LIMITS;
  if (out.displayName.length < L.displayName.min) errors.displayName = "Name is required.";
  else if (out.displayName.length > L.displayName.max)
    errors.displayName = `Keep it under ${L.displayName.max} characters.`;
  if (out.tagline.length > L.tagline.max) errors.tagline = `Keep it under ${L.tagline.max} characters.`;
  if (out.bio.length > L.bio.max) errors.bio = `Keep it under ${L.bio.max} characters.`;
  if (out.about.length > L.about.max) errors.about = `Keep it under ${L.about.max} characters.`;
  if (!isValidTimeZone(out.timezone)) errors.timezone = "Pick a timezone from the list.";
  if (out.notifyEmail && (out.notifyEmail.length > L.notifyEmail.max || !EMAIL.test(out.notifyEmail)))
    errors.notifyEmail = "Enter a valid email address.";

  if (Object.keys(errors).length > 0) {
    throw new ConvexError({ code: "INVALID", fields: errors });
  }
  return out;
}
