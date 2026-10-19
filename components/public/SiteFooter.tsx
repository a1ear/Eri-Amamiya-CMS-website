import { getPublicProfile, getPublicSocials } from "@/lib/public-data";
import { SocialLinkList } from "./SocialLinks";

export async function SiteFooter() {
  const [profile, socials] = await Promise.all([getPublicProfile(), getPublicSocials()]);
  const name = profile?.displayName ?? "";

  return (
    <footer className="border-t border-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[clamp(1.75rem,5vw,3rem)] font-semibold leading-none tracking-[-0.03em]">{name}</p>
          {socials.length > 0 && (
            <nav aria-label="Social media" className="mt-6">
              <SocialLinkList
                links={socials}
                className="flex flex-wrap gap-x-6 gap-y-3 text-sm"
                itemClassName="inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </nav>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} {name}
        </p>
      </div>
    </footer>
  );
}
