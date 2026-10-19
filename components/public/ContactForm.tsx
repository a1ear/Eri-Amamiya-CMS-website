"use client";

import { ConvexError } from "convex/values";
import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { CONTACT_RULES, type ContactTopic } from "@/convex/lib/contactRules";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Matches @convex-dev/rate-limiter's error without pulling the package into
// the public bundle.
function isRateLimited(err: unknown) {
  return err instanceof ConvexError && (err.data as { kind?: string })?.kind === "RateLimited";
}
const TOPICS = Object.entries(CONTACT_RULES.topics) as [ContactTopic, string][];

const field =
  "w-full border border-[var(--foreground)] bg-transparent px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 aria-[invalid=true]:border-2";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function ContactForm() {
  const id = useId();
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !window.turnstile || !widgetEl.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetEl.current, {
      sitekey: SITE_KEY,
      theme: "auto",
      size: "flexible",
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, []);

  useEffect(() => {
    if (scriptReady) renderWidget();
  }, [scriptReady, renderWidget, status.kind]);

  useEffect(
    () => () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    },
    [],
  );

  function resetWidget() {
    setToken("");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setErrors({});
    if (!token) {
      setStatus({ kind: "error", message: "Please wait for the security check above the button to finish." });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      // Loaded on submit: most visitors never send a message.
      const { ConvexHttpClient } = await import("convex/browser");
      const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      await client.action(api.contact.submit, {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        topic: String(form.get("topic") ?? "collab") as ContactTopic,
        message: String(form.get("message") ?? ""),
        website: String(form.get("website") ?? ""),
        turnstileToken: token,
      });
      widgetId.current = null; // the success view unmounts the widget
      setStatus({ kind: "sent" });
    } catch (err) {
      resetWidget(); // tokens are single-use
      if (isRateLimited(err)) {
        setStatus({ kind: "error", message: "Lots of messages right now. Please try again in a few minutes." });
        return;
      }
      const data = err instanceof ConvexError ? (err.data as { code?: string; fields?: Record<string, string> }) : null;
      if (data?.code === "INVALID" && data.fields) {
        setErrors(data.fields);
        setStatus({ kind: "error", message: "Please fix the highlighted fields." });
      } else if (data?.code === "CAPTCHA_FAILED") {
        setStatus({ kind: "error", message: "The security check didn't pass. Please try again." });
      } else {
        setStatus({ kind: "error", message: "Couldn't send right now. Check your connection and try again." });
      }
    }
  }

  if (!SITE_KEY) {
    return <p className="text-[var(--muted)]">The contact form isn&apos;t set up yet.</p>;
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="border border-[var(--foreground)] p-6 md:p-8">
        <p className="text-2xl font-semibold tracking-tight">Message sent. Thank you!</p>
        <p className="mt-2 text-[var(--muted)]">You&apos;ll get a reply at the email you entered.</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-6 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Send another message
        </button>
      </div>
    );
  }

  const describedBy = (name: string) => (errors[name] ? `${id}-${name}-error` : undefined);
  const errorText = (name: string) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="text-sm font-semibold">
        {errors[name]}
      </p>
    ) : null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className="block text-sm font-medium">
            Your name
          </label>
          <input id={`${id}-name`} name="name" autoComplete="name" required maxLength={CONTACT_RULES.name.max} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} className={field} />
          {errorText("name")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-email`} className="block text-sm font-medium">
            Email
          </label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")} className={field} />
          {errorText("email")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={`${id}-topic`} className="block text-sm font-medium">
            What&apos;s it about?
          </label>
          <select id={`${id}-topic`} name="topic" defaultValue="collab" className={field}>
            {TOPICS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={`${id}-message`} className="block text-sm font-medium">
            Message
          </label>
          <textarea id={`${id}-message`} name="message" rows={6} required maxLength={CONTACT_RULES.message.max} aria-invalid={Boolean(errors.message)} aria-describedby={describedBy("message")} className={field} />
          {errorText("message")}
        </div>

        {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Leave this empty</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="sm:col-span-2">
          <div ref={widgetEl} className="min-h-[65px]" />
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button
            type="submit"
            disabled={status.kind === "sending"}
            className="inline-flex min-h-12 items-center bg-[var(--foreground)] px-8 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
          >
            {status.kind === "sending" ? "Sending…" : "Send message"}
          </button>
          <p role={status.kind === "error" ? "alert" : "status"} className="text-sm font-medium">
            {status.kind === "error" && status.message}
          </p>
        </div>
      </form>
    </>
  );
}
