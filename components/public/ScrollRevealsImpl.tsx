"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);
// The site's --ease-out token, so GSAP motion matches the CSS motion.
CustomEase.create("ui-out", "M0,0 C0.23,1 0.32,1 1,1");

/**
 * Scroll reveals for the public page (marketing surface, seen once per visit).
 *
 * - Only elements still BELOW the viewport when this loads are animated, so
 *   nothing the visitor already sees ever blinks out and back in.
 * - Each reveal fires once; scrolling back up never re-animates.
 * - Reduced motion: a short fade, no movement.
 */
export default function ScrollRevealsImpl() {
  useGSAP(() => {
    const unseen = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

    // Section blocks (heading, text, schedule, form, footer). Lists are
    // handled as staggered groups below instead of as one block.
    const blocks = gsap.utils
      .toArray<HTMLElement>("main section:not(:first-of-type) > div > :not(ul), footer > div")
      .filter(unseen);
    const items = gsap.utils.toArray<HTMLElement>("#gallery ul > li, #videos ul > li").filter(unseen);

    const mm = gsap.matchMedia();
    mm.add(
      { full: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
      (context) => {
        const reduce = Boolean(context.conditions?.reduce);
        const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
        const shown = { opacity: 1, y: 0, clearProps: "transform,opacity" };

        for (const el of blocks) {
          gsap.set(el, hidden);
          gsap.to(el, {
            ...shown,
            duration: reduce ? 0.35 : 0.8,
            ease: "ui-out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        }

        if (items.length) {
          gsap.set(items, hidden);
          ScrollTrigger.batch(items, {
            start: "top 92%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                ...shown,
                duration: reduce ? 0.35 : 0.7,
                ease: "ui-out",
                stagger: reduce ? 0 : 0.06,
                overwrite: true,
              }),
          });
        }
      },
    );

    // Late-loading images and fonts can move section positions slightly.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh, { once: true });
    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  });

  return null;
}
