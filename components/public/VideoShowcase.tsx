"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { embedPreviewSrc } from "@/convex/lib/links";
import type { PublicVideo } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { useFxEnabled } from "./FxToggle";

/*
 * Showreel carousel, after GSAP's showcase: the active video sits centred and
 * large, its neighbours peek in at the edges, and the active one plays a
 * silent looping preview. The preview is a player iframe built from the link
 * (no uploads). It only mounts for the active card, once the carousel is on
 * screen and has settled, and never with FX off, reduced motion or Save-Data.
 * Clicking the card still opens the video on its own platform.
 */

const SETTLE_MS = 700;
const DRAG_START = 6;

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

const pad = (n: number) => String(n).padStart(2, "0");

export function VideoShowcase({ videos }: { videos: PublicVideo[] }) {
  const [active, setActive] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [inView, setInView] = useState(false);
  const [settledOn, setSettledOn] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const fx = useFxEnabled();
  const reduce = useSyncExternalStore(subscribeMedia, prefersReduced, () => false);

  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);

  const last = videos.length - 1;
  const go = (i: number) => setActive(Math.max(0, Math.min(last, i)));

  // Play only while at least half the carousel is on screen.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Wait for the slide to finish moving before loading a player.
  useEffect(() => {
    const t = window.setTimeout(() => setSettledOn(active), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  const current = videos[active];
  const canPreview = Boolean(current?.embed) && inView && settledOn === active && fx && !reduce && !saveData();
  const previewSrc =
    canPreview && current.embed ? embedPreviewSrc(current.embed, window.location.hostname) : null;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, t: performance.now(), moved: false, id: e.pointerId };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_START) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Resist past the first and last card.
    const edge = (active === 0 && dx > 0) || (active === last && dx < 0);
    setDragX(edge ? dx * 0.3 : dx);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const dx = e.clientX - d.x;
    const velocity = dx / Math.max(1, performance.now() - d.t);
    const width = viewport.current?.clientWidth ?? 400;
    if (dx < -width * 0.12 || velocity < -0.5) go(active + 1);
    else if (dx > width * 0.12 || velocity > 0.5) go(active - 1);
    setDragX(0);
  }

  if (!current) return null;

  const trackStyle = {
    transform: `translateX(calc(50cqw - var(--w) / 2 - ${active} * (var(--w) + var(--g)) + ${dragX}px))`,
  } as CSSProperties;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured videos"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        go(active + (e.key === "ArrowLeft" ? -1 : 1));
      }}
    >
      <div
        ref={viewport}
        className="showcase relative w-full touch-pan-y select-none overflow-hidden py-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <ul
          className={cn(
            "showcase-track flex w-max gap-[var(--g)]",
            dragX === 0 && "is-animating",
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
        {videos.length > 1 && (
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => go(active - 1)}
              disabled={active === 0}
              aria-label="Previous video"
              className="showcase-nav arcade-btn"
            >
              <span aria-hidden>←</span>
            </button>
            <span className="font-pixel text-[var(--muted)]" aria-hidden>
              {pad(active + 1)} / {pad(videos.length)}
            </span>
            <button
              type="button"
              onClick={() => go(active + 1)}
              disabled={active === last}
              aria-label="Next video"
              className="showcase-nav arcade-btn"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
