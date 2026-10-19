/** Public origin of the site (no trailing slash). Set NEXT_PUBLIC_SITE_URL per environment. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
