"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPhoto } from "@/lib/public-data";
import { photoAlt } from "./photoAlt";

const EASE_OUT = [0.23, 1, 0.32, 1] as const; // --ease-out
const OPEN = { duration: 0.25, ease: EASE_OUT };
const SLIDE = { duration: 0.3, ease: EASE_OUT };
// Drag settles on a spring so an interrupted gesture keeps its velocity.
const SNAP = { type: "spring", duration: 0.5, bounce: 0.2 } as const;

const SWIPE_DISTANCE = 80; // px
const SWIPE_VELOCITY = 500; // px/s, a flick counts even if short
const DISMISS_DISTANCE = 120;
const MIN_FLICK_DISTANCE = 24;

export default function Lightbox({
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
  const reduce = useReducedMotion();
  const [direction, setDirection] = useState(0);
  const [closing, setClosing] = useState(false);
  const photo = photos[index];
  const many = photos.length > 1;

  const go = useCallback(
    (delta: 1 | -1) => {
      setDirection(delta);
      onIndex((index + delta + photos.length) % photos.length);
    },
    [index, onIndex, photos.length],
  );
  // Close plays the entrance in reverse, then unmounts.
  const requestClose = useCallback(() => setClosing(true), []);

  // Native modal dialog: focus trap, Esc, inert page behind it.
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
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, go]);

  function onDragEnd(_: unknown, { offset, velocity }: PanInfo) {
    const vertical = Math.abs(offset.y) > Math.abs(offset.x);
    if (vertical) {
      const flickDown = Math.abs(offset.y) >= MIN_FLICK_DISTANCE && Math.abs(velocity.y) > SWIPE_VELOCITY;
      if (Math.abs(offset.y) > DISMISS_DISTANCE || flickDown) requestClose();
      return;
    }
    if (!many) return;
    // A flick counts even if short, but never a tap's few pixels of jitter.
    const flick = Math.abs(offset.x) >= MIN_FLICK_DISTANCE;
    if (offset.x < -SWIPE_DISTANCE || (flick && velocity.x < -SWIPE_VELOCITY)) go(1);
    else if (offset.x > SWIPE_DISTANCE || (flick && velocity.x > SWIPE_VELOCITY)) go(-1);
  }

  const shift = reduce ? 0 : 12; // % of the stage width
  const slide = {
    enter: (d: number) => ({ opacity: 0, transform: `translateX(${d * shift}%)` }),
    center: { opacity: 1, transform: "translateX(0%)" },
    exit: (d: number) => ({ opacity: 0, transform: `translateX(${-d * shift}%)` }),
  };

  const navButton =
    "press flex size-11 items-center justify-center border border-white/50 text-white transition-colors duration-150 hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <motion.dialog
      ref={dialog}
      aria-label={photoAlt(photo, creator)}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={OPEN}
      onAnimationComplete={() => closing && onClose(index)}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#050505] p-0 text-white backdrop:bg-transparent"
    >
      <motion.div
        className="flex h-full flex-col"
        initial={{ transform: reduce ? "scale(1)" : "scale(0.96)" }}
        animate={{ transform: closing && !reduce ? "scale(0.96)" : "scale(1)" }}
        transition={OPEN}
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <p className="tabular-nums text-white/70" aria-live="polite">
            {index + 1} / {photos.length}
          </p>
          <button type="button" onClick={requestClose} className={navButton} aria-label="Close" autoFocus>
            ✕
          </button>
        </div>

        {/* No click-to-close on the photo area: the mouse-up after a drag
            would register as a click and close it. Close with ✕, Esc or a
            downward swipe. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={photo.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SLIDE}
              className="absolute inset-0"
            >
              {/* Separate layer for the drag so gesture offsets never fight the slide transform. */}
              <motion.div
                className="absolute inset-0 touch-none"
                drag={many ? true : "y"}
                dragDirectionLock
                dragSnapToOrigin
                dragElastic={0.25}
                transition={SNAP}
                onDragEnd={onDragEnd}
              >
                <Image
                  src={photo.url}
                  alt={photoAlt(photo, creator)}
                  fill
                  sizes="100vw"
                  draggable={false}
                  className="pointer-events-none select-none object-contain"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4 px-4 py-4">
          {many && (
            <button type="button" onClick={() => go(-1)} className={navButton} aria-label="Previous photo">
              ←
            </button>
          )}
          <div className="min-w-0 flex-1 text-center text-sm">
            {photo.tag && <p className="text-[0.7rem] uppercase tracking-[0.2em] text-white/60">{photo.tag}</p>}
            {photo.caption && <p className="mt-1">{photo.caption}</p>}
            {many && <p className="mt-1 text-xs text-white/40 sm:hidden">Swipe to browse · swipe down to close</p>}
          </div>
          {many && (
            <button type="button" onClick={() => go(1)} className={navButton} aria-label="Next photo">
              →
            </button>
          )}
        </div>
      </motion.div>
    </motion.dialog>
  );
}
