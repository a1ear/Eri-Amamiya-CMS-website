import Image from "next/image";
import { SOCIAL_PLATFORMS } from "@/convex/lib/links";
import { initials } from "@/lib/initials";
import { getPublicProfile, getPublicSocials } from "@/lib/public-data";
import { primaryLiveLink, SocialLinkList } from "./SocialLinks";

export async function Hero() {
  const [profile, socials] = await Promise.all([getPublicProfile(), getPublicSocials()]);
  const live = primaryLiveLink(socials);
  const others = socials.filter((l) => l.id !== live?.id);
  // The seed guarantees a profile; this only covers a fresh, unseeded deployment.
  const name = profile?.displayName ?? "Coming soon";

  return (
    <section
      aria-labelledby="hero-name"
      className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-16 pt-8 sm:gap-10 sm:pt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-16 md:pb-24"
    >
      <div className="order-2 md:order-1">
        {profile?.tagline && (
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
            {profile.tagline}
          </p>
        )}
        <h1
          id="hero-name"
          className="mt-4 text-[clamp(2.75rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-balance"
        >
          {name}
        </h1>
        {profile?.bio && (
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty">{profile.bio}</p>
        )}
        {(live || others.length > 0) && (
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            {live && (
              <a
                href={live.url}
                target="_blank"
                rel="noopener noreferrer me"
                className="inline-flex min-h-12 items-center bg-[var(--foreground)] px-6 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                Watch on {SOCIAL_PLATFORMS[live.platform]?.label ?? live.label}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
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
        <div className="relative aspect-[4/5] overflow-hidden border border-[var(--foreground)] bg-[var(--surface)]">
          {profile?.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={`Portrait of ${name}`}
              fill
              priority
              sizes="(min-width: 768px) 22rem, 18rem"
              className="object-cover grayscale-0"
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
        <div className="h-3 w-40 bg-[var(--surface)]" />
        <div className="h-20 w-4/5 bg-[var(--surface)]" />
        <div className="h-5 w-3/5 bg-[var(--surface)]" />
      </div>
      <div className="order-1 mx-auto aspect-[4/5] w-full max-w-52 bg-[var(--surface)] sm:max-w-72 md:order-2 md:max-w-none" />
    </section>
  );
}
