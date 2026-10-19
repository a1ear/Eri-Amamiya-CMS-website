/**
 * Stream schedule maths. Pure and shared by server and browser.
 *
 * The owner enters wall-clock times ("Fridays 20:00") in their own timezone.
 * Those are turned into real instants here, so visitors anywhere can see them
 * in their local time, and daylight-saving changes are handled by Intl rather
 * than by hand-written offset tables.
 */

export const SCHEDULE_RULES = {
  title: { max: 60 },
  note: { max: 140 },
  minDuration: 15,
  maxDuration: 12 * 60,
  maxSlots: 50,
  maxOverrideDaysAhead: 366,
  upcomingDays: 14,
} as const;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type Slot = { dayOfWeek: number; startMinute: number; durationMinutes: number; title: string };
export type Override =
  | { date: string; kind: "cancelled"; note: string }
  | { date: string; kind: "special"; startMinute: number; durationMinutes: number; title: string; note: string };

export type Occurrence = {
  startMs: number;
  endMs: number;
  title: string;
  kind: "regular" | "special";
  note: string;
};

export type DayOff = { date: string; note: string };

/* ---------------------------------------------------------- date helpers */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-23" -> [2026, 10, 23] if it is a real calendar date. */
export function parseDate(date: string): [number, number, number] | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? [y, mo, d] : null;
}

export function formatDate(y: number, m: number, d: number) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Adds days to a calendar date (no timezone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date)!;
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return formatDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function dayOfWeek(date: string): number {
  const [y, m, d] = parseDate(date)!;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function zonedParts(ms: number, timeZone: string) {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, fmt);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(ms)) if (type !== "literal") p[type] = Number(value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** The calendar date in `timeZone` at instant `ms`, as "YYYY-MM-DD". */
export function dateInZone(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return formatDate(p.year, p.month, p.day);
}

/** UTC offset of `timeZone` at instant `ms`, in milliseconds. */
function offsetAt(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant at which the clock in `timeZone` reads `date` + `minute`.
 * A wall time skipped by a DST jump (e.g. 02:30 on spring-forward night)
 * resolves to the instant just after the jump, so a stream is never dropped.
 */
export function zonedToUtc(date: string, minute: number, timeZone: string): number {
  const [y, m, d] = parseDate(date)!;
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  const first = wall - offsetAt(wall, timeZone);
  const second = wall - offsetAt(first, timeZone);
  const reads = (ms: number) => {
    const p = zonedParts(ms, timeZone);
    return formatDate(p.year, p.month, p.day) === date && p.hour * 60 + p.minute === minute;
  };
  if (reads(second)) return second;
  if (reads(first)) return first;
  // The wall time does not exist (skipped by a DST jump): take the later
  // candidate, which lands just after the jump.
  return Math.max(first, second);
}

/* ------------------------------------------------------------- schedule */

/**
 * Concrete streams from today (in the owner's timezone) for `days` days,
 * applying overrides: "cancelled" removes that day's regular streams,
 * "special" adds a one-off stream. Streams that already ended are dropped.
 */
export function upcomingStreams(
  slots: Slot[],
  overrides: Override[],
  timeZone: string,
  nowMs: number,
  days: number = SCHEDULE_RULES.upcomingDays,
): { streams: Occurrence[]; daysOff: DayOff[] } {
  const today = dateInZone(nowMs, timeZone);
  // Start a day early so a stream that began yesterday evening and is still
  // running (crossing midnight) shows up as live.
  const first = addDays(today, -1);
  const last = addDays(today, days - 1);
  const streams: Occurrence[] = [];
  const daysOff: DayOff[] = [];

  for (let date = first; date <= last; date = addDays(date, 1)) {
    const dayOverrides = overrides.filter((o) => o.date === date);
    const cancelled = dayOverrides.find((o) => o.kind === "cancelled");
    if (cancelled && date >= today) daysOff.push({ date, note: cancelled.note });

    if (!cancelled) {
      const dow = dayOfWeek(date);
      for (const s of slots) {
        if (s.dayOfWeek !== dow) continue;
        const startMs = zonedToUtc(date, s.startMinute, timeZone);
        streams.push({ startMs, endMs: startMs + s.durationMinutes * 60_000, title: s.title, kind: "regular", note: "" });
      }
    }
    for (const o of dayOverrides) {
      if (o.kind !== "special") continue;
      const startMs = zonedToUtc(date, o.startMinute, timeZone);
      streams.push({ startMs, endMs: startMs + o.durationMinutes * 60_000, title: o.title, kind: "special", note: o.note });
    }
  }

  return {
    streams: streams.filter((s) => s.endMs > nowMs).sort((a, b) => a.startMs - b.startMs),
    daysOff,
  };
}

/** "20:00" -> 1200. Null if not a valid HH:MM. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 1200 -> "20:00" */
export function formatTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** Duration from a start/end wall time; an end at or before the start crosses midnight. */
export function durationBetween(startMinute: number, endMinute: number) {
  const diff = (endMinute - startMinute + 1440) % 1440;
  return diff === 0 ? 1440 : diff;
}
