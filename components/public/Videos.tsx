import Image from "next/image";
import { getPublicVideos } from "@/lib/public-data";

/**
 * Featured videos as link-out cards: no embedded players, so no third-party
 * scripts or cookies on the page until a visitor chooses to leave.
 */
export async function Videos() {
  const videos = await getPublicVideos();
  if (videos.length === 0) return null;

  return (
    <section id="videos" aria-labelledby="videos-heading" className="scroll-mt-16 border-t border-[var(--foreground)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <h2 id="videos-heading" className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
          Featured videos
        </h2>
        <ul className="mt-8 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <span className="relative block aspect-video overflow-hidden border border-[var(--foreground)] bg-[var(--surface)]">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 370px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-[clamp(1.75rem,5vw,2.5rem)] font-semibold tracking-tight"
                    >
                      {video.platformLabel}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="absolute bottom-3 left-3 flex size-11 items-center justify-center bg-[var(--foreground)] text-[var(--background)]"
                  >
                    ▶
                  </span>
                </span>
                <span className="mt-3 block font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                  {video.title}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Watch on {video.platformLabel} <span aria-hidden>↗</span>
                  <span className="sr-only"> (opens in new tab)</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
