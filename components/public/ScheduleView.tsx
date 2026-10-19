"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { upcomingStreams, type Override, type Slot } from "@/convex/lib/schedule";

type Props = {
  schedule: { timeZone: string; slots: Slot[]; overrides: Override[] };
  nowMs: number;
  creator: string;
  watchUrl: string | null;
};

type Viewer = { timeZone: string; locale: string };

// The server cannot know the visitor's timezone, so it renders in the
// streamer's; after hydration the client snapshot switches to the visitor's.
let clientViewer: Viewer | null = null;
function getClientViewer(): Viewer {
  if (!clientViewer) {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
    clientViewer = { timeZone, locale: navigator.language || "en-US" };
  }
  return clientViewer;
}
const noopSubscribe = () => () => {};

function relative(ms: number, nowMs: number) {
  const minutes = Math.round((ms - nowMs) / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 36) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function ScheduleView({ schedule, nowMs: initialNow, creator, watchUrl }: Props) {
  const serverViewer = useMemo(() => ({ timeZone: schedule.timeZone, locale: "en-US" }), [schedule.timeZone]);
  const viewer = useSyncExternalStore(noopSubscribe, getClientViewer, () => serverViewer);
  const [nowMs, setNowMs] = useState(initialNow);

  // Keep "live now" and "in 2 hours" honest if the tab stays open.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { streams, daysOff } = useMemo(
    () => upcomingStreams(schedule.slots, schedule.overrides, schedule.timeZone, nowMs),
    [schedule, nowMs],
  );

  const fmtDay = new Intl.DateTimeFormat(viewer.locale, { weekday: "short", month: "short", day: "numeric", timeZone: viewer.timeZone });
  const fmtTime = new Intl.DateTimeFormat(viewer.locale, { hour: "numeric", minute: "2-digit", timeZone: viewer.timeZone });
  const fmtOffDay = new Intl.DateTimeFormat(viewer.locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  if (schedule.slots.length === 0 && streams.length === 0) {
    return (
      <div>
        <p className="text-2xl font-semibold tracking-tight">Schedule coming soon.</p>
        {watchUrl && (
          <p className="mt-3 text-[var(--muted)]">
            Follow{" "}
            <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              here
            </a>{" "}
            to get notified when {creator || "the stream"} goes live.
          </p>
        )}
      </div>
    );
  }

  const next = streams[0];
  const isLive = next && next.startMs <= nowMs;
  const weekEnd = nowMs + 7 * 24 * 3600 * 1000;
  const thisWeek = streams.filter((s) => s.startMs < weekEnd);
  const offThisWeek = daysOff.filter((d) => Date.parse(`${d.date}T12:00:00Z`) < weekEnd);
  const sameZone = viewer.timeZone === schedule.timeZone;

  return (
    <div>
      {next && (
        <div className="relative overflow-hidden border border-[var(--line-strong)] bg-[var(--card)]/60 p-6 backdrop-blur-sm md:p-8">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em]">
            {isLive ? (
              <Badge className="gap-2 px-2.5 uppercase tracking-[0.2em]">
                {/* Live pulse: the one looping motion on the site; a static dot under reduced motion. */}
                <span aria-hidden className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--background)] opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-[var(--background)]" />
                </span>
                Live now
              </Badge>
            ) : (
              <span className="text-[var(--muted)]">Next stream · {relative(next.startMs, nowMs)}</span>
            )}
          </p>
          <p className="mt-4 text-[clamp(1.75rem,5vw,3rem)] font-semibold leading-tight tracking-[-0.03em]">
            {isLive ? next.title : `${fmtDay.format(next.startMs)}, ${fmtTime.format(next.startMs)}`}
          </p>
          {!isLive && <p className="mt-1 text-lg">{next.title}</p>}
          {next.note && <p className="mt-2 text-[var(--muted)]">{next.note}</p>}
          {watchUrl && (
            <Button asChild size="lg" className="press mt-6 h-12 px-6 text-sm font-semibold uppercase tracking-[0.15em]">
              <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                {isLive ? "Watch now" : "Follow to get notified"}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          )}
        </div>
      )}

      {(thisWeek.length > 1 || offThisWeek.length > 0) && (
        <>
          <h3 className="mt-10 text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">Next 7 days</h3>
          <ul className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              ...thisWeek.map((s) => ({ type: "stream" as const, key: `s${s.startMs}`, sortMs: s.startMs, stream: s })),
              ...offThisWeek.map((d) => ({ type: "off" as const, key: `o${d.date}`, sortMs: Date.parse(`${d.date}T00:00:00Z`), off: d })),
            ]
              .sort((a, b) => a.sortMs - b.sortMs)
              .map((row) =>
                row.type === "stream" ? (
                  <li key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-3 sm:grid-cols-[8rem_10rem_minmax(0,1fr)]">
                    <span className="font-medium tabular-nums">{fmtDay.format(row.stream.startMs)}</span>
                    <span className="tabular-nums">
                      {fmtTime.format(row.stream.startMs)} – {fmtTime.format(row.stream.endMs)}
                    </span>
                    <span className="col-start-2 sm:col-start-auto">
                      {row.stream.title}
                      {row.stream.kind === "special" && (
                        <Badge variant="outline" className="ml-2 align-middle text-[0.65rem] uppercase tracking-wider">
                          Special
                        </Badge>
                      )}
                    </span>
                  </li>
                ) : (
                  <li key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 py-3 text-[var(--muted)] sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <span className="font-medium tabular-nums">{fmtOffDay.format(Date.parse(`${row.off.date}T12:00:00Z`))}</span>
                    <span>
                      <span className="line-through decoration-1">No stream</span>
                      {row.off.note && ` — ${row.off.note}`}
                    </span>
                  </li>
                ),
              )}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs text-[var(--muted)]">
        {sameZone
          ? `Times shown in ${schedule.timeZone.replaceAll("_", " ")}.`
          : `Times shown in your timezone (${viewer.timeZone.replaceAll("_", " ")}). ${creator || "The streamer"} streams from ${schedule.timeZone.replaceAll("_", " ")}.`}
      </p>
    </div>
  );
}
