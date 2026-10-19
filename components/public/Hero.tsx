import Image from "next/image";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { SOCIAL_PLATFORMS } from "@/convex/lib/links";
import { initials } from "@/lib/initials";
import { getPublicProfile, getPublicSocials } from "@/lib/public-data";
import { primaryLiveLink, SocialLinkList } from "./SocialLinks";

/** Stagger index for the CSS entrance (see `.enter` in globals.css). */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

export async function Hero() {
  const [profile, socials] = await Promise.all([getPublicProfile(), getPublicSocials()]);
  const live = primaryLiveLink(socials);
  const others = socials.filter((l) => l.id !== live?.id);
  // The seed guarantees a profile; this only covers a fresh, unseeded deployment.
  const name = profile?.displayName ?? "Coming soon";
  const words = name.split(/\s+/);

  return (
    <section
      aria-labelledby="hero-name"
      className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-16 pt-8 sm:gap-10 sm:pt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-16 md:pb-24"
    >
      <div className="order-2 md:order-1">
        {profile?.tagline && (
          <p className="enter flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]" style={at(0)}>
            <span aria-hidden className="h-px w-8 bg-[var(--line-strong)]" />
            {profile.tagline}
          </p>
        )}
        <h1
          id="hero-name"
          className="mt-4 text-[clamp(2.75rem,9vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-balance"
        >
          {/* Each word rises from behind its own mask. Screen readers get the plain name. */}
          <span className="sr-only">{name}</span>
          <span aria-hidden>
            {words.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span className="enter inline-block" style={at(i + 1)}>
                  {word}
                  {i < words.length - 1 ? " " : ""}
                </span>
              </span>
            ))}
          </span>
        </h1>
        {profile?.bio && (
          <p className="enter mt-6 max-w-xl text-lg leading-relaxed text-pretty text-[var(--foreground)]/85" style={at(words.length + 1)}>
            {profile.bio}
          </p>
        )}
        {(live || others.length > 0) && (
          <div className="enter mt-8 flex flex-wrap items-center gap-x-6 gap-y-4" style={at(words.length + 2)}>
            {live && (
              <Button
                asChild
                size="lg"
                className="press h-12 px-6 text-sm font-semibold uppercase tracking-[0.15em]"
              >
                <a href={live.url} target="_blank" rel="noopener noreferrer me">
                  Watch on {SOCIAL_PLATFORMS[live.platform]?.label ?? live.label}
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </Button>
            )}
            <SocialLinkList
              links={others}
              className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
              itemClassName="inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
        )}
      </div>

      <div className="order-1 mx-auto w-full max-w-52 sm:max-w-72 md:order-2 md:max-w-none">
        <div className="relative">
          {/* Offset frame: a quiet editorial echo of the portrait border. */}
          <div aria-hidden className="enter absolute inset-0 translate-x-3 translate-y-3 border border-[var(--line-strong)]" style={at(3)} />
          <div className="enter-reveal relative aspect-[4/5] overflow-hidden border border-[var(--foreground)] bg-[var(--surface)]">
            {profile?.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={`Portrait of ${name}`}
                fill
                priority
                sizes="(min-width: 768px) 22rem, 18rem"
                className="object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center text-6xl font-semibold tracking-tight"
              >
                {initials(name)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-16 pt-8 sm:gap-10 sm:pt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-16 md:pb-24"
    >
      <div className="order-2 space-y-5 md:order-1">
        <div className="h-3 w-40 animate-pulse bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="h-20 w-4/5 animate-pulse bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="h-5 w-3/5 animate-pulse bg-[var(--surface)] motion-reduce:animate-none" />
      </div>
      <div className="order-1 mx-auto aspect-[4/5] w-full max-w-52 animate-pulse bg-[var(--surface)] motion-reduce:animate-none sm:max-w-72 md:order-2 md:max-w-none" />
    </section>
  );
}
