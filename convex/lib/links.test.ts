import { describe, expect, test } from "vitest";
import { embedPreviewSrc, normalizeHttpsUrl, parseSocialUrl, parseVideoUrl } from "./links";

describe("normalizeHttpsUrl", () => {
  test.each([
    ["tiktok.com/@eri", "https://tiktok.com/@eri"],
    ["http://example.com/a", "https://example.com/a"],
    ["  https://example.com  ", "https://example.com/"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeHttpsUrl(input)?.href).toBe(out);
  });

  test.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "ftp://example.com/x",
    "mailto:a@b.co",
    "https://user:pass@example.com",
    "https://localhost/x",
    "not a url",
    "",
    `https://example.com/${"a".repeat(2100)}`,
  ])("rejects %s", (input) => {
    expect(normalizeHttpsUrl(input)).toBeNull();
  });
});

describe("parseVideoUrl", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "youtube", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["youtube.com/shorts/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/live/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
  ])("youtube %s", (input, platform, id) => {
    expect(parseVideoUrl(input)).toMatchObject({ ok: true, platform, youtubeId: id });
  });

  test.each([
    ["https://www.tiktok.com/@eri/video/7234567890123456789", "tiktok"],
    ["https://vm.tiktok.com/ZMabc123/", "tiktok"],
    ["https://www.instagram.com/reel/Cabc123/", "instagram"],
    ["https://fb.watch/abc123/", "facebook"],
    ["https://clips.twitch.tv/SomeClipSlug", "twitch"],
    ["https://x.com/eri/status/123", "x"],
    ["https://vimeo.com/123", "other"],
  ])("link-out %s is %s", (input, platform) => {
    const r = parseVideoUrl(input);
    expect(r).toMatchObject({ ok: true, platform });
    expect(r).not.toHaveProperty("youtubeId");
  });

  test("youtube channel page is allowed but has no thumbnail id", () => {
    expect(parseVideoUrl("https://www.youtube.com/@eri")).toMatchObject({ ok: true, platform: "youtube" });
  });

  test("rejects script URLs", () => {
    expect(parseVideoUrl("javascript:alert(1)").ok).toBe(false);
  });
});

describe("video embeds (autoplay previews)", () => {
  test.each([
    ["https://youtu.be/dQw4w9WgXcQ", { provider: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", { provider: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://www.tiktok.com/@eri/video/7234567890123456789?lang=en", { provider: "tiktok", id: "7234567890123456789" }],
    ["https://www.tiktok.com/embed/v2/7234567890123456789", { provider: "tiktok", id: "7234567890123456789" }],
    ["https://clips.twitch.tv/SomeClip-Slug_1", { provider: "twitch", id: "SomeClip-Slug_1" }],
    ["https://www.twitch.tv/eri/clip/SomeClipSlug", { provider: "twitch", id: "SomeClipSlug" }],
  ])("%s plays a preview", (input, embed) => {
    expect(parseVideoUrl(input)).toMatchObject({ ok: true, embed });
  });

  test.each([
    "https://vm.tiktok.com/ZMabc123/", // short link hides the id
    "https://www.tiktok.com/@eri", // profile, not a video
    "https://www.tiktok.com/@eri/video/notanid",
    "https://www.twitch.tv/eri", // live channel, not a clip
    "https://www.youtube.com/@eri",
    "https://www.instagram.com/reel/Cabc123/",
    "https://x.com/eri/status/123",
    "https://evil.example/@eri/video/7234567890123456789",
  ])("%s shows a cover only", (input) => {
    expect(parseVideoUrl(input)).toMatchObject({ ok: true, embed: null });
  });

  test("player URLs are muted and encode the twitch parent", () => {
    const yt = embedPreviewSrc({ provider: "youtube", id: "dQw4w9WgXcQ" }, "x");
    expect(yt.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?")).toBe(true);
    expect(yt).toContain("mute=1");
    expect(embedPreviewSrc({ provider: "twitch", id: "abc" }, "eri.vercel.app")).toContain("parent=eri.vercel.app&autoplay=true&muted=true");
  });
});

describe("parseSocialUrl", () => {
  test("builds URLs from @handles", () => {
    expect(parseSocialUrl("tiktok", "@eri.cos")).toEqual({ ok: true, url: "https://www.tiktok.com/@eri.cos" });
    expect(parseSocialUrl("instagram", "@eri.cos")).toEqual({ ok: true, url: "https://www.instagram.com/eri.cos" });
    expect(parseSocialUrl("twitch", "@eri_live")).toEqual({ ok: true, url: "https://www.twitch.tv/eri_live" });
  });

  test("accepts the platform's own domains, with or without scheme", () => {
    expect(parseSocialUrl("instagram", "instagram.com/eri")).toEqual({ ok: true, url: "https://instagram.com/eri" });
    expect(parseSocialUrl("x", "https://twitter.com/eri")).toMatchObject({ ok: true });
    expect(parseSocialUrl("facebook", "https://m.facebook.com/eri")).toMatchObject({ ok: true });
  });

  test("rejects links to the wrong platform and lookalike domains", () => {
    expect(parseSocialUrl("tiktok", "https://instagram.com/eri").ok).toBe(false);
    expect(parseSocialUrl("tiktok", "https://tiktok.com.evil.example/@eri").ok).toBe(false);
    expect(parseSocialUrl("tiktok", "https://nottiktok.com/@eri").ok).toBe(false);
  });

  test("website accepts any https host but still never script URLs", () => {
    expect(parseSocialUrl("website", "eri.example")).toEqual({ ok: true, url: "https://eri.example/" });
    expect(parseSocialUrl("website", "javascript:alert(1)").ok).toBe(false);
  });

  test("discord needs a full link; unknown platform rejected", () => {
    expect(parseSocialUrl("discord", "@eri").ok).toBe(false);
    expect(parseSocialUrl("myspace", "https://myspace.com/x").ok).toBe(false);
  });
});
