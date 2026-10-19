"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, domMax, LazyMotion, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { messageOf } from "@/components/admin/errors";
import { secondaryButton } from "@/components/admin/styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <p className="mt-1 text-sm text-muted-foreground">
        Messages from your website&apos;s contact form. Messages can&apos;t be edited, only filed.
      </p>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mt-6">
        <TabsList variant="line" aria-label="Messages" className="w-full justify-start border-b border-[var(--line)] pb-1">
          {VIEWS.map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-none px-3">
              {label}
              {value === "new" && unread ? (
                <span className="ml-1.5 inline-flex min-w-5 justify-center bg-primary px-1 text-xs font-semibold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {VIEWS.map(([value]) => (
          <TabsContent key={value} value={value} className="mt-4">
            {messages === undefined ? (
              <p role="status" className="text-sm">
                Loading messages…
              </p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {view === "new" ? "No new messages. You're all caught up." : `No ${view} messages.`}
              </p>
            ) : (
              <MessageList messages={messages} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

/**
 * Filing a message (read / archive) moves it to another tab, so it leaves this
 * list: it slides out and the rest close the gap, instead of teleporting.
 * Occasional action → standard 180–200ms; fade only under reduced motion.
 */
function MessageList({ messages }: { messages: Doc<"contactMessages">[] }) {
  const reduce = useReducedMotion();
  const ease = [0.23, 1, 0.32, 1] as const;
  return (
    <LazyMotion features={domMax} strict>
      <ul className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {messages.map((msg) => (
            <m.li
              key={msg._id}
              layout={!reduce}
              initial={{ opacity: 0, transform: reduce ? "none" : "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transform: reduce ? "none" : "translateX(-16px)" }}
              transition={{ duration: 0.2, ease }}
            >
              <MessageCard message={msg} />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </LazyMotion>
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
    <div className={`border border-[var(--line-strong)] bg-card p-4 ${message.status === "new" ? "border-l-4 border-l-foreground" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {message.name} <span className="font-normal text-muted-foreground">&lt;{message.email}&gt;</span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{received}</p>
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider">{CONTACT_RULES.topics[message.topic]}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
      {EMAIL_NOTE[message.emailStatus] && (
        <p className="mt-3 text-xs text-muted-foreground">{EMAIL_NOTE[message.emailStatus]}</p>
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
    </div>
  );
}
