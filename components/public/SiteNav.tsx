import { getPublicPhotos, getPublicProfile, getPublicVideos } from "@/lib/public-data";

const link =
  "inline-flex min-h-11 shrink-0 items-center px-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2";

/**
 * Links only to sections that exist, so the nav never points at nothing.
 * On narrow phones the links scroll sideways in one row (with a fade hinting
 * at more) instead of wrapping the sticky header onto two lines.
 */
export async function SiteNavLinks() {
  const [profile, photos, videos] = await Promise.all([getPublicProfile(), getPublicPhotos(), getPublicVideos()]);
  const sections = [
    profile?.about ? ["#about", "About"] : null,
    photos.length > 0 ? ["#gallery", "Gallery"] : null,
    videos.length > 0 ? ["#videos", "Videos"] : null,
    ["#schedule", "Schedule"],
    ["#contact", "Contact"],
  ].filter((s): s is [string, string] => s !== null);

  return (
    <>
      <a
        href="#main"
        className="shrink-0 truncate whitespace-nowrap font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:max-w-[40%]"
      >
        {profile?.displayName ?? "Home"}
      </a>
      <div className="relative ml-auto min-w-0">
        <ul className="flex gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden max-sm:pr-6">
          {sections.map(([href, label]) => (
            <li key={href}>
              <a href={href} className={link}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--background)] sm:hidden"
        />
      </div>
    </>
  );
}

export function SiteNavFallback() {
  return <span className="h-5 w-24 bg-[var(--surface)]" aria-hidden />;
}
