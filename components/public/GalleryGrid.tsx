"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPhoto } from "@/lib/public-data";
import { photoAlt } from "./photoAlt";

// The lightbox (and Motion with it) is only downloaded when it's about to be
// used: prefetched the moment a pointer or finger reaches the gallery.
const loadLightbox = () => import("./Lightbox");
const Lightbox = dynamic(loadLightbox, {
  ssr: false,
  loading: () => <div aria-hidden className="fixed inset-0 z-50 bg-black/90" />,
});

export function GalleryGrid({ photos, creator }: { photos: PublicPhoto[]; creator: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const returnTo = useRef<number | null>(null);
  const prefetched = useRef(false);
  const prefetch = () => {
    if (!prefetched.current) {
      prefetched.current = true;
      void loadLightbox();
    }
  };

  // Focus can only move back once the modal is gone (the page is inert while
  // it is open), so restore it after unmount, onto the last photo viewed.
  const close = useCallback((lastIndex: number) => {
    returnTo.current = lastIndex;
    setOpen(null);
  }, []);
  useEffect(() => {
    if (open === null && returnTo.current !== null) {
      triggers.current[returnTo.current]?.focus();
      returnTo.current = null;
    }
  }, [open]);

  return (
    <>
      <ul
        className="mt-8 columns-2 gap-3 sm:gap-4 lg:columns-3"
        onPointerEnter={prefetch}
        onTouchStart={prefetch}
        onFocus={prefetch}
      >
        {photos.map((photo, i) => (
          <li key={photo.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open ${photoAlt(photo, creator)}`}
              className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span className="relative block overflow-hidden bg-[var(--surface)]">
                <Image
                  src={photo.url}
                  alt={photoAlt(photo, creator)}
                  width={photo.width}
                  height={photo.height}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 48vw"
                  className="h-auto w-full transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:transition-none"
                />
                {/* Hover wash + "view" cue. Tailwind's hover variant only applies on hover-capable pointers. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/45 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 ease-[var(--ease-out)] group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <span className="border border-white/70 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white">
                    View
                  </span>
                </span>
              </span>
              {(photo.tag || photo.caption) && (
                <span className="mt-2 block text-sm leading-snug">
                  {photo.tag && (
                    <span className="block text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
                      {photo.tag}
                    </span>
                  )}
                  {photo.caption && <span className="block">{photo.caption}</span>}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <Lightbox photos={photos} creator={creator} index={open} onIndex={setOpen} onClose={close} />
      )}
    </>
  );
}
