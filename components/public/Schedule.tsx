import { getPublicProfile, getPublicSchedule, getPublicSocials } from "@/lib/public-data";
import { ScheduleView } from "./ScheduleView";
import { primaryLiveLink } from "./SocialLinks";

export async function Schedule() {
  const [{ schedule, nowMs }, profile, socials] = await Promise.all([
    getPublicSchedule(),
    getPublicProfile(),
    getPublicSocials(),
  ]);
  const live = primaryLiveLink(socials);

  return (
    <section id="schedule" aria-labelledby="schedule-heading" className="scroll-mt-16 border-t border-[var(--line)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[12rem_minmax(0,1fr)] md:py-24">
        <h2 id="schedule-heading" className="section-label text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
          Stream schedule
        </h2>
        <ScheduleView
          schedule={schedule}
          nowMs={nowMs}
          creator={profile?.displayName ?? ""}
          watchUrl={live?.url ?? null}
        />
      </div>
    </section>
  );
}
