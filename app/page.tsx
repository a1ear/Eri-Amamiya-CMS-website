import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { Suspense } from "react";
import { About } from "@/components/public/About";
import { ArcadeBackground, CrtOverlay } from "@/components/public/ArcadeBackground";
import { Contact } from "@/components/public/Contact";
import { FxToggle } from "@/components/public/FxToggle";
import { Gallery } from "@/components/public/Gallery";
import { HashScroll } from "@/components/public/HashScroll";
import { Hero, HeroSkeleton } from "@/components/public/Hero";
import { JsonLd } from "@/components/public/JsonLd";
import { Schedule } from "@/components/public/Schedule";
import { ScrollReveals } from "@/components/public/ScrollReveals";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteNavFallback, SiteNavLinks } from "@/components/public/SiteNav";
import { Ticker } from "@/components/public/Ticker";
import { Videos } from "@/components/public/Videos";
import { getPublicProfile } from "@/lib/public-data";

// Arcade type for the public page only (self-hosted by next/font; the admin
// keeps Geist). Press Start 2P for display/labels, VT323 for readable body text.
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel", display: "swap" });
const terminal = VT323({ weight: "400", subsets: ["latin"], variable: "--font-terminal", display: "swap" });

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
    <div className={`arcade flex min-h-full flex-1 flex-col ${pixel.variable} ${terminal.variable}`}>
      <ArcadeBackground />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--foreground)] focus:px-4 focus:py-2 focus:text-[var(--background)]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/75 backdrop-blur-md">
        <nav aria-label="Sections" className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Suspense fallback={<SiteNavFallback />}>
            <SiteNavLinks />
          </Suspense>
          <FxToggle />
        </nav>
        {/* XP bar: fills as you scroll. CSS scroll-driven, no JavaScript. */}
        <div aria-hidden className="arcade-xp">
          <span />
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Data is read per request; the header frame above is the static shell. */}
        <Suspense fallback={<HeroSkeleton />}>
          <Hero />
          <Ticker />
          <About />
          <Gallery />
          <Videos />
          <Schedule />
          <HashScroll />
          <JsonLd />
          {/* Loads GSAP after the page is interactive; animates only unseen sections. */}
          <ScrollReveals />
        </Suspense>
        <Contact />
      </main>
      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
      <CrtOverlay />
    </div>
  );
}
