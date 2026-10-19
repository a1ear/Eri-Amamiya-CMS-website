import type { Metadata } from "next";
import { Suspense } from "react";
import { About } from "@/components/public/About";
import { Contact } from "@/components/public/Contact";
import { Gallery } from "@/components/public/Gallery";
import { HashScroll } from "@/components/public/HashScroll";
import { Hero, HeroSkeleton } from "@/components/public/Hero";
import { JsonLd } from "@/components/public/JsonLd";
import { Schedule } from "@/components/public/Schedule";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteNavFallback, SiteNavLinks } from "@/components/public/SiteNav";
import { Videos } from "@/components/public/Videos";
import { getPublicProfile } from "@/lib/public-data";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getPublicProfile();
  if (!profile) return {};
  const title = profile.tagline ? `${profile.displayName} · ${profile.tagline}` : profile.displayName;
  const description =
    profile.bio || profile.tagline || `${profile.displayName}: cosplay gallery, videos and stream schedule.`;
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "profile", url: "/", title, description, siteName: profile.displayName },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--foreground)] focus:px-4 focus:py-2 focus:text-[var(--background)]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--foreground)] bg-[var(--background)]/90 backdrop-blur">
        <nav aria-label="Sections" className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-4 px-4 text-sm">
          <Suspense fallback={<SiteNavFallback />}>
            <SiteNavLinks />
          </Suspense>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {/* Data is read per request; the header frame above is the static shell. */}
        <Suspense fallback={<HeroSkeleton />}>
          <Hero />
          <About />
          <Gallery />
          <Videos />
          <Schedule />
          <HashScroll />
          <JsonLd />
        </Suspense>
        <Contact />
      </main>
      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
    </>
  );
}
