"use client";

import dynamic from "next/dynamic";

// GSAP lives in its own chunk, fetched after hydration so it never delays the
// first paint. Nothing renders: it only animates sections already on the page.
const ScrollRevealsImpl = dynamic(() => import("./ScrollRevealsImpl"), { ssr: false });

export function ScrollReveals() {
  return <ScrollRevealsImpl />;
}
