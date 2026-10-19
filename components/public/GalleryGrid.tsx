"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { PublicPhoto } from "@/lib/public-data";

function altText(photo: PublicPhoto, creator: string) {
  const subject = photo.caption || (photo.tag ? `${photo.tag} cosplay` : "Cosplay photo");
  return creator ? `${subject} by ${creator}` : subject;
}

export function GalleryGrid({ photos, creator }: { photos: PublicPhoto[]; creator: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const returnTo = useRef<number | null>(null);

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
      <ul className="mt-8 columns-2 gap-3 sm:gap-4 lg:columns-3">
        {photos.map((photo, i) => (
          <li key={photo.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open ${altText(photo, creator)}`}
              className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span className="block overflow-hidden bg-[var(--surface)]">
                <Image
                  src={photo.url}
                  alt={altText(photo, creator)}
                  width={photo.width}
                  height={photo.height}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 48vw"
                  className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                />
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

function Lightbox({
  photos,
  creator,
  index,
  onIndex,
  onClose,
}: {
  photos: PublicPhoto[];
  creator: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: (lastIndex: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<number | null>(null);
  const photo = photos[index];
  const many = photos.length > 1;
  const prev = useCallback(() => onIndex((index - 1 + photos.length) % photos.length), [index, onIndex, photos.length]);
  const next = useCallback(() => onIndex((index + 1) % photos.length), [index, onIndex, photos.length]);

  // Native modal dialog: focus trap, Esc to close, inert background.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevOverflow;
      if (el.open) el.close();
    };
  }, []);

  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, prev, next]);

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== "mouse") swipeStart.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent) {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
  }

  const navButton =
    "flex size-11 items-center justify-center border border-white/60 text-white hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <dialog
      ref={dialog}
      aria-label={altText(photo, creator)}
      onCancel={(e) => {
        e.preventDefault();
        onClose(index);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(index);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/90"
    >
      <div className="flex h-full flex-col" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <p className="tabular-nums text-white/70" aria-live="polite">
            {index + 1} / {photos.length}
          </p>
          <button type="button" onClick={() => onClose(index)} className={navButton} aria-label="Close" autoFocus>
            ✕
          </button>
        </div>

        <div className="relative min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && onClose(index)}>
          <Image
            key={photo.id}
            src={photo.url}
            alt={altText(photo, creator)}
            fill
            sizes="100vw"
            className="object-contain"
          />
        </div>

        <div className="flex items-center gap-4 px-4 py-4">
          {many && (
            <button type="button" onClick={prev} className={navButton} aria-label="Previous photo">
              ←
            </button>
          )}
          <div className="min-w-0 flex-1 text-center text-sm">
            {photo.tag && <p className="text-[0.7rem] uppercase tracking-[0.2em] text-white/60">{photo.tag}</p>}
            {photo.caption && <p className="mt-1">{photo.caption}</p>}
          </div>
          {many && (
            <button type="button" onClick={next} className={navButton} aria-label="Next photo">
              →
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
