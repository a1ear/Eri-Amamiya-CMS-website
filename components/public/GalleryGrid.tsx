"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPhoto } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { photoAlt } from "./photoAlt";
import { ShowcaseControls, useShowcase } from "./useShowcase";

// The lightbox (and Motion with it) is only downloaded when it's about to be
// used: prefetched the moment a pointer or finger reaches the gallery.
const loadLightbox = () => import("./Lightbox");
const Lightbox = dynamic(loadLightbox, {
  ssr: false,
  loading: () => <div aria-hidden className="fixed inset-0 z-50 bg-black/90" />,
});

/**
 * Cosplay photos as a showcase carousel (same mechanics as the videos): the
 * active photo is centred in a 4:5 frame, neighbours peek in at the edges.
 * Tapping the active photo (or "View full photo") opens the lightbox at its
 * natural aspect ratio; tapping a neighbour brings it to the centre.
 */
export function GalleryGrid({ photos, creator }: { photos: PublicPhoto[]; creator: string }) {
  const { active, pos, slides, step, goTo, dragging, snapping, regionProps, viewportProps, trackStyle } = useShowcase(photos.length);
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const returnFocus = useRef(false);
  const prefetched = useRef(false);
  const prefetch = () => {
    if (!prefetched.current) {
      prefetched.current = true;
      void loadLightbox();
    }
  };

  // Focus can only move back once the modal is gone (the page is inert while
  // it is open), so restore it after unmount, onto the last photo viewed,
  // which the carousel has moved to the centre.
  const close = useCallback(
    (lastIndex: number) => {
      returnFocus.current = true;
      goTo(lastIndex);
      setOpen(null);
    },
    [goTo],
  );
  useEffect(() => {
    if (open === null && returnFocus.current) {
      triggers.current[pos]?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [open, pos]);

  const current = photos[active];
  if (!current) return null;

  return (
    <>
      <div {...regionProps} aria-label="Cosplay gallery" onPointerEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch}>
        <div
          {...viewportProps}
          className={cn(
            "showcase showcase-photos relative w-full touch-pan-y select-none overflow-hidden py-2",
            snapping && "is-snapping",
          )}
        >
          <ul className={cn("showcase-track flex w-max gap-[var(--g)]", !dragging && "is-animating")} style={trackStyle}>
            {slides.map((slide) => {
              const photo = photos[slide.index];
              const isActive = slide.pos === pos;
              return (
                <li
                  key={`${slide.copy}-${photo.id}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${slide.index + 1} of ${photos.length}`}
                  aria-hidden={!isActive}
                  data-active={isActive}
                  className={cn("showcase-slide w-[var(--w)] shrink-0", slide.pos < pos ? "origin-right" : "origin-left")}
                >
                  <button
                    ref={(el) => {
                      triggers.current[slide.pos] = el;
                    }}
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => (isActive ? setOpen(slide.index) : step(slide.pos - pos))}
                    aria-label={`Open ${photoAlt(photo, creator)}`}
                    className="group pixel-corners relative block aspect-[4/5] w-full overflow-hidden border border-[var(--line-strong)] bg-[var(--surface)] focus-visible:outline-2 focus-visible:-outline-offset-4"
                  >
                    <Image
                      src={photo.url}
                      alt={photoAlt(photo, creator)}
                      fill
                      draggable={false}
                      sizes="(min-width: 640px) 26rem, 64vw"
                      className="object-cover"
                    />
                    {/* "View" cue on the active photo. Tailwind's hover variant only applies on hover-capable pointers. */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/45 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 ease-[var(--ease-out)] group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        <span className="border border-white/70 bg-black/40 px-2 py-1 font-pixel text-[0.55rem] uppercase text-white">
                          View
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-4 px-4 text-center">
          <div aria-live="polite" className="min-h-8">
            {current.tag && <p className="font-pixel uppercase text-[var(--muted)]">{current.tag}</p>}
            {current.caption && <p className="arcade-display mt-3 max-w-3xl text-balance">{current.caption}</p>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(active)}
            className="inline-flex min-h-11 items-center font-pixel uppercase underline-offset-8 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {"{"} View full photo {"}"}
          </button>
          <ShowcaseControls active={active} count={photos.length} step={step} noun="photo" />
        </div>
      </div>

      {/* Outside the carousel region, so the lightbox's arrow keys don't also move the carousel. */}
      {open !== null && (
        <Lightbox photos={photos} creator={creator} index={open} onIndex={setOpen} onClose={close} />
      )}
    </>
  );
}
