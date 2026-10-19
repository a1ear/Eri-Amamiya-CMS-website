import { getPublicPhotos, getPublicProfile } from "@/lib/public-data";
import { GalleryGrid } from "./GalleryGrid";

/** Hidden entirely until there is at least one visible photo. */
export async function Gallery() {
  const [photos, profile] = await Promise.all([getPublicPhotos(), getPublicProfile()]);
  if (photos.length === 0) return null;

  return (
    <section id="gallery" aria-labelledby="gallery-heading" className="scroll-mt-16 border-t border-[var(--line)] py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <h2 id="gallery-heading" className="section-label text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
          Cosplay gallery
        </h2>
      </div>
      <div className="mt-10">
        <GalleryGrid photos={photos} creator={profile?.displayName ?? ""} />
      </div>
    </section>
  );
}
