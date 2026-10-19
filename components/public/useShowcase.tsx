"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

/*
 * Shared mechanics for the showcase carousels (photos and videos), after
 * GSAP's showcase: the active card is centred, neighbours peek in at the
 * edges. Card width and gap come from CSS (`--w`, `--g` on `.showcase`, in
 * container units), so centring needs no measuring and no layout reads.
 *
 * Looping: with 2+ cards the slides render three times in a row and the
 * carousel starts on the middle copy. Moving past either end just keeps going
 * into the neighbouring copy; once the move has settled, the position jumps
 * (with transitions off for two frames) to the same card in the middle copy,
 * which looks identical, so it can loop forever without a visible rewind.
 *
 * Input: buttons, ←/→ keys anywhere inside, drag/swipe (6px to start, 12% of
 * the width or a flick to change; the click that ends a drag is swallowed so
 * it never opens a card).
 */

const DRAG_START = 6;
/** Matches the 650ms track transition in globals.css. */
const MOVE_MS = 650;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function useShowcase(count: number) {
  const loop = count > 1;
  const copies = loop ? 3 : 1;
  const [pos, setPos] = useState(loop ? count : 0);
  const [snapping, setSnapping] = useState(false);
  const [dragX, setDragX] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);

  const active = count > 0 ? mod(pos, count) : 0;
  const move = (next: number) => setPos(Math.max(0, Math.min(copies * count - 1, next)));
  const step = (delta: number) => move(pos + delta);
  /** Go to a card by its real index, the short way round. */
  const goTo = (index: number) => {
    let delta = index - active;
    if (loop && delta > count / 2) delta -= count;
    if (loop && delta < -count / 2) delta += count;
    move(pos + delta);
  };

  // Once a move settles outside the middle copy, jump back into it unseen.
  useEffect(() => {
    if (!loop || (pos >= count && pos < 2 * count)) return;
    const t = window.setTimeout(() => {
      setSnapping(true);
      setPos((p) => count + mod(p, count));
    }, MOVE_MS);
    return () => window.clearTimeout(t);
  }, [pos, count, loop]);

  // Transitions come back only after the jump has been painted.
  useEffect(() => {
    if (!snapping) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSnapping(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [snapping]);

  // Keyboard users keep their place: if focus was on a card that is no
  // longer the active one (after a key press or the loop jump), move it.
  useEffect(() => {
    const root = viewport.current;
    const focused = document.activeElement;
    if (!root || !focused || !root.contains(focused)) return;
    const slide = focused.closest<HTMLElement>(".showcase-slide");
    if (!slide || slide.dataset.active === "true") return;
    root.querySelector<HTMLElement>('.showcase-slide[data-active="true"] [tabindex="0"]')?.focus({
      preventScroll: true,
    });
  }, [pos]);

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
    // A single card has nowhere to go: resist.
    setDragX(loop ? dx : dx * 0.3);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const dx = e.clientX - d.x;
    const velocity = dx / Math.max(1, performance.now() - d.t);
    const width = viewport.current?.clientWidth ?? 400;
    if (dx < -width * 0.12 || velocity < -0.5) step(1);
    else if (dx > width * 0.12 || velocity > 0.5) step(-1);
    setDragX(0);
  }

  /** Every rendered slide: `index` is the real card, `pos` its place on the track. */
  const slides = Array.from({ length: copies * count }, (_, p) => ({ pos: p, index: p % count, copy: Math.floor(p / count) }));

  return {
    active,
    pos,
    count,
    slides,
    step,
    goTo,
    dragging: dragX !== 0,
    snapping,
    /** Spread on the carousel's outer region (keyboard). */
    regionProps: {
      role: "region",
      "aria-roledescription": "carousel",
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        step(e.key === "ArrowLeft" ? -1 : 1);
      },
    },
    /** Spread on the `.showcase` viewport (drag + click suppression). */
    viewportProps: {
      ref: viewport,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture: (e: MouseEvent) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
    trackStyle: {
      transform: `translateX(calc(50cqw - var(--w) / 2 - ${pos} * (var(--w) + var(--g)) + ${dragX}px))`,
    } as CSSProperties,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ← 02 / 05 → under a carousel. Hidden when there is only one card. */
export function ShowcaseControls({
  active,
  count,
  step,
  noun,
}: {
  active: number;
  count: number;
  step: (delta: number) => void;
  noun: string;
}) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-5">
      <button type="button" onClick={() => step(-1)} aria-label={`Previous ${noun}`} className="showcase-nav arcade-btn">
        <span aria-hidden>←</span>
      </button>
      <span className="font-pixel text-[var(--muted)]" aria-hidden>
        {pad(active + 1)} / {pad(count)}
      </span>
      <button type="button" onClick={() => step(1)} aria-label={`Next ${noun}`} className="showcase-nav arcade-btn">
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
