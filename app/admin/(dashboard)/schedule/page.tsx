"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useConfirm } from "@/components/admin/ConfirmProvider";
import { fieldErrorsOf, messageOf } from "@/components/admin/errors";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/styles";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { DAY_NAMES, durationBetween, formatTime, parseTime, SCHEDULE_RULES } from "@/convex/lib/schedule";

// Monday-first, the way most people think about a streaming week.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function SchedulePage() {
  const data = useQuery(api.schedule.getAdmin);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Streaming schedule</h1>
      {data && (
        <p className="mt-1 text-sm text-muted-foreground">
          Enter times in <strong className="font-semibold text-current">{data.timeZone.replaceAll("_", " ")}</strong>.
          Visitors see them converted to their own time.{" "}
          <Link href="/admin/profile" className="underline underline-offset-2">
            Change timezone
          </Link>
        </p>
      )}

      {data === undefined ? (
        <p role="status" className="mt-8 text-sm">
          Loading schedule…
        </p>
      ) : (
        <>
          <section aria-labelledby="weekly-heading" className="mt-8">
            <h2 id="weekly-heading" className="text-sm font-semibold uppercase tracking-wider">
              Every week
            </h2>
            <SlotForm mode="add" />
            {data.slots.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No weekly streams yet. Your site shows &ldquo;Schedule coming soon&rdquo; until you add one.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {WEEK.flatMap((day) =>
                  data.slots
                    .filter((s) => s.dayOfWeek === day)
                    .map((slot) => (
                      <li key={slot._id} className="border border-[var(--line-strong)] p-3">
                        <SlotForm mode="edit" slot={slot} />
                      </li>
                    )),
                )}
              </ul>
            )}
          </section>

          <section aria-labelledby="changes-heading" className="mt-12 border-t border-[var(--line-strong)] pt-8">
            <h2 id="changes-heading" className="text-sm font-semibold uppercase tracking-wider">
              Changes &amp; extra streams
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Taking a day off, or streaming at an unusual time? Add it here and your site updates.
            </p>
            <OverrideForm today={data.today} />
            {data.overrides.length > 0 && (
              <ul className="mt-4 space-y-2">
                {data.overrides.map((o) => (
                  <OverrideRow key={o._id} override={o} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/* ----------------------------------------------------------------------- */

function SlotForm({ mode, slot }: { mode: "add" | "edit"; slot?: Doc<"scheduleSlots"> }) {
  const add = useMutation(api.schedule.addSlot);
  const update = useMutation(api.schedule.updateSlot);
  const remove = useMutation(api.schedule.removeSlot);
  const confirm = useConfirm();
  const id = useId();
  const initial = {
    day: String(slot?.dayOfWeek ?? 1),
    start: slot ? formatTime(slot.startMinute) : "20:00",
    end: slot ? formatTime((slot.startMinute + slot.durationMinutes) % 1440) : "23:00",
    title: slot?.title ?? "",
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("");
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const startMinute = parseTime(form.start);
  const endMinute = parseTime(form.end);
  const crossesMidnight = startMinute !== null && endMinute !== null && endMinute <= startMinute;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    if (startMinute === null || endMinute === null) {
      setErrors({ start: "Pick a start and end time." });
      return;
    }
    const args = {
      dayOfWeek: Number(form.day),
      startMinute,
      durationMinutes: durationBetween(startMinute, endMinute),
      title: form.title,
    };
    setStatus("Saving…");
    try {
      if (mode === "add") {
        await add(args);
        setForm(initial);
        setStatus("Added.");
      } else {
        await update({ id: slot!._id, ...args });
        setStatus("Saved.");
      }
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? {});
      setStatus(messageOf(err));
    }
  }

  const errorText = Object.values(errors).join(" ");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`grid gap-3 sm:grid-cols-[9rem_7rem_7rem_minmax(0,1fr)] sm:items-end ${mode === "add" ? "mt-4 border border-[var(--line-strong)] p-4" : ""}`}
    >
      <div className="space-y-1">
        <label htmlFor={`${id}-day`} className="text-xs font-medium">
          Day
        </label>
        <select id={`${id}-day`} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className={`${inputClass} py-1.5 text-sm`}>
          {WEEK.map((d) => (
            <option key={d} value={d}>
              {DAY_NAMES[d]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-start`} className="text-xs font-medium">
          Starts
        </label>
        <input id={`${id}-start`} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-invalid={Boolean(errors.start)} className={`${inputClass} py-1.5 text-sm`} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-end`} className="text-xs font-medium">
          Ends
        </label>
        <input id={`${id}-end`} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-invalid={Boolean(errors.end)} aria-describedby={`${id}-hint`} className={`${inputClass} py-1.5 text-sm`} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-title`} className="text-xs font-medium">
          What you&apos;re streaming <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id={`${id}-title`} value={form.title} maxLength={SCHEDULE_RULES.title.max + 10} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Just Chatting" aria-invalid={Boolean(errors.title)} className={`${inputClass} py-1.5 text-sm`} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
        {mode === "add" ? (
          <button type="submit" className={`${primaryButton} py-1.5`}>
            Add weekly stream
          </button>
        ) : (
          dirty && (
            <>
              <button type="submit" className={`${primaryButton} py-1.5`}>
                Save
              </button>
              <button type="button" onClick={() => setForm(initial)} className={`${secondaryButton} py-1.5`}>
                Undo
              </button>
            </>
          )
        )}
        {mode === "edit" && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: `Remove the ${DAY_NAMES[slot!.dayOfWeek]} ${formatTime(slot!.startMinute)} stream?`,
                description: "It disappears from your weekly schedule on the site.",
                confirmLabel: "Remove stream",
              });
              if (!ok) return;
              try {
                await remove({ id: slot!._id });
              } catch (err) {
                setStatus(messageOf(err));
              }
            }}
            className={`${secondaryButton} ml-auto py-1.5`}
          >
            Remove
          </button>
        )}
        <p id={`${id}-hint`} role={errorText ? "alert" : "status"} className="w-full text-xs font-medium empty:hidden">
          {errorText || status || (crossesMidnight ? "Ends after midnight (next day)." : "")}
        </p>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------------- */

function OverrideForm({ today }: { today: string }) {
  const add = useMutation(api.schedule.addOverride);
  const id = useId();
  const blank = { date: today, kind: "cancelled" as "cancelled" | "special", start: "20:00", end: "23:00", title: "", note: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const startMinute = parseTime(form.start);
    const endMinute = parseTime(form.end);
    if (form.kind === "special" && (startMinute === null || endMinute === null)) {
      setErrors({ start: "Pick a start and end time." });
      return;
    }
    setStatus("Saving…");
    try {
      await add({
        date: form.date,
        kind: form.kind,
        ...(form.kind === "special"
          ? { startMinute: startMinute!, durationMinutes: durationBetween(startMinute!, endMinute!) }
          : {}),
        title: form.title,
        note: form.note,
      });
      setForm({ ...blank, kind: form.kind });
      setStatus("Added.");
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? {});
      setStatus(messageOf(err));
    }
  }

  const errorText = Object.values(errors).join(" ");

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4 border border-[var(--line-strong)] p-4">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Type of change</legend>
        {(
          [
            ["cancelled", "Day off (no stream)"],
            ["special", "Extra stream"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`${id}-kind`} value={value} checked={form.kind === value} onChange={() => setForm({ ...form, kind: value })} className="size-4 accent-black dark:accent-white" />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[10rem_7rem_7rem_minmax(0,1fr)] sm:items-end">
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="text-xs font-medium">
            Date
          </label>
          <input id={`${id}-date`} type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-invalid={Boolean(errors.date)} className={`${inputClass} py-1.5 text-sm`} />
        </div>
        {form.kind === "special" && (
          <>
            <div className="space-y-1">
              <label htmlFor={`${id}-start`} className="text-xs font-medium">
                Starts
              </label>
              <input id={`${id}-start`} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={`${inputClass} py-1.5 text-sm`} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-end`} className="text-xs font-medium">
                Ends
              </label>
              <input id={`${id}-end`} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={`${inputClass} py-1.5 text-sm`} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-title`} className="text-xs font-medium">
                Title
              </label>
              <input id={`${id}-title`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Halloween costume stream" className={`${inputClass} py-1.5 text-sm`} />
            </div>
          </>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-note`} className="text-xs font-medium">
          Note for viewers <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id={`${id}-note`} value={form.note} maxLength={SCHEDULE_RULES.note.max + 10} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={form.kind === "cancelled" ? "e.g. At AniCon, back Monday!" : "e.g. Costume contest at midnight"} className={`${inputClass} py-1.5 text-sm`} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={`${primaryButton} py-1.5`}>
          {form.kind === "cancelled" ? "Add day off" : "Add extra stream"}
        </button>
        <p role={errorText ? "alert" : "status"} className="text-xs font-medium">
          {errorText || status}
        </p>
      </div>
    </form>
  );
}

function OverrideRow({ override }: { override: Doc<"scheduleOverrides"> }) {
  const remove = useMutation(api.schedule.removeOverride);
  const [error, setError] = useState("");
  const date = new Date(`${override.date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const what =
    override.kind === "cancelled"
      ? "Day off"
      : `${override.title} · ${formatTime(override.startMinute!)}–${formatTime((override.startMinute! + override.durationMinutes!) % 1440)}`;

  return (
    <li className="flex flex-wrap items-center gap-3 border border-[var(--line-strong)] px-3 py-2 text-sm">
      <span className="w-28 font-medium tabular-nums">{date}</span>
      <span className="min-w-0 flex-1">
        {what}
        {override.note && <span className="text-muted-foreground"> — {override.note}</span>}
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await remove({ id: override._id });
          } catch (err) {
            setError(messageOf(err));
          }
        }}
        className={`${secondaryButton} py-1`}
      >
        Remove<span className="sr-only"> {date} change</span>
      </button>
      {error && (
        <p role="alert" className="w-full text-xs font-semibold">
          {error}
        </p>
      )}
    </li>
  );
}
