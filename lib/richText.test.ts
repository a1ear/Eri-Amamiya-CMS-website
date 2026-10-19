import { describe, expect, test } from "vitest";
import { parseLine, parseRichText } from "./richText";

describe("parseRichText", () => {
  test("splits paragraphs on blank lines and keeps single line breaks", () => {
    const out = parseRichText("one\ntwo\n\n\nthree");
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(2);
    expect(out[1][0]).toEqual([{ type: "text", text: "three" }]);
  });

  test("bold", () => {
    expect(parseLine("I cosplay **Frieren** mostly")).toEqual([
      { type: "text", text: "I cosplay " },
      { type: "bold", text: "Frieren" },
      { type: "text", text: " mostly" },
    ]);
  });

  test("links http(s) and leaves trailing punctuation outside", () => {
    expect(parseLine("See https://example.com/a?b=1.")).toEqual([
      { type: "text", text: "See " },
      { type: "link", href: "https://example.com/a?b=1", text: "https://example.com/a?b=1" },
      { type: "text", text: "." },
    ]);
  });

  test("never links javascript: or data: URLs", () => {
    for (const evil of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      expect(parseLine(evil).every((t) => t.type === "text")).toBe(true);
    }
  });

  test("HTML stays inert text", () => {
    expect(parseLine("<img src=x onerror=alert(1)>")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)>" },
    ]);
  });

  test("unclosed bold is plain text", () => {
    expect(parseLine("**oops")).toEqual([{ type: "text", text: "**oops" }]);
  });
});
