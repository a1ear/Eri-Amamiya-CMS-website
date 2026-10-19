"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FX_EVENT, fxEnabled } from "./FxToggle";

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);
// The site's --ease-out token, so GSAP motion matches the CSS motion.
CustomEase.create("ui-out", "M0,0 C0.23,1 0.32,1 1,1");

/**
 * Scroll motion for the public page (marketing surface, seen once per visit).
 *
 * Reveals (one-shot, under a second each):
 * - Only elements still BELOW the viewport when this loads are animated, so
 *   nothing the visitor already sees ever blinks out and back in.
 * - Section labels type themselves in ("Stage 03 / Gallery"); gallery tiles
 *   wipe in in blocky steps, like a sprite loading; other blocks rise.
 * - Reduced motion: a short fade, no movement.
 *
 * Scrubbed effects (tied to scroll, decorative): hero portrait parallax and
 * the ticker strip. Off with reduced motion or the FX switch, and switched
 * on/off live when the visitor flips FX.
 */
export default function ScrollRevealsImpl() {
  useGSAP(() => {
    const unseen = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

    // Lists and labels get their own treatment below.
    const blocks = gsap.utils
      .toArray<HTMLElement>("main section:not(:first-of-type) > div > :not(ul):not(.section-label), footer > div")
      .filter(unseen);
    const labels = gsap.utils.toArray<HTMLElement>("main .section-label").filter(unseen);
    const tiles = gsap.utils.toArray<HTMLElement>("#gallery ul > li").filter(unseen);

    const mm = gsap.matchMedia();
    mm.add(
      { full: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
      (context) => {
        const reduce = Boolean(context.conditions?.reduce);
        const fade = { opacity: 0 };

        for (const el of blocks) {
          gsap.set(el, reduce ? fade : { opacity: 0, y: 28 });
          gsap.to(el, {
            opacity: 1,
            y: 0,
            clearProps: "transform,opacity",
            duration: reduce ? 0.35 : 0.8,
            ease: "ui-out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        }

        for (const el of labels) {
          // One step per character, including the "Stage 03 / " prefix.
          const chars = (el.textContent ?? "").length + 11;
          gsap.set(el, reduce ? fade : { clipPath: "inset(0 100% 0 0)" });
          gsap.to(el, {
            ...(reduce ? { opacity: 1, duration: 0.35 } : { clipPath: "inset(0 0% 0 0)", duration: Math.min(0.9, chars * 0.035) }),
            ease: reduce ? "none" : `steps(${chars})`,
            clearProps: "clipPath,opacity",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        }

        if (tiles.length) {
          gsap.set(tiles, reduce ? fade : { opacity: 0, clipPath: "inset(0 0 100% 0)" });
          ScrollTrigger.batch(tiles, {
            start: "top 92%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                opacity: 1,
                clipPath: "inset(0 0 0% 0)",
                clearProps: "clipPath,opacity",
                duration: reduce ? 0.35 : 0.5,
                ease: reduce ? "none" : "steps(6)",
                stagger: reduce ? 0 : 0.07,
                overwrite: true,
              }),
          });
        }
      },
    );

    // Scrubbed, decorative effects: only with motion allowed and FX on.
    let scrub: gsap.Context | null = null;
    const motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const syncScrub = () => {
      const want = motionOk.matches && fxEnabled();
      if (want && !scrub) {
        scrub = gsap.context(() => {
          for (const el of gsap.utils.toArray<HTMLElement>("[data-parallax]")) {
            gsap.to(el, {
              y: Number(el.dataset.parallax) || -40,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
            });
          }
          for (const el of gsap.utils.toArray<HTMLElement>("[data-ticker]")) {
            gsap.fromTo(
              el,
              { xPercent: 0 },
              {
                xPercent: -30,
                ease: "none",
                scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
              },
            );
          }
        });
      } else if (!want && scrub) {
        scrub.revert();
        scrub = null;
      }
    };
    syncScrub();
    window.addEventListener(FX_EVENT, syncScrub);
    motionOk.addEventListener("change", syncScrub);

    // Late-loading images and fonts can move section positions slightly.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh, { once: true });
    return () => {
      window.removeEventListener("load", refresh);
      window.removeEventListener(FX_EVENT, syncScrub);
      motionOk.removeEventListener("change", syncScrub);
      scrub?.revert();
      mm.revert();
    };
  });

  return null;
}
