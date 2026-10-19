import { getPublicProfile, getPublicSocials } from "@/lib/public-data";
import { siteUrl } from "@/lib/site";

/**
 * schema.org Person for search engines, linking the site to the creator's
 * social profiles. `<` is escaped so owner-written text can never close the
 * script tag.
 */
export async function JsonLd() {
  const [profile, socials] = await Promise.all([getPublicProfile(), getPublicSocials()]);
  if (!profile) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.displayName,
    description: profile.bio || profile.tagline || undefined,
    jobTitle: profile.tagline || undefined,
    image: profile.avatarUrl ?? undefined,
    url: `${siteUrl()}/`,
    sameAs: socials.map((s) => s.url),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
