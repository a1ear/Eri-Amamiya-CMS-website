"use client";

import { useSyncExternalStore } from "react";

/*
 * "FX: ON/OFF" switch for the decorative motion (moving grid, starfields,
 * parallax, ticker, blinking). WCAG 2.2.2 needs a way to stop motion that
 * runs longer than 5 seconds, including for visitors who haven't set
 * "reduce motion" on their device. Remembered per device in localStorage;
 * `data-fx="off"` on <html> switches it off in CSS, and the `fx-change`
 * event tells the GSAP scroll effects to stand down too.
 */

const KEY = "arcade-fx";
const EVENT = "fx-change";

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function apply(on: boolean) {
  document.documentElement.dataset.fx = on ? "on" : "off";
}

// Apply the saved preference as soon as this module runs in the browser.
if (typeof window !== "undefined") apply(readStored());

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
const getSnapshot = () => document.documentElement.dataset.fx !== "off";
const getServerSnapshot = () => true;

export function fxEnabled() {
  return typeof document === "undefined" || document.documentElement.dataset.fx !== "off";
}
export const FX_EVENT = EVENT;

/** Live FX on/off for client components (true during SSR). */
export function useFxEnabled() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function FxToggle() {
  const on = useFxEnabled();

  function toggle() {
    const next = !on;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // Private mode: works for this visit only.
    }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Turn background animations off" : "Turn background animations on"}
      className="arcade-fx-toggle press inline-flex min-h-11 shrink-0 items-center gap-2 px-1 font-pixel text-[0.6rem] uppercase focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <span className="text-[var(--muted)]">FX</span>
      <span className={on ? "" : "text-[var(--muted)]"}>{on ? "ON" : "OFF"}</span>
      <span className="sr-only">: background animations {on ? "on" : "off"}</span>
    </button>
  );
}
