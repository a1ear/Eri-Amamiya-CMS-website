const WORDS = ["Cosplay", "Live streams", "Games", "Collabs", "Behind the builds"];

/**
 * Arcade marquee band. It only moves while the visitor scrolls (scrubbed by
 * GSAP in ScrollRevealsImpl), so it never drifts on its own. Decorative: the
 * words repeat information found elsewhere, so it's hidden from screen readers.
 */
export function Ticker() {
  const run = [...WORDS, ...WORDS, ...WORDS];
  return (
    <div aria-hidden className="arcade-ticker overflow-hidden border-y border-[var(--line)] py-4">
      <div data-ticker className="flex w-max gap-10 whitespace-nowrap font-pixel text-[0.7rem] uppercase text-[var(--muted)]">
        {run.map((word, i) => (
          <span key={i} className="flex items-center gap-10">
            {word}
            <span className="text-[var(--foreground)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
