import { ConvexError } from "convex/values";
import { cleanText } from "./profileRules";

export const CONTACT_RULES = {
  name: { max: 80 },
  email: { max: 254 },
  message: { min: 10, max: 2000 },
  topics: { collab: "Collaboration", brand: "Brand partnership", other: "Something else" },
} as const;

export type ContactTopic = keyof typeof CONTACT_RULES.topics;
export type ContactInput = { name: string; email: string; topic: ContactTopic; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContact(input: ContactInput): ContactInput {
  const out = {
    name: cleanText(input.name).replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    topic: input.topic,
    message: cleanText(input.message),
  };
  const R = CONTACT_RULES;
  const fields: Record<string, string> = {};
  if (!out.name) fields.name = "Tell us your name.";
  else if (out.name.length > R.name.max) fields.name = `Keep it under ${R.name.max} characters.`;
  if (!EMAIL.test(out.email) || out.email.length > R.email.max) fields.email = "Enter a valid email so we can reply.";
  if (!(out.topic in R.topics)) fields.topic = "Pick a topic.";
  if (out.message.length < R.message.min) fields.message = "Add a little more detail.";
  else if (out.message.length > R.message.max) fields.message = `Keep it under ${R.message.max} characters.`;
  if (Object.keys(fields).length) throw new ConvexError({ code: "INVALID", fields });
  return out;
}
