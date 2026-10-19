import { describe, expect, test } from "vitest";
import {
  addDays,
  dateInZone,
  dayOfWeek,
  durationBetween,
  parseDate,
  parseTime,
  upcomingStreams,
  zonedToUtc,
  type Override,
  type Slot,
} from "./schedule";

const iso = (ms: number) => new Date(ms).toISOString();

describe("calendar helpers", () => {
  test("parseDate rejects impossible dates", () => {
    expect(parseDate("2026-02-29")).toBeNull();
    expect(parseDate("2028-02-29")).toEqual([2028, 2, 29]);
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("26-1-1")).toBeNull();
  });
  test("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  test("dayOfWeek", () => {
    expect(dayOfWeek("2026-10-23")).toBe(5); // Friday
  });
  test("parseTime / durationBetween", () => {
    expect(parseTime("20:00")).toBe(1200);
    expect(parseTime("24:00")).toBeNull();
    expect(durationBetween(1320, 60)).toBe(180); // 22:00 -> 01:00 crosses midnight
  });
});

describe("zonedToUtc", () => {
  test("fixed-offset zone", () => {
    expect(iso(zonedToUtc("2026-10-23", 20 * 60, "Asia/Manila"))).toBe("2026-10-23T12:00:00.000Z");
  });

  test("DST: New York before and after the November fall-back", () => {
    expect(iso(zonedToUtc("2026-10-30", 20 * 60, "America/New_York"))).toBe("2026-10-31T00:00:00.000Z"); // EDT -4
    expect(iso(zonedToUtc("2026-11-06", 20 * 60, "America/New_York"))).toBe("2026-11-07T01:00:00.000Z"); // EST -5
  });

  test("DST: a wall time skipped by spring-forward still resolves (just after the jump)", () => {
    // 2026-03-08 02:30 does not exist in New York.
    expect(iso(zonedToUtc("2026-03-08", 150, "America/New_York"))).toBe("2026-03-08T07:30:00.000Z");
  });

  test("ambiguous fall-back hour picks a valid instant", () => {
    const ms = zonedToUtc("2026-11-01", 90, "America/New_York"); // 01:30 happens twice
    expect(["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"]).toContain(iso(ms));
  });

  test("dateInZone", () => {
    expect(dateInZone(Date.parse("2026-10-23T18:00:00Z"), "Asia/Manila")).toBe("2026-10-24");
  });
});

describe("upcomingStreams", () => {
  const TZ = "Asia/Manila";
  const slots: Slot[] = [
    { dayOfWeek: 1, startMinute: 20 * 60, durationMinutes: 180, title: "Just Chatting" }, // Mon 20:00
    { dayOfWeek: 5, startMinute: 22 * 60, durationMinutes: 180, title: "Late night" }, // Fri 22:00-01:00
  ];
  // Wednesday 2026-10-21 12:00 Manila
  const now = Date.parse("2026-10-21T04:00:00Z");

  test("lists the next two weeks in order", () => {
    const { streams } = upcomingStreams(slots, [], TZ, now);
    expect(streams.map((s) => [iso(s.startMs), s.title])).toEqual([
      ["2026-10-23T14:00:00.000Z", "Late night"],
      ["2026-10-26T12:00:00.000Z", "Just Chatting"],
      ["2026-10-30T14:00:00.000Z", "Late night"],
      ["2026-11-02T12:00:00.000Z", "Just Chatting"],
    ]);
  });

  test("a cancelled day removes that day's streams and is reported", () => {
    const overrides: Override[] = [{ date: "2026-10-23", kind: "cancelled", note: "At a convention" }];
    const { streams, daysOff } = upcomingStreams(slots, overrides, TZ, now);
    expect(streams.some((s) => iso(s.startMs).startsWith("2026-10-23"))).toBe(false);
    expect(daysOff).toEqual([{ date: "2026-10-23", note: "At a convention" }]);
  });

  test("a special stream is added", () => {
    const overrides: Override[] = [
      { date: "2026-10-31", kind: "special", startMinute: 21 * 60, durationMinutes: 240, title: "Halloween", note: "Costume contest" },
    ];
    const { streams } = upcomingStreams(slots, overrides, TZ, now);
    expect(streams.find((s) => s.kind === "special")).toMatchObject({ title: "Halloween", note: "Costume contest" });
  });

  test("a stream that crossed midnight and is still running is included (live now)", () => {
    // Saturday 00:30 Manila, Friday's 22:00-01:00 stream is live.
    const sat = Date.parse("2026-10-23T16:30:00Z");
    const { streams } = upcomingStreams(slots, [], TZ, sat);
    expect(streams[0].title).toBe("Late night");
    expect(streams[0].startMs).toBeLessThanOrEqual(sat);
    expect(streams[0].endMs).toBeGreaterThan(sat);
  });

  test("ended streams are dropped", () => {
    const afterFriday = Date.parse("2026-10-23T18:00:00Z"); // Sat 02:00 Manila
    const { streams } = upcomingStreams(slots, [], TZ, afterFriday);
    expect(streams[0].title).toBe("Just Chatting");
  });
});
