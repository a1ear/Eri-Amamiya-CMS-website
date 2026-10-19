import { getPublicVideos } from "@/lib/public-data";
import { VideoShowcase } from "./VideoShowcase";

/**
 * Featured videos as a showreel carousel. Links stay link-outs; the active
 * card plays a silent preview from the platform's own player (see
 * VideoShowcase for when it does and doesn't load).
 */
export async function Videos() {
  const videos = await getPublicVideos();
  if (videos.length === 0) return null;

  return (
    <section id="videos" aria-labelledby="videos-heading" className="scroll-mt-16 border-t border-[var(--line)] py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <h2 id="videos-heading" className="section-label text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
          Featured videos
        </h2>
      </div>
      <div className="mt-10">
        <VideoShowcase videos={videos} />
      </div>
    </section>
  );
}
