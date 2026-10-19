"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AVATAR_RULES,
  PROFILE_LIMITS,
  type FieldErrors,
  type ProfileInput,
} from "@/convex/lib/profileRules";
import { ChangePassword } from "@/components/admin/ChangePassword";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/styles";
import { resizeImage } from "@/lib/imageResize";
import { initials } from "@/lib/initials";

export default function ProfilePage() {
  const profile = useQuery(api.profile.get);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        This is what visitors see at the top of your site and in the About section.
      </p>

      {profile === undefined ? (
        <p role="status" className="mt-8 text-sm">
          Loading your profile…
        </p>
      ) : profile === null ? (
        <p role="alert" className="mt-8 text-sm">
          No profile found. Ask your developer to run the profile setup.
        </p>
      ) : (
        <>
          <AvatarEditor url={profile.avatarUrl} name={profile.displayName} />
          <ProfileForm
            key={profile._id}
            initial={{
              displayName: profile.displayName,
              tagline: profile.tagline,
              bio: profile.bio,
              about: profile.about,
              timezone: profile.timezone,
              notifyEmail: profile.notifyEmail,
            }}
          />
        </>
      )}
      <ChangePassword />
    </main>
  );
}

/* ----------------------------------------------------------------------- */

function AvatarEditor({ url, name }: { url: string | null; name: string }) {
  const generateUploadUrl = useMutation(api.profile.generateAvatarUploadUrl);
  const setAvatar = useAction(api.profile.setAvatar);
  const removeAvatar = useMutation(api.profile.removeAvatar);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({
    kind: "idle",
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!(AVATAR_RULES.contentTypes as readonly string[]).includes(file.type)) {
      setStatus({ kind: "error", text: "Use a JPG, PNG or WebP image." });
      return;
    }
    try {
      setStatus({ kind: "busy", text: "Uploading photo…" });
      const { blob } = await resizeImage(file, 1024);
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const result = await setAvatar({ storageId });
      setStatus(result.ok ? { kind: "ok", text: "Photo updated." } : { kind: "error", text: result.error });
    } catch {
      setStatus({ kind: "error", text: "Could not upload that photo. Check your connection and try again." });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    if (!window.confirm("Remove your profile photo? Visitors will see your initials instead.")) return;
    try {
      setStatus({ kind: "busy", text: "Removing…" });
      await removeAvatar();
      setStatus({ kind: "ok", text: "Photo removed." });
    } catch {
      setStatus({ kind: "error", text: "Could not remove the photo. Try again." });
    }
  }

  const busy = status.kind === "busy";

  return (
    <section aria-labelledby="avatar-heading" className="mt-8 border-t border-black pt-6 dark:border-white">
      <h2 id="avatar-heading" className="text-sm font-semibold uppercase tracking-wider">
        Profile photo
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="size-24 shrink-0 overflow-hidden rounded-full border border-black dark:border-white">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of a Convex URL
            <img src={url} alt={`Current photo of ${name}`} className="size-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-full items-center justify-center text-2xl font-semibold">
              {initials(name)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className={`${primaryButton} cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2`}>
            {url ? "Change photo" : "Upload photo"}
            <input
              ref={inputRef}
              type="file"
              accept={AVATAR_RULES.contentTypes.join(",")}
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {url && (
            <button type="button" onClick={onRemove} disabled={busy} className={secondaryButton}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        JPG, PNG or WebP. Large photos are resized automatically.
      </p>
      <p
        role={status.kind === "error" ? "alert" : "status"}
        className="mt-2 min-h-5 text-sm font-medium"
      >
        {status.text}
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------------- */

function ProfileForm({ initial }: { initial: ProfileInput }) {
  const update = useMutation(api.profile.update);
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (status === "saved") setStatus("idle");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrors({});
    try {
      await update(values);
      setSaved(values);
      setStatus("saved");
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; fields?: FieldErrors }) : null;
      if (data?.code === "INVALID" && data.fields) setErrors(data.fields);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6 border-t border-black pt-6 dark:border-white">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Details</h2>

      <Field label="Display name" value={values.displayName} max={PROFILE_LIMITS.displayName.max} error={errors.displayName}>
        {(p) => <input {...p} type="text" required onChange={(e) => set("displayName", e.target.value)} />}
      </Field>

      <Field
        label="Tagline"
        hint="One short line under your name, e.g. “Cosplayer & Twitch streamer”."
        value={values.tagline}
        max={PROFILE_LIMITS.tagline.max}
        error={errors.tagline}
      >
        {(p) => <input {...p} type="text" onChange={(e) => set("tagline", e.target.value)} />}
      </Field>

      <Field
        label="Short intro"
        hint="Two or three sentences shown next to your photo."
        value={values.bio}
        max={PROFILE_LIMITS.bio.max}
        error={errors.bio}
      >
        {(p) => <textarea {...p} rows={3} onChange={(e) => set("bio", e.target.value)} />}
      </Field>

      <Field
        label="About me"
        hint="Your cosplay journey. Leave a blank line between paragraphs. Wrap words in **double stars** for bold. Links starting with https:// become clickable."
        value={values.about}
        max={PROFILE_LIMITS.about.max}
        error={errors.about}
      >
        {(p) => <textarea {...p} rows={10} onChange={(e) => set("about", e.target.value)} />}
      </Field>

      <TimezoneField value={values.timezone} error={errors.timezone} onChange={(v) => set("timezone", v)} />

      <Field
        label="Collaboration email (private)"
        hint="Where collab inquiries from your contact form are sent. Never shown on the site."
        value={values.notifyEmail}
        error={errors.notifyEmail}
      >
        {(p) => <input {...p} type="email" autoComplete="email" onChange={(e) => set("notifyEmail", e.target.value)} />}
      </Field>

      <div className="flex flex-wrap items-center gap-4 border-t border-black pt-6 dark:border-white">
        <button type="submit" disabled={!dirty || status === "saving"} className={primaryButton}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {dirty && status !== "saving" && (
          <button type="button" onClick={() => { setValues(saved); setErrors({}); setStatus("idle"); }} className={secondaryButton}>
            Discard
          </button>
        )}
        <p role={status === "error" ? "alert" : "status"} className="text-sm font-medium">
          {status === "saved" && "Saved. Your site is updated."}
          {status === "error" &&
            (Object.keys(errors).length > 0
              ? "Fix the highlighted fields and save again."
              : "Could not save. Check your connection and try again.")}
          {status === "idle" && dirty && "You have unsaved changes."}
        </p>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  name: string;
  value: string;
  className: string;
  "aria-invalid": boolean;
  "aria-describedby": string;
};

function Field({
  label,
  hint,
  value,
  max,
  error,
  children,
}: {
  label: string;
  hint?: string;
  value: string;
  max?: number;
  error?: string;
  children: (props: FieldProps) => ReactNode;
}) {
  const id = useId();
  const over = max !== undefined && value.length > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {max !== undefined && (
          <span className={`text-xs tabular-nums ${over ? "font-semibold" : "text-neutral-500 dark:text-neutral-400"}`} aria-hidden>
            {value.length}/{max}
          </span>
        )}
      </div>
      {children({
        id,
        name: id,
        value,
        className: inputClass,
        "aria-invalid": Boolean(error) || over,
        "aria-describedby": `${id}-hint ${id}-error`,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-neutral-600 dark:text-neutral-400">
          {hint}
        </p>
      )}
      <p id={`${id}-error`} className="text-sm font-semibold empty:hidden">
        {error ?? (over ? `Too long by ${value.length - max!} characters.` : "")}
      </p>
    </div>
  );
}

function TimezoneField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const zones = useMemo(() => {
    const list =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return Array.from(new Set(["UTC", value, ...list])).sort();
  }, [value]);
  // Only rendered after the client-side query resolves, never during SSR.
  const local = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  return (
    <Field
      label="Your timezone"
      hint="Your stream schedule is entered in this timezone and shown to visitors in theirs."
      value={value}
      error={error}
    >
      {(p) => (
        <div className="flex flex-wrap gap-3">
          <select {...p} className={`${p.className} w-auto min-w-0 flex-1`} onChange={(e) => onChange(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {local && local !== value && (
            <button type="button" onClick={() => onChange(local)} className={secondaryButton}>
              Use {local.replaceAll("_", " ")}
            </button>
          )}
        </div>
      )}
    </Field>
  );
}
