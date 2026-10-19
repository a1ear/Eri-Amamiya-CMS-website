/**
 * Tiny, safe formatter for owner-written text (About section).
 *
 * Supports: blank line = new paragraph, single newline = line break,
 * **bold**, and bare http(s) URLs as links. Output is plain tokens that are
 * rendered as React elements, so no HTML from the text is ever interpreted.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; href: string; text: string };

export type Paragraph = Inline[][]; // lines of inline tokens

const BOLD = /\*\*([^*\n]+?)\*\*/g;
// Stop before trailing punctuation so "see https://x.com." links x.com.
const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function linkify(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const href = safeHref(match[0]);
    if (!href) continue;
    if (match.index > last) out.push({ type: "text", text: text.slice(last, match.index) });
    out.push({ type: "link", href, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseLine(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(BOLD)) {
    if (match.index > last) out.push(...linkify(line.slice(last, match.index)));
    out.push({ type: "bold", text: match[1] });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(...linkify(line.slice(last)));
  return out;
}

export function parseRichText(source: string): Paragraph[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("\n").map(parseLine));
}
