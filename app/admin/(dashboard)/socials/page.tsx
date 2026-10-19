"use client";

import { useMutation, useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { fieldErrorsOf, messageOf } from "@/components/admin/errors";
import { SortableList, reorderLocal } from "@/components/admin/SortableList";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/styles";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SOCIAL_RULES } from "@/convex/lib/linkRules";
import { parseSocialUrl, SOCIAL_PLATFORMS } from "@/convex/lib/links";

const PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS);

function placeholderFor(platform: string) {
  const spec = SOCIAL_PLATFORMS[platform];
  if (!spec?.handle) return spec?.domains[0] ? `https://${spec.domains[0]}/…` : "https://your-site.com";
  return `@yourname or https://${spec.domains[0]}/…`;
}

export default function SocialsPage() {
  const links = useQuery(api.socials.list);
  const move = useMutation(api.socials.move).withOptimisticUpdate((store, { id, afterId }) => {
    const current = store.getQuery(api.socials.list, {});
    if (!current) return;
    const reordered = reorderLocal(current.map((l) => ({ _id: l.id })), id, afterId);
    store.setQuery(api.socials.list, {}, reordered.map(({ _id }) => current.find((l) => l.id === _id)!));
  });

  const items = links?.map((l) => ({ ...l, _id: l.id }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Social links</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Shown in your site&apos;s header area and footer. Your first Twitch, Kick, YouTube or TikTok link becomes the
        main &ldquo;Watch&rdquo; button.
      </p>

      <AddLinkForm />

      {items === undefined ? (
        <p role="status" className="mt-8 text-sm">
          Loading links…
        </p>
      ) : items.length === 0 ? (
        <div className="mt-8 border border-dashed border-black p-8 text-center dark:border-white">
          <p className="font-medium">No links yet</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Add where people can follow you.</p>
        </div>
      ) : (
        <SortableList items={items} itemLabel={(l) => l.label} onMove={(id, afterId) => move({ id, afterId })}>
          {(link) => <LinkRow link={link} />}
        </SortableList>
      )}
    </main>
  );
}

function LinkFields({
  idPrefix,
  platform,
  url,
  label,
  errors,
  onChange,
}: {
  idPrefix: string;
  platform: string;
  url: string;
  label: string;
  errors: Record<string, string>;
  onChange: (next: { platform?: string; url?: string; label?: string }) => void;
}) {
  const preview = url.trim() ? parseSocialUrl(platform, url) : null;
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-platform`} className="text-xs font-medium">
          Platform
        </label>
        <select
          id={`${idPrefix}-platform`}
          value={platform}
          onChange={(e) => onChange({ platform: e.target.value })}
          className={`${inputClass} py-1.5 text-sm`}
        >
          {PLATFORM_KEYS.map((k) => (
            <option key={k} value={k}>
              {SOCIAL_PLATFORMS[k].label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-url`} className="text-xs font-medium">
          Link or @handle
        </label>
        <input
          id={`${idPrefix}-url`}
          value={url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder={placeholderFor(platform)}
          aria-invalid={Boolean(errors.url) || preview?.ok === false}
          aria-describedby={`${idPrefix}-url-hint`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} py-1.5 text-sm`}
        />
        <p id={`${idPrefix}-url-hint`} className="truncate text-xs text-neutral-600 dark:text-neutral-400">
          {errors.url ? (
            <span className="font-semibold text-current">{errors.url}</span>
          ) : preview?.ok ? (
            `→ ${preview.url}`
          ) : (
            preview?.error ?? " "
          )}
        </p>
      </div>
      <div className="space-y-1 sm:col-start-2">
        <label htmlFor={`${idPrefix}-label`} className="text-xs font-medium">
          Button text <span className="font-normal text-neutral-500 dark:text-neutral-400">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-label`}
          value={label}
          maxLength={SOCIAL_RULES.label.max + 10}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={SOCIAL_PLATFORMS[platform]?.label}
          aria-invalid={Boolean(errors.label)}
          className={`${inputClass} py-1.5 text-sm`}
        />
        {errors.label && <p className="text-xs font-semibold">{errors.label}</p>}
      </div>
    </div>
  );
}

function AddLinkForm() {
  const add = useMutation(api.socials.add);
  const id = useId();
  const [form, setForm] = useState({ platform: "tiktok", url: "", label: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "added">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrors({});
    try {
      await add(form);
      setForm((f) => ({ ...f, url: "", label: "" }));
      setStatus("added");
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? { url: messageOf(err) });
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 border border-black p-4 dark:border-white">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Add a link</h2>
      <LinkFields
        idPrefix={id}
        {...form}
        errors={errors}
        onChange={(next) => {
          setForm((f) => ({ ...f, ...next }));
          setStatus("idle");
        }}
      />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === "saving"} className={primaryButton}>
          {status === "saving" ? "Adding…" : "Add link"}
        </button>
        <p role="status" className="text-sm font-medium">
          {status === "added" && "Added."}
        </p>
      </div>
    </form>
  );
}

function LinkRow({
  link,
}: {
  link: { id: Id<"socialLinks">; platform: string; url: string; label: string };
}) {
  const update = useMutation(api.socials.update);
  const remove = useMutation(api.socials.remove);
  const id = useId();
  const saved = { platform: link.platform, url: link.url, label: link.label };
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setStatus({ kind: "busy" });
    setErrors({});
    try {
      await update({ id: link.id, ...form });
      setStatus({ kind: "ok", text: "Saved." });
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? {});
      setStatus({ kind: "error", text: messageOf(err) });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <LinkFields idPrefix={id} {...form} errors={errors} onChange={(next) => setForm((f) => ({ ...f, ...next }))} />
      <div className="flex flex-wrap items-center gap-2">
        {dirty && (
          <>
            <button type="submit" disabled={status.kind === "busy"} className={`${primaryButton} py-1.5`}>
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(saved);
                setErrors({});
              }}
              className={`${secondaryButton} py-1.5`}
            >
              Undo
            </button>
          </>
        )}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} py-1.5`}>
          Open ↗<span className="sr-only"> {link.label} in new tab</span>
        </a>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Remove your ${link.label} link?`)) return;
            try {
              await remove({ id: link.id });
            } catch (err) {
              setStatus({ kind: "error", text: messageOf(err) });
            }
          }}
          className={`${secondaryButton} ml-auto py-1.5`}
        >
          Remove
        </button>
      </div>
      <p role={status.kind === "error" ? "alert" : "status"} className="min-h-4 text-xs font-medium">
        {status.kind === "busy" ? "Saving…" : status.text}
      </p>
    </form>
  );
}
