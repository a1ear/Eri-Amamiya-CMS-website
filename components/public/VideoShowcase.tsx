"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { embedPreviewSrc } from "@/convex/lib/links";
import type { PublicVideo } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { useFxEnabled } from "./FxToggle";
import { ShowcaseControls, useShowcase } from "./useShowcase";

/*
 * Showreel carousel, after GSAP's showcase: the active video sits centred and
 * large, its neighbours peek in at the edges, and the active one plays a
 * silent looping preview. The preview is a player iframe built from the link
 * (no uploads). It only mounts for the active card, once the carousel is on
 * screen and has settled, and never with FX off, reduced motion or Save-Data.
 * Clicking the card still opens the video on its own platform. Carousel
 * mechanics are shared with the photo gallery (useShowcase).
 */

const SETTLE_MS = 700;

function subscribeMedia(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function saveData() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return Boolean(nav.connection?.saveData);
}

export function VideoShowcase({ videos }: { videos: PublicVideo[] }) {
  const { active, go, dragging, regionProps, viewportProps, trackStyle } = useShowcase(videos.length);
  const [inView, setInView] = useState(false);
  const [settledOn, setSettledOn] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const fx = useFxEnabled();
  const reduce = useSyncExternalStore(subscribeMedia, prefersReduced, () => false);

  // Play only while at least half the carousel is on screen.
  useEffect(() => {
    const el = viewportProps.ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [viewportProps.ref]);

  // Wait for the slide to finish moving before loading a player.
  useEffect(() => {
    const t = window.setTimeout(() => setSettledOn(active), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  const current = videos[active];
  const canPreview = Boolean(current?.embed) && inView && settledOn === active && fx && !reduce && !saveData();
  const previewSrc =
    canPreview && current.embed ? embedPreviewSrc(current.embed, window.location.hostname) : null;

  if (!current) return null;

  return (
    <div {...regionProps} aria-label="Featured videos">
      <div
        {...viewportProps}
        className="showcase relative w-full touch-pan-y select-none overflow-hidden py-2"
      >
        <ul
          className={cn(
            "showcase-track flex w-max gap-[var(--g)]",
            !dragging && "is-animating",
          )}
          style={trackStyle}
        >
          {videos.map((video, i) => {
            const isActive = i === active;
            return (
              <li
                key={video.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${videos.length}: ${video.title}`}
                aria-hidden={!isActive}
                data-active={isActive}
                className={cn("showcase-slide w-[var(--w)] shrink-0", i < active ? "origin-right" : "origin-left")}
              >
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={isActive ? 0 : -1}
                  draggable={false}
                  onClick={(e) => {
                    if (!isActive) {
                      e.preventDefault();
                      go(i);
                    }
                  }}
                  className="pixel-corners relative block aspect-video overflow-hidden border border-[var(--line-strong)] bg-[#050505] focus-visible:outline-2 focus-visible:-outline-offset-4"
                >
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      draggable={false}
                      sizes="(min-width: 1024px) 56rem, 78vw"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center font-pixel text-[clamp(0.8rem,2.4vw,1.4rem)] uppercase text-[var(--muted)]"
                    >
                      {video.platformLabel}
                    </span>
                  )}
                  {isActive && previewSrc && (
                    <iframe
                      key={previewSrc}
                      src={previewSrc}
                      title={`Silent preview of ${video.title}`}
                      aria-hidden
                      tabIndex={-1}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      onLoad={() => setLoaded(previewSrc)}
                      className={cn(
                        "showcase-preview pointer-events-none absolute border-0",
                        video.embed?.provider === "tiktok"
                          ? "inset-y-0 left-1/2 aspect-[9/16] h-full -translate-x-1/2"
                          : "inset-0 size-full",
                        loaded === previewSrc && "is-loaded",
                      )}
                    />
                  )}
                  <span
                    aria-hidden
                    className="absolute bottom-3 left-3 flex size-10 items-center justify-center bg-[var(--foreground)] font-pixel text-[0.6rem] text-[var(--background)]"
                  >
                    ▶
                  </span>
                  <span className="sr-only">
                    Watch {video.title} on {video.platformLabel} (opens in new tab)
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-5 px-4 text-center">
        <p aria-live="polite" className="arcade-display max-w-3xl text-balance">
          {current.title}
        </p>
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-pixel uppercase underline-offset-8 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {"{"} Watch on {current.platformLabel} <span aria-hidden className="ml-2">↗</span> {"}"}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
        <ShowcaseControls active={active} count={videos.length} go={go} noun="video" />
      </div>
    </div>
  );
}
