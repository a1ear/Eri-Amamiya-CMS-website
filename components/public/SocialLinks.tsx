import { LIVE_PLATFORMS, SOCIAL_PLATFORMS } from "@/convex/lib/links";
import type { PublicSocial } from "@/lib/public-data";

/** The link that best answers "where do I watch?", if any. */
export function primaryLiveLink(links: PublicSocial[]) {
  for (const platform of LIVE_PLATFORMS) {
    const link = links.find((l) => l.platform === platform);
    if (link) return link;
  }
  return null;
}

export function SocialLinkList({
  links,
  className = "",
  itemClassName = "",
}: {
  links: PublicSocial[];
  className?: string;
  itemClassName?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul className={className}>
      {links.map((link) => (
        <li key={link.id}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer me"
            className={itemClassName}
          >
            {link.label}
            <span aria-hidden> ↗</span>
            <span className="sr-only">
              {link.label !== SOCIAL_PLATFORMS[link.platform]?.label && ` on ${SOCIAL_PLATFORMS[link.platform]?.label}`}{" "}
              (opens in new tab)
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
