"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useConfirm } from "@/components/admin/ConfirmProvider";
import { messageOf } from "@/components/admin/errors";
import { SortableList, reorderLocal } from "@/components/admin/SortableList";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/styles";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PHOTO_RULES } from "@/convex/lib/photoRules";
import { resizeImage } from "@/lib/imageResize";

type Photo = Doc<"photos"> & { url: string | null };

export default function PhotosPage() {
  const photos = useQuery(api.photos.listAdmin);
  const move = useMutation(api.photos.move).withOptimisticUpdate((store, { id, afterId }) => {
    const current = store.getQuery(api.photos.listAdmin, {});
    if (current) store.setQuery(api.photos.listAdmin, {}, reorderLocal(current, id, afterId));
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
        {photos && (
          <p className="text-sm text-muted-foreground">
            {photos.length} {photos.length === 1 ? "photo" : "photos"} ·{" "}
            {photos.filter((p) => p.visible).length} shown on your site
          </p>
        )}
      </div>

      <Uploader />

      {photos === undefined ? (
        <p role="status" className="mt-8 text-sm">
          Loading photos…
        </p>
      ) : photos.length === 0 ? (
        <div className="mt-8 border border-dashed border-[var(--line-strong)] p-8 text-center">
          <p className="font-medium">No photos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first cosplay photos above. Newest photos appear first on your site.
          </p>
        </div>
      ) : (
        <SortableList
          items={photos}
          itemLabel={(p, i) => p.caption || p.tag || `Photo ${i + 1}`}
          onMove={(id, afterId) => move({ id, afterId })}
        >
          {(photo, i) => <PhotoRow photo={photo} position={i + 1} />}
        </SortableList>
      )}
    </main>
  );
}

/* ----------------------------------------------------------------------- */

type QueueItem = { key: string; name: string; state: "waiting" | "uploading" | "done" | "error"; error?: string };

function Uploader() {
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const addPhoto = useAction(api.photos.add);
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = queue.some((q) => q.state === "waiting" || q.state === "uploading");

  const patch = (key: string, next: Partial<QueueItem>) =>
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...next } : item)));

  async function uploadOne(file: File, key: string) {
    if (!(PHOTO_RULES.contentTypes as readonly string[]).includes(file.type)) {
      patch(key, { state: "error", error: "Not a JPG, PNG or WebP image" });
      return;
    }
    patch(key, { state: "uploading" });
    try {
      const { blob, width, height } = await resizeImage(file, PHOTO_RULES.resizeMaxSide, 0.88);
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const result = await addPhoto({ storageId, width, height });
      patch(key, result.ok ? { state: "done" } : { state: "error", error: result.error });
    } catch (err) {
      patch(key, {
        state: "error",
        error: messageOf(err, "Upload failed. Check your connection."),
      });
    }
  }

  async function start(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const items = list.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, state: "waiting" as const }));
    setQueue((q) => [...q.filter((i) => i.state !== "done"), ...items]);
    // One at a time: kind to slow mobile connections and to the rate limit.
    for (let i = 0; i < list.length; i++) await uploadOne(list[i], items[i].key);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) void start(e.dataTransfer.files);
  }

  const done = queue.filter((q) => q.state === "done").length;

  return (
    <section
      aria-label="Add photos"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`mt-6 border-2 border-dashed p-6 text-center ${
        dragging ? "border-[var(--line-strong)] bg-[var(--surface)]" : "border-[var(--line-strong)]"
      }`}
    >
      <label className={`${primaryButton} inline-block cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2`}>
        {busy ? "Uploading…" : "Add photos"}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={PHOTO_RULES.contentTypes.join(",")}
          disabled={busy}
          onChange={(e) => e.target.files && start(e.target.files)}
          className="sr-only"
        />
      </label>
      <p className="mt-3 text-xs text-muted-foreground">
        Or drag photos here. JPG, PNG or WebP; large photos are resized automatically.
      </p>

      {queue.length > 0 && (
        <div className="mt-4 text-left">
          <p role="status" className="text-sm font-medium">
            {busy ? `Uploading ${done + 1} of ${queue.length}…` : `${done} of ${queue.length} uploaded.`}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {queue
              .filter((q) => q.state !== "done")
              .map((q) => (
                <li key={q.key} className="flex justify-between gap-3">
                  <span className="truncate">{q.name}</span>
                  <span className={q.state === "error" ? "font-semibold" : "text-muted-foreground"}>
                    {q.state === "error" ? q.error : q.state === "uploading" ? "Uploading…" : "Waiting"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------------- */

function PhotoRow({ photo, position }: { photo: Photo; position: number }) {
  const update = useMutation(api.photos.update);
  const confirm = useConfirm();
  const remove = useMutation(api.photos.remove);
  const [caption, setCaption] = useState(photo.caption);
  const [tag, setTag] = useState(photo.tag);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text?: string }>({
    kind: "idle",
  });
  const id = useId();
  const dirty = caption !== photo.caption || tag !== photo.tag;
  const label = photo.caption || photo.tag || `Photo ${position}`;

  async function save(fields: { caption: string; tag: string; visible: boolean }, okText: string) {
    setStatus({ kind: "saving" });
    try {
      await update({ id: photo._id, ...fields });
      setStatus({ kind: "saved", text: okText });
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { fields?: Record<string, string> }) : null;
      setStatus({
        kind: "error",
        text: data?.fields ? Object.values(data.fields).join(" ") : "Could not save. Try again.",
      });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (dirty) void save({ caption, tag, visible: photo.visible }, "Saved.");
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete “${label}”?`,
      description: "It's removed from your site and the file is deleted. This can't be undone.",
      confirmLabel: "Delete photo",
    });
    if (!ok) return;
    try {
      await remove({ id: photo._id });
    } catch {
      setStatus({ kind: "error", text: "Could not delete. Try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-3">
        <div className="relative size-28 shrink-0 overflow-hidden bg-[var(--surface)] sm:size-32">
          {photo.url && (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a Convex URL
            <img src={photo.url} alt="" className={`size-full object-cover ${photo.visible ? "" : "opacity-40"}`} />
          )}
          {!photo.visible && (
            <span className="absolute inset-x-0 bottom-0 bg-black/80 py-0.5 text-center text-xs text-white">Hidden</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <label htmlFor={`${id}-caption`} className="text-xs font-medium">
              Caption
            </label>
            <input
              id={`${id}-caption`}
              value={caption}
              maxLength={PHOTO_RULES.caption.max + 20}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Frieren at AniCon 2026"
              className={`${inputClass} py-1.5 text-sm`}
            />
          </div>
          <div>
            <label htmlFor={`${id}-tag`} className="text-xs font-medium">
              Character / series
            </label>
            <input
              id={`${id}-tag`}
              value={tag}
              maxLength={PHOTO_RULES.tag.max + 20}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Frieren"
              className={`${inputClass} py-1.5 text-sm`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {dirty && (
              <>
                <button type="submit" disabled={status.kind === "saving"} className={`${primaryButton} py-1.5`}>
                  {status.kind === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaption(photo.caption);
                    setTag(photo.tag);
                  }}
                  className={`${secondaryButton} py-1.5`}
                >
                  Undo
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                save(
                  { caption: photo.caption, tag: photo.tag, visible: !photo.visible },
                  photo.visible ? "Hidden from your site." : "Shown on your site.",
                )
              }
              aria-pressed={!photo.visible}
              className={`${secondaryButton} py-1.5`}
            >
              {photo.visible ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={onDelete} className={`${secondaryButton} ml-auto py-1.5`}>
              Delete
            </button>
          </div>
          <p role={status.kind === "error" ? "alert" : "status"} className="min-h-4 text-xs font-medium">
            {status.text}
          </p>
        </div>
    </form>
  );
}
