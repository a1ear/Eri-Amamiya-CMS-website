import { getPublicProfile } from "@/lib/public-data";
import { RichText } from "./RichText";

/** Hidden entirely when the owner has not written anything yet. */
export async function About() {
  const profile = await getPublicProfile();
  if (!profile?.about) return null;

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="scroll-mt-16 border-t border-[var(--line)]"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[12rem_minmax(0,1fr)] md:py-24">
        <h2
          id="about-heading"
          className="section-label text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]"
        >
          About me
        </h2>
        <RichText
          text={profile.about}
          className="max-w-2xl space-y-5 text-lg leading-relaxed text-pretty"
        />
      </div>
    </section>
  );
}
