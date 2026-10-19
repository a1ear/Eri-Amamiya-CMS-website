"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/admin/ConfirmProvider";
import { fieldErrorsOf, messageOf } from "@/components/admin/errors";
import { SortableList, reorderLocal } from "@/components/admin/SortableList";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/styles";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { VIDEO_RULES } from "@/convex/lib/linkRules";
import { parseVideoUrl, VIDEO_PLATFORMS } from "@/convex/lib/links";
import { PHOTO_RULES } from "@/convex/lib/photoRules";
import { resizeImage } from "@/lib/imageResize";

export default function VideosPage() {
  const videos = useQuery(api.videos.listAdmin);
  const move = useMutation(api.videos.move).withOptimisticUpdate((store, { id, afterId }) => {
    const current = store.getQuery(api.videos.listAdmin, {});
    if (current) store.setQuery(api.videos.listAdmin, {}, reorderLocal(current, id, afterId));
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Featured videos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a link to any video (TikTok, YouTube, Instagram, Facebook, Twitch…). Visitors tap the card to watch it there.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        YouTube videos, full TikTok video links and Twitch clips also play a silent preview on your site. For TikTok, use
        the full link (tiktok.com/@you/video/…), not a short vm.tiktok.com one. Other links show their cover image.
      </p>

      <AddVideoForm />

      {videos === undefined ? (
        <p role="status" className="mt-8 text-sm">
          Loading videos…
        </p>
      ) : videos.length === 0 ? (
        <div className="mt-8 border border-dashed border-[var(--line-strong)] p-8 text-center">
          <p className="font-medium">No featured videos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The videos section stays hidden on your site until you add one.
          </p>
        </div>
      ) : (
        <SortableList items={videos} itemLabel={(v) => v.title} onMove={(id, afterId) => move({ id, afterId })}>
          {(video) => <VideoRow video={video} />}
        </SortableList>
      )}
    </main>
  );
}

function AddVideoForm() {
  const add = useMutation(api.videos.add);
  const id = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "added" | "error">("idle");

  const preview = url.trim() ? parseVideoUrl(url) : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrors({});
    try {
      await add({ url, title });
      setUrl("");
      setTitle("");
      setStatus("added");
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? {});
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 border border-[var(--line-strong)] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Add a video</h2>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-url`} className="block text-sm font-medium">
          Video link
        </label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStatus("idle");
          }}
          placeholder="https://www.tiktok.com/@you/video/…"
          aria-invalid={Boolean(errors.url)}
          aria-describedby={`${id}-url-hint`}
          className={inputClass}
        />
        <p id={`${id}-url-hint`} className="text-xs text-muted-foreground">
          {errors.url ? (
            <span className="font-semibold text-current">{errors.url}</span>
          ) : preview?.ok ? (
            `Detected: ${VIDEO_PLATFORMS[preview.platform]?.label ?? "Other website"}${preview.embed ? ". Plays a silent preview on your site" : ". Shows a cover only"}${preview.youtubeId ? ", thumbnail added automatically." : "."}`
          ) : preview ? (
            preview.error
          ) : (
            "Copy the link from the app's Share button."
          )}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-title`} className="block text-sm font-medium">
          Title
        </label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={VIDEO_RULES.title.max + 20}
          placeholder="e.g. Frieren transformation"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={`${id}-title-error`}
          className={inputClass}
        />
        <p id={`${id}-title-error`} className="text-sm font-semibold empty:hidden">
          {errors.title}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === "saving"} className={primaryButton}>
          {status === "saving" ? "Adding…" : "Add video"}
        </button>
        <p role="status" className="text-sm font-medium">
          {status === "added" && "Added to the top of your list."}
        </p>
      </div>
    </form>
  );
}

type Video = NonNullable<ReturnType<typeof useQuery<typeof api.videos.listAdmin>>>[number];

function VideoRow({ video }: { video: Video }) {
  const update = useMutation(api.videos.update);
  const remove = useMutation(api.videos.remove);
  const confirm = useConfirm();
  const generateUploadUrl = useMutation(api.videos.generateCoverUploadUrl);
  const setCover = useAction(api.videos.setCover);
  const removeCover = useMutation(api.videos.removeCover);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [title, setTitle] = useState(video.title);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const dirty = title !== video.title;

  async function run(fn: () => Promise<unknown>, okText: string) {
    setStatus({ kind: "busy" });
    try {
      await fn();
      setStatus({ kind: "ok", text: okText });
    } catch (err) {
      setStatus({ kind: "error", text: messageOf(err) });
    }
  }

  async function onCover(file: File | undefined) {
    if (!file) return;
    if (!(PHOTO_RULES.contentTypes as readonly string[]).includes(file.type)) {
      setStatus({ kind: "error", text: "Use a JPG, PNG or WebP image." });
      return;
    }
    await run(async () => {
      const { blob } = await resizeImage(file, 1280);
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const result = await setCover({ id: video._id, storageId });
      if (!result.ok) throw new Error(result.error);
    }, "Cover updated.");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void run(() => update({ id: video._id, title, visible: video.visible }), "Saved.");
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[var(--surface)] sm:w-44">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
          <img src={video.thumbnailUrl} alt="" className={`size-full object-cover ${video.visible ? "" : "opacity-40"}`} />
        ) : (
          <span className="flex size-full items-center justify-center text-xs uppercase tracking-widest">
            {video.platformLabel}
          </span>
        )}
        {!video.visible && (
          <span className="absolute inset-x-0 bottom-0 bg-black/80 py-0.5 text-center text-xs text-white">Hidden</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <label htmlFor={`${id}-title`} className="text-xs font-medium">
            Title
          </label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} py-1.5 text-sm`}
          />
        </div>
        <Badge variant={video.embed ? "default" : "outline"}>{video.embed ? "Plays preview" : "Cover only"}</Badge>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-xs underline underline-offset-2"
        >
          {video.platformLabel}: {video.url}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {dirty && (
            <>
              <button type="submit" disabled={status.kind === "busy"} className={`${primaryButton} py-1.5`}>
                Save
              </button>
              <button type="button" onClick={() => setTitle(video.title)} className={`${secondaryButton} py-1.5`}>
                Undo
              </button>
            </>
          )}
          <label className={`${secondaryButton} cursor-pointer py-1.5 has-[:focus-visible]:outline-2`}>
            {video.coverStorageId ? "Change cover" : "Add cover"}
            <input
              ref={fileRef}
              type="file"
              accept={PHOTO_RULES.contentTypes.join(",")}
              onChange={(e) => onCover(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {video.coverStorageId && (
            <button type="button" onClick={() => run(() => removeCover({ id: video._id }), "Cover removed.")} className={`${secondaryButton} py-1.5`}>
              Remove cover
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              run(
                () => update({ id: video._id, title: video.title, visible: !video.visible }),
                video.visible ? "Hidden from your site." : "Shown on your site.",
              )
            }
            aria-pressed={!video.visible}
            className={`${secondaryButton} py-1.5`}
          >
            {video.visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete “${video.title}”?`,
                description: "It's removed from your featured videos. This can't be undone.",
                confirmLabel: "Delete video",
              });
              if (ok) void run(() => remove({ id: video._id }), "Deleted.");
            }}
            className={`${secondaryButton} ml-auto py-1.5`}
          >
            Delete
          </button>
        </div>
        <p role={status.kind === "error" ? "alert" : "status"} className="min-h-4 text-xs font-medium">
          {status.kind === "busy" ? "Working…" : status.text}
        </p>
      </div>
    </form>
  );
}
