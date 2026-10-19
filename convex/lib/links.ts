/**
 * Link parsing for featured videos and social links. Pure functions, used by
 * the server as the authority and by the admin forms for instant hints.
 *
 * Every stored link is https, has no embedded credentials, and (for socials)
 * lives on the platform's own domain. `javascript:`, `data:` and friends can
 * never get through because only http(s) parses, and http is upgraded.
 */

export const MAX_URL_LENGTH = 2048;

export function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Accepts "tiktok.com/@x", "http://…", "https://…". Returns null if unusable. */
export function normalizeHttpsUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  // "localhost:3000" or "mailto:x" style inputs have a scheme we don't allow.
  const candidate = hasScheme ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  return url;
}

/* ------------------------------------------------------------------ videos */

export const VIDEO_PLATFORMS: Record<string, { label: string; domains: string[] }> = {
  youtube: { label: "YouTube", domains: ["youtube.com", "youtu.be"] },
  tiktok: { label: "TikTok", domains: ["tiktok.com"] },
  instagram: { label: "Instagram", domains: ["instagram.com"] },
  facebook: { label: "Facebook", domains: ["facebook.com", "fb.watch", "fb.com"] },
  twitch: { label: "Twitch", domains: ["twitch.tv"] },
  kick: { label: "Kick", domains: ["kick.com"] },
  x: { label: "X", domains: ["x.com", "twitter.com"] },
};

export function detectVideoPlatform(host: string): string {
  for (const [key, { domains }] of Object.entries(VIDEO_PLATFORMS)) {
    if (domains.some((d) => hostMatches(host, d))) return key;
  }
  return "other";
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname;
  let id: string | null = null;
  if (hostMatches(host, "youtu.be")) id = url.pathname.split("/")[1] ?? null;
  else if (hostMatches(host, "youtube.com")) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(first ?? "")) id = second ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

/** A link the site can play as a silent autoplay preview. */
export type VideoEmbed = { provider: "youtube" | "tiktok" | "twitch"; id: string };

const TIKTOK_ID = /^\d{8,25}$/;
const TWITCH_SLUG = /^[A-Za-z0-9_-]{3,120}$/;

/**
 * The embeddable id for platforms whose players allow muted autoplay.
 * Instagram, Facebook and X don't, and TikTok's short vm./vt. links hide
 * the id behind a redirect, so those return null (the card shows a cover).
 */
export function videoEmbedFrom(url: URL): VideoEmbed | null {
  const host = url.hostname;
  const parts = url.pathname.split("/").filter(Boolean);
  const youtube = hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be") ? youtubeIdFrom(url) : null;
  if (youtube) return { provider: "youtube", id: youtube };

  if (hostMatches(host, "tiktok.com") && !/^(vm|vt)\./.test(host)) {
    // /@user/video/{id}, /embed/v2/{id}, /player/v1/{id}
    const id = parts[1] === "video" ? parts[2] : parts[0] === "embed" || parts[0] === "player" ? parts[2] : undefined;
    if (id && TIKTOK_ID.test(id)) return { provider: "tiktok", id };
  }

  if (hostMatches(host, "twitch.tv")) {
    // clips.twitch.tv/{slug} or twitch.tv/{channel}/clip/{slug}
    const slug = host.startsWith("clips.") ? parts[0] : parts[1] === "clip" ? parts[2] : undefined;
    if (slug && slug !== "embed" && TWITCH_SLUG.test(slug)) return { provider: "twitch", id: slug };
  }
  return null;
}

export type ParsedVideo =
  | { ok: true; url: string; platform: string; youtubeId?: string; embed: VideoEmbed | null }
  | { ok: false; error: string };

export function parseVideoUrl(raw: string): ParsedVideo {
  const url = normalizeHttpsUrl(raw);
  if (!url) return { ok: false, error: "Paste the full link to the video, starting with https://" };
  const platform = detectVideoPlatform(url.hostname);
  const youtubeId = platform === "youtube" ? youtubeIdFrom(url) : null;
  if (platform === "youtube" && !youtubeId && !hostMatches(url.hostname, "youtube.com"))
    return { ok: false, error: "That YouTube link doesn't point to a video." };
  return { ok: true, url: url.href, platform, ...(youtubeId ? { youtubeId } : {}), embed: videoEmbedFrom(url) };
}

/** Player URL for a muted, looping, control-free preview. */
export function embedPreviewSrc(embed: VideoEmbed, parentHost: string): string {
  switch (embed.provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${embed.id}?autoplay=1&mute=1&loop=1&playlist=${embed.id}&controls=0&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&modestbranding=1`;
    case "tiktok":
      return `https://www.tiktok.com/player/v1/${embed.id}?autoplay=1&loop=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;
    case "twitch":
      return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(embed.id)}&parent=${encodeURIComponent(parentHost)}&autoplay=true&muted=true&controls=false`;
  }
}

/* ----------------------------------------------------------------- socials */

type SocialPlatform = {
  label: string;
  /** Allowed hosts; empty means any host (personal website). */
  domains: string[];
  /** Builds a profile URL from "@handle". */
  handle?: (h: string) => string;
};

export const SOCIAL_PLATFORMS: Record<string, SocialPlatform> = {
  tiktok: { label: "TikTok", domains: ["tiktok.com"], handle: (h) => `https://www.tiktok.com/@${h}` },
  instagram: { label: "Instagram", domains: ["instagram.com"], handle: (h) => `https://www.instagram.com/${h}` },
  youtube: { label: "YouTube", domains: ["youtube.com", "youtu.be"], handle: (h) => `https://www.youtube.com/@${h}` },
  twitch: { label: "Twitch", domains: ["twitch.tv"], handle: (h) => `https://www.twitch.tv/${h}` },
  facebook: { label: "Facebook", domains: ["facebook.com", "fb.com", "fb.me"], handle: (h) => `https://www.facebook.com/${h}` },
  kick: { label: "Kick", domains: ["kick.com"], handle: (h) => `https://kick.com/${h}` },
  x: { label: "X", domains: ["x.com", "twitter.com"], handle: (h) => `https://x.com/${h}` },
  threads: { label: "Threads", domains: ["threads.net", "threads.com"], handle: (h) => `https://www.threads.net/@${h}` },
  discord: { label: "Discord", domains: ["discord.gg", "discord.com"] },
  website: { label: "Website", domains: [] },
};

/** Platforms whose link makes a good "watch live" call to action, in priority order. */
export const LIVE_PLATFORMS = ["twitch", "kick", "youtube", "tiktok"] as const;

const HANDLE = /^@[A-Za-z0-9._-]{1,60}$/;

export type ParsedSocial = { ok: true; url: string } | { ok: false; error: string };

export function parseSocialUrl(platform: string, raw: string): ParsedSocial {
  const spec = SOCIAL_PLATFORMS[platform];
  if (!spec) return { ok: false, error: "Pick a platform from the list." };

  const input = raw.trim();
  if (HANDLE.test(input)) {
    if (!spec.handle) return { ok: false, error: `Paste the full ${spec.label} link instead of a handle.` };
    return { ok: true, url: spec.handle(input.slice(1)) };
  }

  const url = normalizeHttpsUrl(input);
  if (!url) return { ok: false, error: "Enter a link starting with https://, or an @handle." };
  if (spec.domains.length > 0 && !spec.domains.some((d) => hostMatches(url.hostname, d))) {
    return { ok: false, error: `That isn't a ${spec.label} link (${spec.domains[0]}).` };
  }
  return { ok: true, url: url.href };
}
