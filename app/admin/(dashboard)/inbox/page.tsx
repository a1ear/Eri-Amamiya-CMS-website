"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { messageOf } from "@/components/admin/errors";
import { secondaryButton } from "@/components/admin/styles";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CONTACT_RULES } from "@/convex/lib/contactRules";

type View = "new" | "read" | "archived";
const VIEWS: [View, string][] = [
  ["new", "New"],
  ["read", "Read"],
  ["archived", "Archived"],
];

export default function InboxPage() {
  const [view, setView] = useState<View>("new");
  const messages = useQuery(api.contact.list, { status: view });
  const unread = useQuery(api.contact.unreadCount);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Messages from your website&apos;s contact form. Messages can&apos;t be edited, only filed.
      </p>

      <div role="tablist" aria-label="Messages" className="mt-6 flex gap-2 border-b border-black dark:border-white">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`-mb-px border border-b-0 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
              view === value
                ? "border-black bg-[var(--background)] font-semibold dark:border-white"
                : "border-transparent text-neutral-600 hover:text-current dark:text-neutral-400"
            }`}
          >
            {label}
            {value === "new" && unread ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4">
        {messages === undefined ? (
          <p role="status" className="text-sm">
            Loading messages…
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {view === "new" ? "No new messages. You're all caught up." : `No ${view} messages.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <MessageCard key={m._id} message={m} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

const EMAIL_NOTE: Record<Doc<"contactMessages">["emailStatus"], string | null> = {
  queued: null,
  not_configured: "Email notifications aren't set up yet, so this one is only here.",
  failed: "The email notification for this message failed; it's safe here.",
};

function MessageCard({ message }: { message: Doc<"contactMessages"> }) {
  const setStatus = useMutation(api.contact.setStatus);
  const [error, setError] = useState("");
  const received = new Date(message.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const replyHref = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(
    `Re: ${CONTACT_RULES.topics[message.topic]}`,
  )}`;

  async function move(status: Doc<"contactMessages">["status"]) {
    setError("");
    try {
      await setStatus({ id: message._id, status });
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <li className={`border border-black p-4 dark:border-white ${message.status === "new" ? "border-l-4" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {message.name} <span className="font-normal text-neutral-600 dark:text-neutral-400">&lt;{message.email}&gt;</span>
        </p>
        <p className="text-xs text-neutral-600 tabular-nums dark:text-neutral-400">{received}</p>
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider">{CONTACT_RULES.topics[message.topic]}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
      {EMAIL_NOTE[message.emailStatus] && (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">{EMAIL_NOTE[message.emailStatus]}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={replyHref} className={`${secondaryButton} py-1.5`}>
          Reply by email
        </a>
        {message.status === "new" && (
          <button type="button" onClick={() => move("read")} className={`${secondaryButton} py-1.5`}>
            Mark as read
          </button>
        )}
        {message.status !== "new" && (
          <button type="button" onClick={() => move("new")} className={`${secondaryButton} py-1.5`}>
            Mark unread
          </button>
        )}
        {message.status !== "archived" ? (
          <button type="button" onClick={() => move("archived")} className={`${secondaryButton} py-1.5`}>
            Archive
          </button>
        ) : (
          <button type="button" onClick={() => move("read")} className={`${secondaryButton} py-1.5`}>
            Move back to inbox
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold">
          {error}
        </p>
      )}
    </li>
  );
}
