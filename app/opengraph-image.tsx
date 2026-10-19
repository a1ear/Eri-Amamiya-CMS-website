import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";

export const alt = "Cosplayer and streamer profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Loads the avatar ourselves and inlines it, rather than letting the image
 * renderer fetch it: works on every host, and a failed fetch just drops the
 * photo instead of failing the whole card.
 */
async function avatarDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Share card built from the live profile, so it follows name/photo edits. */
export default async function OpengraphImage() {
  await connection();
  const profile = await fetchQuery(api.profile.getPublic).catch(() => null);
  const name = profile?.displayName ?? "Cosplay & Streaming";
  const avatar = await avatarDataUrl(profile?.avatarUrl);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0a", color: "#f5f5f5" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "72px" }}>
          {profile?.tagline && (
            <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#a3a3a3" }}>
              {profile.tagline}
            </div>
          )}
          <div style={{ fontSize: name.length > 18 ? 88 : 120, fontWeight: 700, letterSpacing: -4, lineHeight: 0.95, marginTop: 24 }}>
            {name}
          </div>
        </div>
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser
          <img src={avatar} alt="" width={420} height={630} style={{ objectFit: "cover", borderLeft: "2px solid #f5f5f5" }} />
        )}
      </div>
    ),
    size,
  );
}
