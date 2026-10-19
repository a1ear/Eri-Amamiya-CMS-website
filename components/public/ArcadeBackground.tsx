/**
 * Retro arcade backdrop for the public page, monochrome to keep the
 * black-and-white brief: two pixel starfields (parallax on scroll), a glowing
 * horizon and a perspective grid floor running toward the viewer.
 *
 * Pure CSS (see `.arcade-bg` in globals.css): transform-only animations on
 * the compositor, scroll-linked parallax via `animation-timeline: scroll()`
 * (no JavaScript; static where unsupported). Everything stops for reduced
 * motion or when the visitor switches FX off.
 */
export function ArcadeBackground() {
  return (
    <div aria-hidden className="arcade-bg">
      <div className="arcade-stars arcade-stars-far" />
      <div className="arcade-stars arcade-stars-near" />
      <div className="arcade-horizon" />
      <div className="arcade-floor">
        <div className="arcade-plane" />
      </div>
    </div>
  );
}

/** Faint CRT scanlines + vignette over the page (static, no flicker). */
export function CrtOverlay() {
  return <div aria-hidden className="arcade-crt" />;
}
