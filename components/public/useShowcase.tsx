"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

/*
 * Shared mechanics for the showcase carousels (photos and videos), after
 * GSAP's showcase: the active card is centred, neighbours peek in at the
 * edges. Card width and gap come from CSS (`--w`, `--g` on `.showcase`, in
 * container units), so centring needs no measuring and no layout reads.
 *
 * Input: buttons, ←/→ keys anywhere inside, drag/swipe (6px to start, 12% of
 * the width or a flick to change, rubber-band at the ends; the click that
 * ends a drag is swallowed so it never opens a card).
 */

const DRAG_START = 6;

export function useShowcase(count: number) {
  const [active, setActive] = useState(0);
  const [dragX, setDragX] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);

  const last = count - 1;
  const go = (i: number) => setActive(Math.max(0, Math.min(last, i)));

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

  return {
    active,
    last,
    go,
    dragging: dragX !== 0,
    /** Spread on the carousel's outer region (keyboard). */
    regionProps: {
      role: "region",
      "aria-roledescription": "carousel",
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        go(active + (e.key === "ArrowLeft" ? -1 : 1));
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
      transform: `translateX(calc(50cqw - var(--w) / 2 - ${active} * (var(--w) + var(--g)) + ${dragX}px))`,
    } as CSSProperties,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ← 02 / 05 → under a carousel. Hidden when there is only one card. */
export function ShowcaseControls({
  active,
  count,
  go,
  noun,
}: {
  active: number;
  count: number;
  go: (i: number) => void;
  noun: string;
}) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => go(active - 1)}
        disabled={active === 0}
        aria-label={`Previous ${noun}`}
        className="showcase-nav arcade-btn"
      >
        <span aria-hidden>←</span>
      </button>
      <span className="font-pixel text-[var(--muted)]" aria-hidden>
        {pad(active + 1)} / {pad(count)}
      </span>
      <button
        type="button"
        onClick={() => go(active + 1)}
        disabled={active === count - 1}
        aria-label={`Next ${noun}`}
        className="showcase-nav arcade-btn"
      >
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
