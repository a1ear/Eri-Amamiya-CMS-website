/**
 * Two soft glows drifting slowly behind the public page. Pure CSS (see
 * `.ambient` in globals.css): no JavaScript, transform-only, off the main
 * thread, and static for visitors who prefer reduced motion.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient">
      <span />
      <span />
    </div>
  );
}
