"use client";

import { useEffect } from "react";

/**
 * Sections stream in after the browser has already tried to jump to
 * `#gallery` etc., so a deep link from a bio would land at the top. Rendered
 * at the end of the streamed content, this re-applies the hash once the
 * target exists.
 */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
